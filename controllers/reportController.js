const Student = require('../models/Student');
const User = require('../models/User');
const AccountsLedger = require('../models/AccountsLedger');
const FeeInvoice = require('../models/FeeInvoice');
const XLSX = require('xlsx');
const PDFDocument = require('pdfkit');

// Helper to filter dates by year and month
const getDateRangeFilter = (year, month, dateFieldName) => {
  const filter = {};
  if (year || month) {
    const y = year ? parseInt(year) : new Date().getFullYear();
    filter[dateFieldName] = {};
    if (month) {
      const m = parseInt(month) - 1; // 0-indexed in JS
      filter[dateFieldName].$gte = new Date(Date.UTC(y, m, 1, 0, 0, 0, 0));
      filter[dateFieldName].$lte = new Date(Date.UTC(y, m + 1, 0, 23, 59, 59, 999)); // Last day of month
    } else {
      filter[dateFieldName].$gte = new Date(Date.UTC(y, 0, 1, 0, 0, 0, 0));
      filter[dateFieldName].$lte = new Date(Date.UTC(y, 11, 31, 23, 59, 59, 999));
    }
  }
  return filter;
};

// Get Students JSON Report
exports.getStudentsReport = async (req, res) => {
  try {
    const { month, year } = req.query;
    const filter = { status: 'active' };
    
    const dateFilter = getDateRangeFilter(year, month, 'admission_date');
    Object.assign(filter, dateFilter);

    const students = await Student.find(filter)
      .populate('user', 'name email phone status')
      .populate('class', 'name')
      .populate('section', 'name')
      .populate('parent')
      .sort({ admission_date: -1 });

    const formattedStudents = students.map(student => ({
      roll_number: student.roll_number,
      admission_no: student.admission_number,
      name: student.user ? student.user.name : '',
      email: student.user ? student.user.email : '',
      phone: student.user ? student.user.phone : '',
      class_name: student.class ? student.class.name : '',
      section_name: student.section ? student.section.name : '',
      gender: student.gender || '',
      dob: student.dob,
      blood_group: student.blood_group || '',
      father_name: student.parent ? student.parent.father_name : '',
      admission_date: student.admission_date
    }));

    res.json({ success: true, data: formattedStudents });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error retrieving students report: ' + err.message });
  }
};

// Get Ledger JSON Report
exports.getLedgerReport = async (req, res) => {
  try {
    const { month, year } = req.query;
    const filter = {};

    const dateFilter = getDateRangeFilter(year, month, 'date');
    Object.assign(filter, dateFilter);

    const ledger = await AccountsLedger.find(filter).sort({ date: -1 });

    const formattedLedger = ledger.map(entry => ({
      id: entry._id.toString(),
      date: entry.date,
      type: entry.type,
      category: entry.category,
      title: entry.title,
      amount: entry.amount,
      description: entry.description || '',
      payment_method: entry.payment_method || 'Cash',
      reference_no: entry.reference || ''
    }));

    res.json({ success: true, data: formattedLedger });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error retrieving ledger report: ' + err.message });
  }
};

// Export Students to Excel
exports.exportStudentsExcel = async (req, res) => {
  try {
    const { month, year } = req.query;
    const filter = { status: 'active' };

    const dateFilter = getDateRangeFilter(year, month, 'admission_date');
    Object.assign(filter, dateFilter);

    const students = await Student.find(filter)
      .populate('user', 'name email phone')
      .populate('class', 'name')
      .populate('section', 'name')
      .populate('parent')
      .sort({ admission_date: -1 });

    const data = students.map(student => ({
      'Roll Number': student.roll_number,
      'Admission No': student.admission_number,
      'Name': student.user ? student.user.name : '',
      'Email': student.user ? student.user.email : '',
      'Phone': student.user ? student.user.phone : '',
      'Class': student.class ? student.class.name : '',
      'Section': student.section ? student.section.name : '',
      'Gender': student.gender || '',
      'DOB': student.dob ? new Date(student.dob).toLocaleDateString() : '',
      'Blood Group': student.blood_group || '',
      'Father Name': student.parent ? student.parent.father_name : '',
      'Admission Date': student.admission_date ? new Date(student.admission_date).toLocaleDateString() : ''
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
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
    const filter = {};

    const dateFilter = getDateRangeFilter(year, month, 'date');
    Object.assign(filter, dateFilter);

    const ledger = await AccountsLedger.find(filter).sort({ date: -1 });

    const data = ledger.map(entry => ({
      'Date': entry.date ? new Date(entry.date).toLocaleDateString() : '',
      'Type': entry.type,
      'Category': entry.category,
      'Title': entry.title,
      'Amount': entry.amount,
      'Description': entry.description || '',
      'Payment Method': entry.payment_method || 'Cash',
      'Ref No': entry.reference || ''
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
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
    const invoice = await FeeInvoice.findById(invoiceId)
      .populate({
        path: 'student',
        populate: [
          { path: 'user', select: 'name' },
          { path: 'class', select: 'name' },
          { path: 'section', select: 'name' },
          { path: 'parent' }
        ]
      });

    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    const doc = new PDFDocument({ margin: 50 });

    res.setHeader('Content-Disposition', `attachment; filename="Invoice_${invoice.invoice_number}.pdf"`);
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
    doc.text(`Invoice No: ${invoice.invoice_number}`);
    doc.text(`Date: ${new Date(invoice.issue_date).toLocaleDateString()}`);
    doc.text(`Due Date: ${new Date(invoice.due_date).toLocaleDateString()}`);
    doc.text(`Status: ${invoice.status.toUpperCase()}`);
    doc.moveDown(1);

    // Student Info
    doc.text(`Student Name: ${invoice.student && invoice.student.user ? invoice.student.user.name : ''}`);
    doc.text(`Roll Number: ${invoice.student ? invoice.student.roll_number : ''}`);
    doc.text(`Class: ${invoice.student && invoice.student.class ? invoice.student.class.name : ''} - ${invoice.student && invoice.student.section ? invoice.student.section.name : ''}`);
    if (invoice.student && invoice.student.parent && invoice.student.parent.father_name) {
      doc.text(`Guardian Name: ${invoice.student.parent.father_name}`);
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
    invoice.items.forEach(item => {
      doc.text(item.fee_type, 50, doc.y);
      doc.text(parseFloat(item.amount).toFixed(2), 400, doc.y);
      doc.moveDown(0.5);
    });

    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(0.5);

    // Totals
    doc.text('Total Invoice Amount:', 250, doc.y);
    doc.text(parseFloat(invoice.total).toFixed(2), 400, doc.y);
    doc.moveDown(0.5);
    doc.text('Total Paid Amount:', 250, doc.y);
    doc.text(parseFloat(invoice.paid_amount || 0).toFixed(2), 400, doc.y);
    doc.moveDown(0.5);
    
    const balance = parseFloat(invoice.total) - parseFloat(invoice.paid_amount || 0);
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
