const Employee = require('../models/Employee');
const User = require('../models/User');
const Leave = require('../models/Leave');
const AccountsLedger = require('../models/AccountsLedger');
const bcrypt = require('bcryptjs');

// ==========================================================
// EMPLOYEES
// ==========================================================

// Get all employees
exports.getEmployees = async (req, res) => {
  const { department } = req.query;
  try {
    const filter = {};
    if (department) {
      filter.department = department;
    }

    const employees = await Employee.find(filter).populate('user').sort({ created_at: -1 });

    const formattedEmployees = employees.map(e => ({
      id: e._id.toString(),
      user_id: e.user ? e.user._id.toString() : null,
      employee_id: e.employee_id || '',
      department: e.department || '',
      designation: e.designation || '',
      salary: e.salary || 0,
      status: e.status || 'active',
      joining_date: e.joining_date,
      name: e.user ? e.user.name : '',
      email: e.user ? e.user.email : '',
      phone: e.user ? e.user.phone : '',
      role: e.user ? e.user.role : '',
      user_status: e.user ? e.user.status : 'inactive'
    }));

    res.json({ employees: formattedEmployees });
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

  try {
    // 1. Create User
    const hashedPassword = await bcrypt.hash(password || 'staff123', 10);
    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      role,
      phone,
      status: 'active'
    });
    await newUser.save();

    // 2. Create Employee Profile
    const hireDate = new Date();
    const newEmployee = new Employee({
      user: newUser._id,
      employee_id,
      department,
      designation,
      salary: parseFloat(salary),
      status: 'active',
      joining_date: hireDate
    });
    await newEmployee.save();

    res.status(201).json({ message: 'Employee registered successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error registering employee: ' + err.message });
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
    const employees = await Employee.find({}).populate('user', 'name');
    
    const payroll = [];
    employees.forEach(emp => {
      const p = emp.payrolls.find(item => item.month === month && item.year === year);
      if (p) {
        payroll.push({
          id: p._id.toString(),
          employee_id: emp._id.toString(),
          month: p.month,
          year: p.year,
          basic_salary: p.basic_salary,
          allowance: p.allowance || 0,
          deduction: p.deduction || 0,
          net_salary: p.net_salary,
          status: p.status,
          payment_date: p.payment_date || null,
          emp_code: emp.employee_id || '',
          department: emp.department,
          designation: emp.designation,
          employee_name: emp.user ? emp.user.name : ''
        });
      }
    });

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

  try {
    const employees = await Employee.find({ status: 'active' });
    
    let generatedCount = 0;
    for (const emp of employees) {
      const alreadyExists = emp.payrolls.some(p => p.month === month && p.year === year);
      if (!alreadyExists) {
        const basicSalary = parseFloat(emp.salary || 0);
        const allowance = 0.00;
        const deduction = 0.00;
        const netSalary = basicSalary + allowance - deduction;

        emp.payrolls.push({
          month,
          year,
          basic_salary: basicSalary,
          allowance,
          deduction,
          net_salary: netSalary,
          status: 'Unpaid'
        });
        await emp.save();
        generatedCount++;
      }
    }

    res.json({ message: `Payroll generated for ${generatedCount} employees` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error generating payroll' });
  }
};

// Pay salary (Updates status, manually logs expense in AccountsLedger)
exports.paySalary = async (req, res) => {
  const { payroll_id } = req.body;
  if (!payroll_id) {
    return res.status(400).json({ message: 'Payroll ID is required' });
  }

  try {
    const employee = await Employee.findOne({ 'payrolls._id': payroll_id }).populate('user', 'name');
    if (!employee) {
      return res.status(404).json({ message: 'Payroll record not found' });
    }

    const p = employee.payrolls.id(payroll_id);
    if (!p) {
      return res.status(404).json({ message: 'Payroll record not found' });
    }

    if (p.status === 'Paid') {
      return res.status(400).json({ message: 'Salary already paid' });
    }

    const paymentDate = new Date();
    p.status = 'Paid';
    p.payment_date = paymentDate;
    await employee.save();

    // Manually log salary disbursement as an Expense in AccountsLedger (Replacing SQL Trigger behavior)
    const ledgerEntry = new AccountsLedger({
      date: paymentDate,
      type: 'Expense',
      category: 'Salary',
      title: `Salary Disbursement - ${employee.user ? employee.user.name : 'Staff'} (${p.month}/${p.year})`,
      description: `Payroll basic salary payment.`,
      amount: p.net_salary
    });
    await ledgerEntry.save();

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
    const filter = {};
    
    // If not admin/HR, only show user's own leaves
    if (!['super_admin', 'school_admin', 'principal', 'vice_principal', 'hr'].includes(req.user.role)) {
      filter.user = req.user.id;
    }

    const leaves = await Leave.find(filter).populate('user', 'name role').sort({ created_at: -1 });

    const formattedLeaves = leaves.map(l => ({
      id: l._id.toString(),
      user_id: l.user ? l.user._id.toString() : null,
      leave_type: l.leave_type,
      start_date: l.start_date,
      end_date: l.end_date,
      reason: l.reason,
      status: l.status,
      approved_by: l.approved_by ? l.approved_by.toString() : null,
      employee_name: l.user ? l.user.name : '',
      employee_role: l.user ? l.user.role : ''
    }));

    res.json({ leaves: formattedLeaves });
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
    const newLeave = new Leave({
      user: req.user.id,
      leave_type,
      start_date: new Date(start_date),
      end_date: new Date(end_date),
      reason,
      status: 'Pending'
    });
    await newLeave.save();

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
    const leave = await Leave.findById(id);
    if (!leave) {
      return res.status(404).json({ message: 'Leave request not found' });
    }

    leave.status = status;
    leave.approved_by = req.user.id;
    await leave.save();

    res.json({ message: `Leave request has been ${status.toLowerCase()}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error updating leave status' });
  }
};
