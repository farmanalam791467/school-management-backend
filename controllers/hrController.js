const db = require('../config/db');
const bcrypt = require('bcryptjs');

// ==========================================================
// EMPLOYEES
// ==========================================================

// Get all employees
exports.getEmployees = async (req, res) => {
  const { department } = req.query;
  try {
    let query = `
      SELECT e.*, u.name, u.email, u.phone, u.role, u.status AS user_status
      FROM employees e
      JOIN users u ON e.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (department) {
      query += ' AND e.department = ?';
      params.push(department);
    }

    query += ' ORDER BY e.id DESC';
    const [employees] = await db.query(query, params);
    res.json({ employees });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error fetching employees' });
  }
};

// Create employee
exports.createEmployee = async (req, res) => {
  const { name, email, password, phone, role, employee_id, department, designation, salary } = req.body;
  if (!name || !email || !role || !employee_id || !department || !designation || !salary) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // 1. Create User
    const hashedPassword = await bcrypt.hash(password || 'staff123', 10);
    const [userResult] = await conn.query(
      'INSERT INTO users (name, email, password, role, phone, status) VALUES (?, ?, ?, ?, ?, "active")',
      [name, email, hashedPassword, role, phone]
    );
    const userId = userResult.insertId;

    // 2. Create Employee Profile
    const hireDate = new Date().toISOString().slice(0, 10);
    await conn.query(
      `INSERT INTO employees (user_id, employee_id, department, designation, salary, status, hire_date) 
       VALUES (?, ?, ?, ?, ?, 'active', ?)`,
      [userId, employee_id, department, designation, salary, hireDate]
    );

    await conn.commit();
    res.status(201).json({ message: 'Employee registered successfully' });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ message: 'Server error registering employee: ' + err.message });
  } finally {
    conn.release();
  }
};

// ==========================================================
// PAYROLL
// ==========================================================

// Get payroll list
exports.getPayroll = async (req, res) => {
  const { month, year } = req.query;
  if (!month || !year) {
    return res.status(400).json({ message: 'Month and Year are required' });
  }

  try {
    const [payroll] = await db.query(
      `SELECT p.*, e.employee_id as emp_code, e.department, e.designation, u.name as employee_name
       FROM employee_payroll p
       JOIN employees e ON p.employee_id = e.id
       JOIN users u ON e.user_id = u.id
       WHERE p.month = ? AND p.year = ?`,
      [month, year]
    );
    res.json({ payroll });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error fetching payroll' });
  }
};

// Bulk generate payroll for a month/year
exports.generatePayroll = async (req, res) => {
  const { month, year } = req.body;
  if (!month || !year) {
    return res.status(400).json({ message: 'Month and Year are required' });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // Fetch all active employees
    const [employees] = await conn.query('SELECT id, salary FROM employees WHERE status = "active"');
    
    let generatedCount = 0;
    for (const emp of employees) {
      const basicSalary = parseFloat(emp.salary);
      const allowance = 0.00;
      const deduction = 0.00;
      const netSalary = basicSalary + allowance - deduction;

      // Insert payroll record, ignore if already exists
      await conn.query(
        `INSERT IGNORE INTO employee_payroll (employee_id, month, year, basic_salary, allowance, deduction, net_salary, status) 
         VALUES (?, ?, ?, ?, ?, ?, ?, 'Unpaid')`,
        [emp.id, month, year, basicSalary, allowance, deduction, netSalary]
      );
      generatedCount++;
    }

    await conn.commit();
    res.json({ message: `Payroll generated for ${generatedCount} employees` });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ message: 'Server error generating payroll' });
  } finally {
    conn.release();
  }
};

// Pay salary (Updates status, triggers ledger expense logging via DB trigger)
exports.paySalary = async (req, res) => {
  const { payroll_id } = req.body;
  if (!payroll_id) {
    return res.status(400).json({ message: 'Payroll ID is required' });
  }

  try {
    const paymentDate = new Date().toISOString().slice(0, 10);
    // Update status to Paid (this will fire the after_payroll_payment_update trigger)
    const [result] = await db.query(
      'UPDATE employee_payroll SET status = "Paid", payment_date = ? WHERE id = ? AND status = "Unpaid"',
      [paymentDate, payroll_id]
    );

    if (result.affectedRows === 0) {
      return res.status(400).json({ message: 'Salary already paid or payroll record not found' });
    }

    res.json({ message: 'Salary payment processed and logged in ledger successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error processing salary payment' });
  }
};

// ==========================================================
// LEAVES
// ==========================================================

// Get leave requests (Teachers/Staff)
exports.getLeaves = async (req, res) => {
  try {
    let query = `
      SELECT l.*, u.name as employee_name, u.role as employee_role 
      FROM leaves l
      JOIN users u ON l.user_id = u.id
    `;
    const params = [];
    
    // If not admin, only show user's own leaves
    if (!['super_admin', 'school_admin', 'principal', 'vice_principal', 'hr'].includes(req.user.role)) {
      query += ' WHERE l.user_id = ?';
      params.push(req.user.id);
    }

    query += ' ORDER BY l.id DESC';
    const [leaves] = await db.query(query, params);
    res.json({ leaves });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error fetching leaves' });
  }
};

// Request a leave
exports.requestLeave = async (req, res) => {
  const { leave_type, start_date, end_date, reason } = req.body;
  if (!leave_type || !start_date || !end_date || !reason) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    await db.query(
      'INSERT INTO leaves (user_id, leave_type, start_date, end_date, reason, status) VALUES (?, ?, ?, ?, ?, "Pending")',
      [req.user.id, leave_type, start_date, end_date, reason]
    );
    res.status(201).json({ message: 'Leave request submitted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error requesting leave' });
  }
};

// Approve/Reject leave
exports.updateLeaveStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body; // Approved or Rejected
  if (!status || !['Approved', 'Rejected'].includes(status)) {
    return res.status(400).json({ message: 'Invalid status' });
  }

  try {
    await db.query(
      'UPDATE leaves SET status = ?, approved_by = ? WHERE id = ?',
      [status, req.user.id, id]
    );
    res.json({ message: `Leave request has been ${status.toLowerCase()}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error updating leave status' });
  }
};
