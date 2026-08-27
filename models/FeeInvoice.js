const mongoose = require('mongoose');

const invoiceItemSchema = new mongoose.Schema({
  fee_type: { type: String, required: true },
  amount: { type: Number, required: true }
});

const paymentSchema = new mongoose.Schema({
  payment_date: { type: Date, default: Date.now },
  amount: { type: Number, required: true },
  method: { 
    type: String, 
    enum: ['Cash', 'Card', 'Bank Transfer', 'Online'], 
    default: 'Cash' 
  },
  reference: { type: String },
  note: { type: String }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

const feeInvoiceSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  invoice_number: {
    type: String,
    required: true,
    unique: true
  },
  issue_date: {
    type: Date,
    required: true
  },
  due_date: {
    type: Date,
    required: true
  },
  subtotal: {
    type: Number,
    required: true
  },
  discount: {
    type: Number,
    default: 0
  },
  tax: {
    type: Number,
    default: 0
  },
  total: {
    type: Number,
    required: true
  },
  paid_amount: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['Paid', 'Unpaid', 'Partially Paid'],
    default: 'Unpaid'
  },
  items: [invoiceItemSchema],
  payments: [paymentSchema]
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

module.exports = mongoose.model('FeeInvoice', feeInvoiceSchema);
