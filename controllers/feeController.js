const FeeInvoice = require('../models/FeeInvoice');
const FeeType = require('../models/FeeType');
const Student = require('../models/Student');
const User = require('../models/User');
const AccountsLedger = require('../models/AccountsLedger');

// Get fee types
exports.getFeeTypes = async (req, res) => {
  try {
    const types = await FeeType.find().sort({ created_at: -1 });
    const formattedTypes = types.map(t => ({
      id: t._id.toString(),
      name: t.name,
      code: t.code,
      description: t.description || '',
      amount: t.amount,
      due_date: t.due_date
    }));
    res.json({ feeTypes: formattedTypes });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error fetching fee types' });
  }
};

// Create fee type
exports.createFeeType = async (req, res) => {
  const { name, code, description, amount, due_date } = req.body;
  if (!name || !code || !amount || !due_date) {
    return res.status(400).json({ message: 'Name, code, amount, and due date are required' });
  }
  try {
    const newFeeType = new FeeType({
      name,
      code,
      description: description || '',
      amount: parseFloat(amount),
      due_date: new Date(due_date)
    });
    await newFeeType.save();
    res.status(201).json({ message: 'Fee type created successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error creating fee type: ' + err.message });
  }
};

// Get fee invoices
exports.getInvoices = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;
  const status = req.query.status || '';
  const search = req.query.search || '';

  try {
    const filter = {};
    if (status) {
      filter.status = status;
    }

    if (search) {
      const matchingUsers = await User.find({
        name: { $regex: search, $options: 'i' }
      });
      const userIds = matchingUsers.map(u => u._id);

      const matchingStudents = await Student.find({
        $or: [
          { user: { $in: userIds } },
          { roll_number: { $regex: search, $options: 'i' } }
        ]
      });
      const studentIds = matchingStudents.map(s => s._id);

      filter.$or = [
        { student: { $in: studentIds } },
        { invoice_number: { $regex: search, $options: 'i' } }
      ];
    }

    const total = await FeeInvoice.countDocuments(filter);

    const invoices = await FeeInvoice.find(filter)
      .populate({
        path: 'student',
        populate: [
          { path: 'user', select: 'name' },
          { path: 'class', select: 'name' },
          { path: 'section', select: 'name' }
        ]
      })
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit);

    const formattedInvoices = invoices.map(inv => ({
      id: inv._id.toString(),
      student_id: inv.student ? inv.student._id.toString() : null,
      invoice_no: inv.invoice_number,
      date: inv.issue_date,
      due_date: inv.due_date,
      total_amount: inv.total,
      discount: inv.discount || 0,
      paid_amount: inv.paid_amount || 0,
      status: inv.status,
      student_name: inv.student && inv.student.user ? inv.student.user.name : '',
      roll_number: inv.student ? inv.student.roll_number : '',
      class_name: inv.student && inv.student.class ? inv.student.class.name : '',
      section_name: inv.student && inv.student.section ? inv.student.section.name : ''
    }));

    res.json({
      invoices: formattedInvoices,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error fetching invoices' });
  }
};

