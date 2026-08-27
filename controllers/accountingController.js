const AccountsLedger = require('../models/AccountsLedger');

// Get all ledger entries
exports.getLedger = async (req, res) => {
  const { type, category, startDate, endDate } = req.query;
  try {
    const filter = {};

    if (type) {
      filter.type = type;
    }
    if (category) {
      filter.category = category;
    }
    if (startDate) {
      filter.date = filter.date || {};
      filter.date.$gte = new Date(startDate);
    }
    if (endDate) {
      filter.date = filter.date || {};
      filter.date.$lte = new Date(endDate);
    }

    const ledger = await AccountsLedger.find(filter).sort({ date: -1, created_at: -1 });

    const formattedLedger = ledger.map(entry => ({
      id: entry._id.toString(),
      type: entry.type,
      category: entry.category,
      title: entry.title,
      description: entry.description || '',
      amount: entry.amount,
      date: entry.date,
      reference_no: entry.reference || '',
      file_path: entry.file_path || ''
    }));

    res.json({ ledger: formattedLedger });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error fetching ledger' });
  }
};

// Create a ledger entry (manual transaction)
exports.createLedgerEntry = async (req, res) => {
  const { type, category, title, amount, date, description, payment_method, reference_no } = req.body;
  if (!type || !category || !title || !amount || !date) {
    return res.status(400).json({ message: 'Type, category, title, amount, and date are required' });
  }

  try {
    const newEntry = new AccountsLedger({
      type,
      category,
      title,
      amount: parseFloat(amount),
      date: new Date(date),
      description: description || '',
      reference: reference_no || '',
      file_path: '' // empty by default
    });
    await newEntry.save();

    res.status(201).json({ message: 'Ledger entry recorded successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error recording transaction' });
  }
};

// Get Financial Summary (Balance sheet & Cash book totals)
exports.getFinancialSummary = async (req, res) => {
  try {
    // Total income
    const incomeResult = await AccountsLedger.aggregate([
      { $match: { type: 'Income' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const totalIncome = incomeResult.length > 0 ? incomeResult[0].total : 0;

    // Total expenses
    const expenseResult = await AccountsLedger.aggregate([
      { $match: { type: 'Expense' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const totalExpense = expenseResult.length > 0 ? expenseResult[0].total : 0;

    // Group by Category
    const categoryGroupRaw = await AccountsLedger.aggregate([
      { $group: { _id: { type: '$type', category: '$category' }, total: { $sum: '$amount' } } }
    ]);
    const categoryGroup = categoryGroupRaw.map(item => ({
      type: item._id.type,
      category: item._id.category,
      total: item.total
    }));

    // Monthly income vs expense for chart (Current Year)
    const currentYear = new Date().getFullYear();
    const startOfYear = new Date(Date.UTC(currentYear, 0, 1, 0, 0, 0, 0));
    const endOfYear = new Date(Date.UTC(currentYear, 11, 31, 23, 59, 59, 999));

    const monthlyStatsRaw = await AccountsLedger.aggregate([
      { $match: { date: { $gte: startOfYear, $lte: endOfYear } } },
      {
        $group: {
          _id: {
            type: '$type',
            month: { $month: '$date' }
          },
          total: { $sum: '$amount' }
        }
      }
    ]);
    const monthlyStats = monthlyStatsRaw.map(item => ({
      type: item._id.type,
      month: item._id.month,
      total: item.total
    }));

    res.json({
      summary: {
        totalIncome,
        totalExpense,
        netProfit: totalIncome - totalExpense
      },
      categoryGroup,
      monthlyStats
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error generating financial summary' });
  }
};
