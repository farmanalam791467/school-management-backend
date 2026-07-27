const db = require('../config/db');

// Get books
exports.getBooks = async (req, res) => {
  const search = req.query.search || '';
  try {
    let query = 'SELECT * FROM library_books WHERE 1=1';
    const params = [];

    if (search) {
      query += ' AND (title LIKE ? OR isbn LIKE ? OR author LIKE ? OR barcode LIKE ?)';
      const searchWild = `%${search}%`;
      params.push(searchWild, searchWild, searchWild, searchWild);
    }

    query += ' ORDER BY id DESC';
    const [books] = await db.query(query, params);
    res.json({ books });
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
    await db.query(
      `INSERT INTO library_books (title, isbn, author, publisher, subject, quantity, rack_number, price, barcode, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Available')`,
      [title, isbn, author, publisher || '', subject || '', quantity || 1, rack_number || '', price || 0.00, barcode]
    );
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

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // 1. Check book availability
    const [books] = await conn.query('SELECT quantity, status FROM library_books WHERE id = ?', [book_id]);
    if (books.length === 0) {
      return res.status(404).json({ message: 'Book not found' });
    }

    const book = books[0];
    if (book.quantity <= 0 || book.status === 'Out of Stock') {
      return res.status(400).json({ message: 'Book is currently out of stock' });
    }

    // 2. Insert issue record
    const issueDate = new Date().toISOString().slice(0, 10);
    await conn.query(
      `INSERT INTO library_issues (book_id, user_id, issue_date, due_date, status) 
       VALUES (?, ?, ?, ?, 'Issued')`,
      [book_id, user_id, issueDate, due_date]
    );

    // 3. Decrement book quantity
    const newQty = book.quantity - 1;
    const status = newQty === 0 ? 'Out of Stock' : 'Available';
    await conn.query('UPDATE library_books SET quantity = ?, status = ? WHERE id = ?', [newQty, status, book_id]);

    await conn.commit();
    res.json({ message: 'Book issued successfully' });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ message: 'Server error issuing book: ' + err.message });
  } finally {
    conn.release();
  }
};

// Return a book (With Fine calculation)
exports.returnBook = async (req, res) => {
  const { issue_id } = req.body;
  if (!issue_id) {
    return res.status(400).json({ message: 'Issue ID is required' });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // 1. Fetch issue record
    const [issues] = await conn.query('SELECT * FROM library_issues WHERE id = ? AND status = "Issued"', [issue_id]);
    if (issues.length === 0) {
      return res.status(404).json({ message: 'Active book issue record not found' });
    }

    const issue = issues[0];
    const returnDate = new Date().toISOString().slice(0, 10);
    
    // Calculate fine (e.g., $1 per day late)
    const dueDateObj = new Date(issue.due_date);
    const returnDateObj = new Date(returnDate);
    let fineAmount = 0;
    
    if (returnDateObj > dueDateObj) {
      const diffTime = Math.abs(returnDateObj - dueDateObj);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      fineAmount = diffDays * 1.00; // $1.00 fine per day
    }

    // 2. Update issue record
    await conn.query(
      'UPDATE library_issues SET return_date = ?, fine_amount = ?, status = "Returned" WHERE id = ?',
      [returnDate, fineAmount, issue_id]
    );

    // 3. Increment book quantity
    const [books] = await conn.query('SELECT quantity FROM library_books WHERE id = ?', [issue.book_id]);
    const newQty = books[0].quantity + 1;
    await conn.query('UPDATE library_books SET quantity = ?, status = "Available" WHERE id = ?', [newQty, issue.book_id]);

    // 4. If fine is charged, log it as Income in the accounts ledger
    if (fineAmount > 0) {
      // Find user name
      const [users] = await conn.query('SELECT name FROM users WHERE id = ?', [issue.user_id]);
      const userName = users.length > 0 ? users[0].name : 'User';
      
      await conn.query(
        `INSERT INTO accounts_ledger (type, category, title, amount, date, description) 
         VALUES ('Income', 'Library', ?, ?, ?, 'Library late return fine')`,
        [
          `Library Fine from ${userName}`,
          fineAmount,
          returnDate
        ]
      );
    }

    await conn.commit();
    res.json({ message: 'Book returned successfully', fineAmount });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ message: 'Server error returning book: ' + err.message });
  } finally {
    conn.release();
  }
};

// Get issue history
exports.getIssues = async (req, res) => {
  const { status, userId } = req.query;
  try {
    let query = `
      SELECT li.*, lb.title, lb.isbn, u.name as user_name, u.role as user_role
      FROM library_issues li
      JOIN library_books lb ON li.book_id = lb.id
      JOIN users u ON li.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      query += ' AND li.status = ?';
      params.push(status);
    }
    if (userId) {
      query += ' AND li.user_id = ?';
      params.push(userId);
    }

    query += ' ORDER BY li.id DESC';
    const [issues] = await db.query(query, params);
    res.json({ issues });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error fetching library issues' });
  }
};