// Get invoice by ID
exports.getInvoiceById = async (req, res) => {
  const { id } = req.params;
  try {
    const invoice = await FeeInvoice.findById(id)
      .populate({
        path: 'student',
        populate: [
          { path: 'user', select: 'name email phone avatar' },
          { path: 'class', select: 'name' },
          { path: 'section', select: 'name' },
          { path: 'parent' }
        ]
      });

    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    const formattedInvoice = {
      id: invoice._id.toString(),
      student_id: invoice.student ? invoice.student._id.toString() : null,
      invoice_no: invoice.invoice_number,
      date: invoice.issue_date,
      due_date: invoice.due_date,
      total_amount: invoice.total,
      discount: invoice.discount || 0,
      paid_amount: invoice.paid_amount || 0,
      status: invoice.status,
      student_name: invoice.student && invoice.student.user ? invoice.student.user.name : '',
      student_email: invoice.student && invoice.student.user ? invoice.student.user.email : '',
      student_phone: invoice.student && invoice.student.user ? invoice.student.user.phone : '',
      roll_number: invoice.student ? invoice.student.roll_number : '',
      admission_no: invoice.student ? invoice.student.admission_number : '',
      class_name: invoice.student && invoice.student.class ? invoice.student.class.name : '',
      section_name: invoice.student && invoice.student.section ? invoice.student.section.name : '',
      father_name: invoice.student && invoice.student.parent ? invoice.student.parent.father_name : '',
      father_phone: invoice.student && invoice.student.parent ? invoice.student.parent.father_phone : ''
    };

    const details = invoice.items.map((item, idx) => ({
      id: item._id.toString(),
      invoice_id: invoice._id.toString(),
      fee_name: item.fee_type,
      amount: item.amount
    }));

    const payments = invoice.payments.map(pay => ({
      id: pay._id.toString(),
      invoice_id: invoice._id.toString(),
      amount_paid: pay.amount,
      payment_method: pay.method,
      transaction_no: pay.reference || '',
      payment_date: pay.payment_date
    }));

    res.json({
      invoice: formattedInvoice,
      details,
      payments
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Create a single invoice
exports.createInvoice = async (req, res) => {
  const { student_id, fee_types } = req.body; // fee_types: Array of { fee_type_id, amount }
  if (!student_id || !fee_types || !Array.isArray(fee_types) || fee_types.length === 0) {
    return res.status(400).json({ message: 'Student ID and fee items are required' });
  }

  try {
    const totalAmount = fee_types.reduce((acc, item) => acc + parseFloat(item.amount), 0);
    const invoiceNo = `INV-${Date.now()}`;
    const issueDate = new Date();
    const dueDate = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000); // 15 days due date

    const items = [];
    for (const item of fee_types) {
      const ft = await FeeType.findById(item.fee_type_id);
      items.push({
        fee_type: ft ? ft.name : 'General School Fee',
        amount: parseFloat(item.amount)
      });
    }

    const newInvoice = new FeeInvoice({
      student: student_id,
      invoice_number: invoiceNo,
      issue_date: issueDate,
      due_date: dueDate,
      subtotal: totalAmount,
      total: totalAmount,
      paid_amount: 0,
      status: 'Unpaid',
      items
    });
    await newInvoice.save();

    res.status(201).json({ message: 'Invoice created successfully', invoiceId: newInvoice._id.toString(), invoiceNo });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error creating invoice: ' + err.message });
  }
};

// Bulk generate invoices for a Class/Section
exports.bulkGenerateInvoices = async (req, res) => {
  const { class_id, section_id, fee_type_id } = req.body;
  if (!class_id || !section_id || !fee_type_id) {
    return res.status(400).json({ message: 'Class, Section, and Fee Type are required' });
  }

  try {
    const feeType = await FeeType.findById(fee_type_id);
    if (!feeType) {
      return res.status(404).json({ message: 'Fee type not found' });
    }

    const students = await Student.find({
      class: class_id,
      section: section_id,
      status: 'active'
    });

    if (students.length === 0) {
      return res.status(404).json({ message: 'No active students found in the selected class and section' });
    }

    let createdCount = 0;
    for (const student of students) {
      const invoiceNo = `INV-B${class_id.slice(-4)}${section_id.slice(-4)}-${student.roll_number}-${Date.now().toString().slice(-4)}`;

      const newInvoice = new FeeInvoice({
        student: student._id,
        invoice_number: invoiceNo,
        issue_date: new Date(),
        due_date: feeType.due_date,
        subtotal: feeType.amount,
        total: feeType.amount,
        paid_amount: 0,
        status: 'Unpaid',
        items: [{
          fee_type: feeType.name,
          amount: feeType.amount
        }]
      });
      await newInvoice.save();
      createdCount++;
    }

    res.json({ message: `Bulk invoices generated successfully for ${createdCount} students` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error generating bulk invoices: ' + err.message });
  }
};

// Process Payment (Collect Fee)
exports.collectFee = async (req, res) => {
  const { invoice_id, amount_paid, payment_method, transaction_no } = req.body;
  if (!invoice_id || !amount_paid || !payment_method) {
    return res.status(400).json({ message: 'Invoice ID, amount, and payment method are required' });
  }

  try {
    const invoice = await FeeInvoice.findById(invoice_id);
    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    const newPaidAmount = (invoice.paid_amount || 0) + parseFloat(amount_paid);
    const totalAmount = invoice.total;

    let status = 'Partially Paid';
    if (newPaidAmount >= totalAmount) {
      status = 'Paid';
    }

    invoice.paid_amount = newPaidAmount;
    invoice.status = status;

    const txnNo = transaction_no || `TXN-M${Date.now()}`;
    const paymentDate = new Date();

    invoice.payments.push({
      amount: parseFloat(amount_paid),
      method: payment_method,
      reference: txnNo,
      payment_date: paymentDate
    });

    await invoice.save();

    // Manually insert log into AccountsLedger (Replacing SQL Trigger behavior)
    const ledgerEntry = new AccountsLedger({
      date: paymentDate,
      type: 'Income',
      category: 'Student Fee',
      title: `Fee Payment - Invoice #${invoice.invoice_number}`,
      description: `Collected fee for student. Method: ${payment_method}`,
      amount: parseFloat(amount_paid),
      reference: txnNo
    });
    await ledgerEntry.save();

    res.json({ message: 'Payment recorded successfully', invoiceStatus: status, transactionNo: txnNo });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error collecting fee' });
  }
};
