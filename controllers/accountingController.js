const db = require('../config/db');

// Get all ledger entries
exports.getLedger = async (req, res) => {
  const { type, category, startDate, endDate } = req.query;
  try {
    let query = 'SELECT * FROM accounts_ledger WHERE 1=1';
    const params = [];

    if (type) {
      query += ' AND type = ?';
      params.push(type);
    }
    if (category) {
      query += ' AND category = ?';
      params.push(category);
    }
    if (startDate) {
      query += ' AND date >= ?';
      params.push(startDate);
    }
    if (endDate) {
      query += ' AND date <= ?';
      params.push(endDate);
    }

    query += ' ORDER BY date DESC, id DESC';

    const [ledger] = await db.query(query, params);
    res.json({ ledger });
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
    await db.query(
      `INSERT INTO accounts_ledger (type, category, title, amount, date, description, payment_method, reference_no) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [type, category, title, amount, date, description || '', payment_method || 'Cash', reference_no || '']
    );
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
    const [incomeResult] = await db.query('SELECT SUM(amount) as total FROM accounts_ledger WHERE type = "Income"');
    const totalIncome = parseFloat(incomeResult[0].total || 0);

    // Total expenses
    const [expenseResult] = await db.query('SELECT SUM(amount) as total FROM accounts_ledger WHERE type = "Expense"');
    const totalExpense = parseFloat(expenseResult[0].total || 0);

    // Group by Category
    const [categoryGroup] = await db.query(
      'SELECT type, category, SUM(amount) as total FROM accounts_ledger GROUP BY type, category'
    );

    // Monthly income vs expense for chart
    const [monthlyStats] = await db.query(
      `SELECT type, MONTH(date) as month, SUM(amount) as total 
       FROM accounts_ledger 
       WHERE YEAR(date) = YEAR(CURDATE()) 
       GROUP BY type, MONTH(date)`
    );

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
