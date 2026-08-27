const LibraryBook = require('../models/LibraryBook');
const User = require('../models/User');
const AccountsLedger = require('../models/AccountsLedger');

// Get books
exports.getBooks = async (req, res) => {
  const search = req.query.search || '';
  try {
    const filter = {};

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { isbn: { $regex: search, $options: 'i' } },
        { author: { $regex: search, $options: 'i' } },
        { barcode: { $regex: search, $options: 'i' } }
      ];
    }

    const books = await LibraryBook.find(filter).sort({ created_at: -1 });
    
    const formattedBooks = books.map(b => ({
      id: b._id.toString(),
      title: b.title,
      isbn: b.isbn,
      author: b.author,
      publisher: b.publisher || '',
      subject: b.subject || '',
      quantity: b.quantity,
      rack_number: b.rack_number || '',
      price: b.price || 0,
      barcode: b.barcode,
      status: b.status
    }));

    res.json({ books: formattedBooks });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error fetching books' });
  }
};

// Create a book
exports.createBook = async (req, res) => {
  const { title, isbn, author, publisher, subject, quantity, rack_number, price, barcode } = req.body;
  if (!title || !isbn || !author || !barcode) {
    return res.status(400).json({ message: 'Title, ISBN, author, and barcode are required' });
  }

  try {
    const newBook = new LibraryBook({
      title,
      isbn,
      author,
      publisher: publisher || '',
      subject: subject || '',
      quantity: quantity || 1,
      rack_number: rack_number || '',
      price: price || 0.00,
      barcode,
      status: 'Available'
    });
    await newBook.save();
    res.status(201).json({ message: 'Book added to library successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error adding book: ' + err.message });
  }
};

// Issue a book
exports.issueBook = async (req, res) => {
  const { book_id, user_id, due_date } = req.body;
  if (!book_id || !user_id || !due_date) {
    return res.status(400).json({ message: 'Book ID, User ID, and Due Date are required' });
  }

  try {
    const book = await LibraryBook.findById(book_id);
    if (!book) {
      return res.status(404).json({ message: 'Book not found' });
    }

    if (book.quantity <= 0 || book.status === 'Out of Stock') {
      return res.status(400).json({ message: 'Book is currently out of stock' });
    }

    // Insert issue record
    book.issues.push({
      user: user_id,
      issue_date: new Date(),
      due_date: new Date(due_date),
      status: 'Issued'
    });

    // Decrement book quantity
    book.quantity = book.quantity - 1;
    if (book.quantity === 0) {
      book.status = 'Out of Stock';
    }

    await book.save();
    res.json({ message: 'Book issued successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error issuing book: ' + err.message });
  }
};

// Return a book (With Fine calculation)
exports.returnBook = async (req, res) => {
  const { issue_id } = req.body;
  if (!issue_id) {
    return res.status(400).json({ message: 'Issue ID is required' });
  }

  try {
    const book = await LibraryBook.findOne({ 'issues._id': issue_id });
    if (!book) {
      return res.status(404).json({ message: 'Active book issue record not found' });
    }

    const issue = book.issues.id(issue_id);
    if (!issue || issue.status !== 'Issued') {
      return res.status(404).json({ message: 'Active book issue record not found' });
    }

    const returnDate = new Date();
    
    // Calculate fine (e.g., $1 per day late)
    const dueDateObj = new Date(issue.due_date);
    let fineAmount = 0;
    
    if (returnDate > dueDateObj) {
      const diffTime = Math.abs(returnDate - dueDateObj);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      fineAmount = diffDays * 1.00; // $1.00 fine per day
    }

    // Update issue record
    issue.return_date = returnDate;
    issue.fine_amount = fineAmount;
    issue.status = 'Returned';

    // Increment book quantity
    book.quantity = book.quantity + 1;
    book.status = 'Available';

    await book.save();

    // If fine is charged, log it as Income in the accounts ledger
    if (fineAmount > 0) {
      const user = await User.findById(issue.user);
      const userName = user ? user.name : 'User';
      
      const ledgerEntry = new AccountsLedger({
        date: returnDate,
        type: 'Income',
        category: 'Library',
        title: `Library Fine from ${userName}`,
        description: 'Library late return fine',
        amount: fineAmount
      });
      await ledgerEntry.save();
    }

    res.json({ message: 'Book returned successfully', fineAmount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error returning book: ' + err.message });
  }
};

// Get issue history
exports.getIssues = async (req, res) => {
  const { status, userId } = req.query;
  try {
    const books = await LibraryBook.find({}).populate('issues.user', 'name role');

    const issues = [];
    books.forEach(book => {
      book.issues.forEach(issue => {
        let match = true;
        if (status && issue.status !== status) match = false;
        if (userId && issue.user && issue.user._id.toString() !== userId) match = false;

        if (match && issue.user) {
          issues.push({
            id: issue._id.toString(),
            book_id: book._id.toString(),
            title: book.title,
            isbn: book.isbn,
            user_id: issue.user._id.toString(),
            user_name: issue.user.name,
            user_role: issue.user.role,
            issue_date: issue.issue_date,
            due_date: issue.due_date,
            return_date: issue.return_date || null,
            fine_amount: issue.fine_amount || 0,
            status: issue.status
          });
        }
      });
    });

    // Sort issues by issue_date desc
    issues.sort((a, b) => new Date(b.issue_date) - new Date(a.issue_date));

    res.json({ issues });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error fetching library issues' });
  }
};
