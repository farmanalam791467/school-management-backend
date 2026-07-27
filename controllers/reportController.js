const db = require('../config/db');
const XLSX = require('xlsx');
const PDFDocument = require('pdfkit');

// Get Students JSON Report
exports.getStudentsReport = async (req, res) => {
  try {
    const { month, year } = req.query;
    let query = `SELECT roll_number, admission_no, name, email, phone, class_name, section_name, gender, dob, blood_group, father_name, admission_date 
                 FROM view_student_profiles 
                 WHERE user_status = "active"`;
    const params = [];
    if (year) {
      query += ` AND YEAR(admission_date) = ?`;
      params.push(parseInt(year));
    }
    if (month) {
      query += ` AND MONTH(admission_date) = ?`;
      params.push(parseInt(month));
    }
    query += ` ORDER BY admission_date DESC`;

    const [students] = await db.query(query, params);
    res.json({ success: true, data: students });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error retrieving students report: ' + err.message });
  }
};

// Get Ledger JSON Report
exports.getLedgerReport = async (req, res) => {
  try {
    const { month, year } = req.query;
    let query = `SELECT id, date, type, category, title, amount, description, payment_method, reference_no 
                 FROM accounts_ledger 
                 WHERE 1=1`;
    const params = [];
    if (year) {
      query += ` AND YEAR(date) = ?`;
      params.push(parseInt(year));
    }
    if (month) {
      query += ` AND MONTH(date) = ?`;
      params.push(parseInt(month));
    }
    query += ` ORDER BY date DESC`;

    const [ledger] = await db.query(query, params);
    res.json({ success: true, data: ledger });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error retrieving ledger report: ' + err.message });
  }
};

// Export Students to Excel
exports.exportStudentsExcel = async (req, res) => {
  try {
    const { month, year } = req.query;
    let query = `SELECT roll_number as 'Roll Number', admission_no as 'Admission No', name as 'Name', 
                        email as 'Email', phone as 'Phone', class_name as 'Class', section_name as 'Section', 
                        gender as 'Gender', dob as 'DOB', blood_group as 'Blood Group', father_name as 'Father Name',
                        admission_date as 'Admission Date'
                 FROM view_student_profiles 
                 WHERE user_status = "active"`;
    const params = [];
    if (year) {
      query += ` AND YEAR(admission_date) = ?`;
      params.push(parseInt(year));
    }
    if (month) {
      query += ` AND MONTH(admission_date) = ?`;
      params.push(parseInt(month));
    }
    query += ` ORDER BY admission_date DESC`;

    const [students] = await db.query(query, params);

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(students);
    XLSX.utils.book_append_sheet(wb, ws, 'Active Students');
    
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Disposition', 'attachment; filename="students_list.xlsx"');
    res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error exporting Excel: ' + err.message });
  }
};

// Export Ledger to Excel
exports.exportLedgerExcel = async (req, res) => {
  try {
    const { month, year } = req.query;
    let query = `SELECT date as 'Date', type as 'Type', category as 'Category', title as 'Title', 
                        amount as 'Amount', description as 'Description', payment_method as 'Payment Method', reference_no as 'Ref No'
                 FROM accounts_ledger 
                 WHERE 1=1`;
    const params = [];
    if (year) {
      query += ` AND YEAR(date) = ?`;
      params.push(parseInt(year));
    }
    if (month) {
      query += ` AND MONTH(date) = ?`;
      params.push(parseInt(month));
    }
    query += ` ORDER BY date DESC`;

    const [ledger] = await db.query(query, params);

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(ledger);
    XLSX.utils.book_append_sheet(wb, ws, 'Financial Ledger');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Disposition', 'attachment; filename="financial_ledger.xlsx"');
    res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error exporting Excel' });
  }
};

// Export Fee Invoice to PDF Receipt
exports.exportInvoicePDF = async (req, res) => {
  const { invoiceId } = req.params;
  try {
    const [invoices] = await db.query(
      `SELECT fi.*, u.name as student_name, s.roll_number, c.name as class_name, sec.name as section_name,
              p.father_name, p.father_phone
       FROM fee_invoices fi
       JOIN students s ON fi.student_id = s.id
       JOIN users u ON s.user_id = u.id
       JOIN classes c ON s.class_id = c.id
       JOIN sections sec ON s.section_id = sec.id
       LEFT JOIN parents p ON s.parent_id = p.id
       WHERE fi.id = ?`,
      [invoiceId]
    );

    if (invoices.length === 0) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    const invoice = invoices[0];

    // Fetch details
    const [details] = await db.query(
      `SELECT fid.*, ft.name as fee_name 
       FROM fee_invoice_details fid
       JOIN fee_types ft ON fid.fee_type_id = ft.id
       WHERE fid.invoice_id = ?`,
      [invoiceId]
    );

    // Create PDF
    const doc = new PDFDocument({ margin: 50 });

    res.setHeader('Content-Disposition', `attachment; filename="Invoice_${invoice.invoice_no}.pdf"`);
    res.type('application/pdf');
    doc.pipe(res);

    // Header
    doc.fontSize(20).text('Secondary School of Modern Education', { align: 'center' });
    doc.fontSize(10).text('123 Education Colony, New Delhi, India', { align: 'center' });
    doc.text('Phone: +91 98765 43210 | Email: billing@eskooly.in', { align: 'center' });
    doc.moveDown(2);

    // Invoice Meta
    doc.fontSize(14).text('FEE RECEIPT / INVOICE', { underline: true });
    doc.moveDown(1);
    doc.fontSize(10);
    doc.text(`Invoice No: ${invoice.invoice_no}`);
    doc.text(`Date: ${new Date(invoice.date).toLocaleDateString()}`);
    doc.text(`Due Date: ${new Date(invoice.due_date).toLocaleDateString()}`);
    doc.text(`Status: ${invoice.status.toUpperCase()}`);
    doc.moveDown(1);

    // Student Info
    doc.text(`Student Name: ${invoice.student_name}`);
    doc.text(`Roll Number: ${invoice.roll_number}`);
    doc.text(`Class: ${invoice.class_name} - ${invoice.section_name}`);
    if (invoice.father_name) {
      doc.text(`Guardian Name: ${invoice.father_name}`);
    }
    doc.moveDown(2);

    // Table Header
    doc.fontSize(11).text('Fee Description', 50, doc.y, { bold: true });
    doc.text('Amount (INR \u20B9)', 400, doc.y, { bold: true });
    doc.moveDown(0.5);
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(0.5);

    // Table Body
    doc.fontSize(10);
    details.forEach(item => {
      doc.text(item.fee_name, 50, doc.y);
      doc.text(parseFloat(item.amount).toFixed(2), 400, doc.y);
      doc.moveDown(0.5);
    });

    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(0.5);

    // Totals
    doc.text('Total Invoice Amount:', 250, doc.y);
    doc.text(parseFloat(invoice.total_amount).toFixed(2), 400, doc.y);
    doc.moveDown(0.5);
    doc.text('Total Paid Amount:', 250, doc.y);
    doc.text(parseFloat(invoice.paid_amount).toFixed(2), 400, doc.y);
    doc.moveDown(0.5);
    
    const balance = parseFloat(invoice.total_amount) - parseFloat(invoice.paid_amount);
    doc.fontSize(11).text('Balance Due:', 250, doc.y, { bold: true });
    doc.text(balance.toFixed(2), 400, doc.y, { bold: true });

    doc.moveDown(3);
    doc.fontSize(10).text('Thank you for your payment!', { align: 'center', italic: true });

    doc.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error generating PDF: ' + err.message });
  }
};
