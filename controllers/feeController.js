const db = require('../config/db');

// Get fee types
exports.getFeeTypes = async (req, res) => {
  try {
    const [types] = await db.query('SELECT * FROM fee_types ORDER BY id DESC');
    res.json({ feeTypes: types });
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
    await db.query(
      'INSERT INTO fee_types (name, code, description, amount, due_date) VALUES (?, ?, ?, ?, ?)',
      [name, code, description || '', amount, due_date]
    );
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
  const offset = (page - 1) * limit;
  const status = req.query.status || '';
  const search = req.query.search || '';

  try {
    let countQuery = `
      SELECT COUNT(*) as total 
      FROM fee_invoices fi
      JOIN students s ON fi.student_id = s.id
      JOIN users u ON s.user_id = u.id
      WHERE 1=1
    `;
    let dataQuery = `
      SELECT fi.*, u.name as student_name, s.roll_number, c.name as class_name, sec.name as section_name
      FROM fee_invoices fi
      JOIN students s ON fi.student_id = s.id
      JOIN users u ON s.user_id = u.id
      JOIN classes c ON s.class_id = c.id
      JOIN sections sec ON s.section_id = sec.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      countQuery += ' AND fi.status = ?';
      dataQuery += ' AND fi.status = ?';
      params.push(status);
    }

    if (search) {
      countQuery += ' AND (u.name LIKE ? OR fi.invoice_no LIKE ? OR s.roll_number LIKE ?)';
      dataQuery += ' AND (u.name LIKE ? OR fi.invoice_no LIKE ? OR s.roll_number LIKE ?)';
      const searchWild = `%${search}%`;
      params.push(searchWild, searchWild, searchWild);
    }

    const [counts] = await db.query(countQuery, params);
    const total = counts[0].total;

    dataQuery += ' ORDER BY fi.id DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [invoices] = await db.query(dataQuery, params);

    res.json({
      invoices,
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
    const [invoices] = await db.query(
      `SELECT fi.*, u.name as student_name, u.email as student_email, u.phone as student_phone, 
              s.roll_number, s.admission_no, c.name as class_name, sec.name as section_name,
              p.father_name, p.father_phone
       FROM fee_invoices fi
       JOIN students s ON fi.student_id = s.id
       JOIN users u ON s.user_id = u.id
       JOIN classes c ON s.class_id = c.id
       JOIN sections sec ON s.section_id = sec.id
       LEFT JOIN parents p ON s.parent_id = p.id
       WHERE fi.id = ?`,
      [id]
    );

    if (invoices.length === 0) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    // Fetch invoice details (items)
    const [details] = await db.query(
      `SELECT fid.*, ft.name as fee_name, ft.code as fee_code 
       FROM fee_invoice_details fid
       JOIN fee_types ft ON fid.fee_type_id = ft.id
       WHERE fid.invoice_id = ?`,
      [id]
    );

    // Fetch payments made for this invoice
    const [payments] = await db.query(
      'SELECT * FROM fee_payments WHERE invoice_id = ? ORDER BY id DESC',
      [id]
    );

    res.json({
      invoice: invoices[0],
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

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // Calculate total amount
    const totalAmount = fee_types.reduce((acc, item) => acc + parseFloat(item.amount), 0);
    const invoiceNo = `INV-${Date.now()}`;
    const date = new Date().toISOString().slice(0, 10);
    // Due date is set to 15 days from now
    const dueDate = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    // Insert Invoice
    const [invoiceResult] = await conn.query(
      `INSERT INTO fee_invoices (student_id, invoice_no, date, due_date, total_amount, discount, fine, paid_amount, status)
       VALUES (?, ?, ?, ?, ?, 0.00, 0.00, 0.00, 'Unpaid')`,
      [student_id, invoiceNo, date, dueDate, totalAmount]
    );
    const invoiceId = invoiceResult.insertId;

    // Insert Details
    for (const item of fee_types) {
      await conn.query(
        'INSERT INTO fee_invoice_details (invoice_id, fee_type_id, amount) VALUES (?, ?, ?)',
        [invoiceId, item.fee_type_id, item.amount]
      );
    }

    await conn.commit();
    res.status(201).json({ message: 'Invoice created successfully', invoiceId, invoiceNo });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ message: 'Server error creating invoice: ' + err.message });
  } finally {
    conn.release();
  }
};

// Bulk generate invoices for a Class/Section
exports.bulkGenerateInvoices = async (req, res) => {
  const { class_id, section_id, fee_type_id } = req.body;
  if (!class_id || !section_id || !fee_type_id) {
    return res.status(400).json({ message: 'Class, Section, and Fee Type are required' });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // 1. Get Fee Type details
    const [types] = await conn.query('SELECT amount, due_date FROM fee_types WHERE id = ?', [fee_type_id]);
    if (types.length === 0) {
      return res.status(404).json({ message: 'Fee type not found' });
    }
    const feeAmount = types[0].amount;
    const dueDate = types[0].due_date;
    const date = new Date().toISOString().slice(0, 10);

    // 2. Get all students in the class/section
    const [students] = await conn.query(
      'SELECT id FROM students WHERE class_id = ? AND section_id = ? AND status = "active"',
      [class_id, section_id]
    );

    if (students.length === 0) {
      return res.status(404).json({ message: 'No active students found in the selected class and section' });
    }

    // 3. Create invoices
    let createdCount = 0;
    for (const student of students) {
      const invoiceNo = `INV-B${class_id}${section_id}-${student.id}-${Date.now().toString().slice(-6)}`;

      // Insert Invoice
      const [invoiceResult] = await conn.query(
        `INSERT INTO fee_invoices (student_id, invoice_no, date, due_date, total_amount, status)
         VALUES (?, ?, ?, ?, ?, 'Unpaid')`,
        [student.id, invoiceNo, date, dueDate, feeAmount]
      );
      const invoiceId = invoiceResult.insertId;

      // Insert Details
      await conn.query(
        'INSERT INTO fee_invoice_details (invoice_id, fee_type_id, amount) VALUES (?, ?, ?)',
        [invoiceId, fee_type_id, feeAmount]
      );

      createdCount++;
    }

    await conn.commit();
    res.json({ message: `Bulk invoices generated successfully for ${createdCount} students` });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ message: 'Server error generating bulk invoices: ' + err.message });
  } finally {
    conn.release();
  }
};

// Process Payment (Collect Fee)
exports.collectFee = async (req, res) => {
  const { invoice_id, amount_paid, payment_method, transaction_no } = req.body;
  if (!invoice_id || !amount_paid || !payment_method) {
    return res.status(400).json({ message: 'Invoice ID, amount, and payment method are required' });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // 1. Fetch invoice details
    const [invoices] = await conn.query('SELECT total_amount, paid_amount, status FROM fee_invoices WHERE id = ?', [invoice_id]);
    if (invoices.length === 0) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    const invoice = invoices[0];
    const newPaidAmount = parseFloat(invoice.paid_amount) + parseFloat(amount_paid);
    const totalAmount = parseFloat(invoice.total_amount);

    let status = 'Partially Paid';
    if (newPaidAmount >= totalAmount) {
      status = 'Paid';
    }

    // 2. Update Invoice
    await conn.query(
      'UPDATE fee_invoices SET paid_amount = ?, status = ? WHERE id = ?',
      [newPaidAmount, status, invoice_id]
    );

    // 3. Insert Payment Record (triggers accounts ledger log via DB trigger)
    const paymentDate = new Date().toISOString().slice(0, 10);
    const txnNo = transaction_no || `TXN-M${Date.now()}`;

    await conn.query(
      `INSERT INTO fee_payments (invoice_id, amount_paid, payment_method, transaction_no, payment_date)
       VALUES (?, ?, ?, ?, ?)`,
      [invoice_id, amount_paid, payment_method, txnNo, paymentDate]
    );

    await conn.commit();
    res.json({ message: 'Payment recorded successfully', invoiceStatus: status, transactionNo: txnNo });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ message: 'Server error collecting fee' });
  } finally {
    conn.release();
  }
};
