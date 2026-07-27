CREATE DATABASE IF NOT EXISTS eskooly_clone;
USE eskooly_clone;

-- Drop tables if they exist (in reverse order of dependencies)
SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS events;
DROP TABLE IF EXISTS chats;
DROP TABLE IF EXISTS notices;
DROP TABLE IF EXISTS leaves;
DROP TABLE IF EXISTS employee_payroll;
DROP TABLE IF EXISTS employees;
DROP TABLE IF EXISTS student_hostel;
DROP TABLE IF EXISTS hostel_rooms;
DROP TABLE IF EXISTS hostels;
DROP TABLE IF EXISTS student_transport;
DROP TABLE IF EXISTS transport_pickup_points;
DROP TABLE IF EXISTS transport_routes;
DROP TABLE IF EXISTS transport_vehicles;
DROP TABLE IF EXISTS library_issues;
DROP TABLE IF EXISTS library_books;
DROP TABLE IF EXISTS accounts_ledger;
DROP TABLE IF EXISTS fee_payments;
DROP TABLE IF EXISTS fee_invoice_details;
DROP TABLE IF EXISTS fee_invoices;
DROP TABLE IF EXISTS fee_types;
DROP TABLE IF EXISTS grades;
DROP TABLE IF EXISTS exam_marks;
DROP TABLE IF EXISTS exam_answers;
DROP TABLE IF EXISTS exam_submissions;
DROP TABLE IF EXISTS exam_questions;
DROP TABLE IF EXISTS exams;
DROP TABLE IF EXISTS assignment_submissions;
DROP TABLE IF EXISTS assignments;
DROP TABLE IF EXISTS homework_submissions;
DROP TABLE IF EXISTS homework;
DROP TABLE IF EXISTS timetables;
DROP TABLE IF EXISTS attendance;
DROP TABLE IF EXISTS teachers;
DROP TABLE IF EXISTS students;
DROP TABLE IF EXISTS parents;
DROP TABLE IF EXISTS class_subjects;
DROP TABLE IF EXISTS subjects;
DROP TABLE IF EXISTS sections;
DROP TABLE IF EXISTS classes;
DROP TABLE IF EXISTS school_settings;
DROP TABLE IF EXISTS users;
SET FOREIGN_KEY_CHECKS = 1;

-- 1. Users Table
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role ENUM(
    'super_admin', 'school_admin', 'principal', 'vice_principal', 
    'teacher', 'student', 'parent', 'accountant', 'librarian', 
    'receptionist', 'hr', 'transport_manager', 'hostel_manager'
  ) NOT NULL DEFAULT 'student',
  phone VARCHAR(20) NULL,
  avatar VARCHAR(255) NULL,
  two_factor_secret VARCHAR(255) NULL,
  is_two_factor_enabled BOOLEAN DEFAULT FALSE,
  otp_code VARCHAR(6) NULL,
  otp_expires_at DATETIME NULL,
  refresh_token VARCHAR(500) NULL,
  status ENUM('active', 'inactive') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_role (role),
  INDEX idx_status (status)
);

-- 2. School Settings Table
CREATE TABLE school_settings (
  id INT PRIMARY KEY DEFAULT 1,
  name VARCHAR(255) NOT NULL DEFAULT 'Secondary School of Modern Education',
  logo VARCHAR(255) NULL,
  address TEXT NULL,
  phone VARCHAR(50) NULL,
  email VARCHAR(100) NULL,
  current_session VARCHAR(50) NOT NULL DEFAULT '2026-2027',
  academic_year VARCHAR(50) NOT NULL DEFAULT '2026',
  medium VARCHAR(50) NOT NULL DEFAULT 'English',
  shift VARCHAR(50) NOT NULL DEFAULT 'Morning'
);

-- 3. Classes Table
CREATE TABLE classes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Sections Table
CREATE TABLE sections (
  id INT AUTO_INCREMENT PRIMARY KEY,
  class_id INT NOT NULL,
  name VARCHAR(50) NOT NULL,
  room_no VARCHAR(50) NULL,
  capacity INT DEFAULT 30,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
  UNIQUE KEY unique_class_section (class_id, name)
);

-- 5. Subjects Table
CREATE TABLE subjects (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(50) NOT NULL UNIQUE,
  type ENUM('Theory', 'Practical') DEFAULT 'Theory',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. Class Subjects (Mapping table with assigned teachers)
CREATE TABLE class_subjects (
  id INT AUTO_INCREMENT PRIMARY KEY,
  class_id INT NOT NULL,
  section_id INT NOT NULL,
  subject_id INT NOT NULL,
  teacher_id INT NULL,
  FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
  FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE,
  FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
  FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE KEY unique_class_sec_subj (class_id, section_id, subject_id)
);

-- 7. Parents Table
CREATE TABLE parents (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  father_name VARCHAR(255) NOT NULL,
  father_phone VARCHAR(20) NULL,
  father_occupation VARCHAR(255) NULL,
  mother_name VARCHAR(255) NULL,
  mother_phone VARCHAR(20) NULL,
  mother_occupation VARCHAR(255) NULL,
  address TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 8. Students Table
CREATE TABLE students (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  parent_id INT NULL,
  roll_number VARCHAR(50) NOT NULL UNIQUE,
  admission_no VARCHAR(50) NOT NULL UNIQUE,
  admission_date DATE NOT NULL,
  class_id INT NOT NULL,
  section_id INT NOT NULL,
  gender ENUM('Male', 'Female', 'Other') NOT NULL,
  dob DATE NOT NULL,
  blood_group VARCHAR(10) NULL,
  medical_history TEXT NULL,
  photo VARCHAR(255) NULL,
  status ENUM('active', 'inactive', 'promoted', 'transferred') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_id) REFERENCES parents(id) ON DELETE SET NULL,
  FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE RESTRICT,
  FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE RESTRICT,
  INDEX idx_roll (roll_number),
  INDEX idx_admission (admission_no)
);

-- 9. Teachers Table
CREATE TABLE teachers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  employee_id VARCHAR(50) NOT NULL UNIQUE,
  designation VARCHAR(100) NOT NULL,
  department VARCHAR(100) NOT NULL,
  qualification VARCHAR(255) NOT NULL,
  experience TEXT NULL,
  salary DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  hire_date DATE NOT NULL,
  status ENUM('active', 'inactive') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 10. Attendance Table (Supports QR/Manual for students, teachers, staff)
CREATE TABLE attendance (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  date DATE NOT NULL,
  status ENUM('Present', 'Absent', 'Late', 'Half Day') NOT NULL DEFAULT 'Present',
  remarks VARCHAR(255) NULL,
  checked_by INT NULL,
  qr_code_used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (checked_by) REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE KEY unique_user_attendance_date (user_id, date),
  INDEX idx_date (date)
);

-- 11. Timetables Table
CREATE TABLE timetables (
  id INT AUTO_INCREMENT PRIMARY KEY,
  class_id INT NOT NULL,
  section_id INT NOT NULL,
  subject_id INT NOT NULL,
  teacher_id INT NOT NULL,
  day_of_week ENUM('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday') NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  room_no VARCHAR(50) NULL,
  FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
  FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE,
  FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
  FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 12. Homework Table
CREATE TABLE homework (
  id INT AUTO_INCREMENT PRIMARY KEY,
  class_id INT NOT NULL,
  section_id INT NOT NULL,
  subject_id INT NOT NULL,
  teacher_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  due_date DATE NOT NULL,
  file_path VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
  FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE,
  FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
  FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 13. Homework Submissions Table
CREATE TABLE homework_submissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  homework_id INT NOT NULL,
  student_id INT NOT NULL,
  submission_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  file_path VARCHAR(255) NULL,
  status ENUM('Pending', 'Evaluated') DEFAULT 'Pending',
  marks DECIMAL(5, 2) NULL,
  comments TEXT NULL,
  evaluated_by INT NULL,
  evaluated_at TIMESTAMP NULL,
  FOREIGN KEY (homework_id) REFERENCES homework(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (evaluated_by) REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE KEY unique_student_homework (homework_id, student_id)
);

-- 14. Assignments Table
CREATE TABLE assignments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  class_id INT NOT NULL,
  section_id INT NOT NULL,
  subject_id INT NOT NULL,
  teacher_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  due_date DATE NOT NULL,
  file_path VARCHAR(255) NULL,
  max_marks DECIMAL(5, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
  FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE,
  FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
  FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 15. Assignment Submissions Table
CREATE TABLE assignment_submissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  assignment_id INT NOT NULL,
  student_id INT NOT NULL,
  submission_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  file_path VARCHAR(255) NULL,
  status ENUM('Pending', 'Evaluated') DEFAULT 'Pending',
  marks DECIMAL(5, 2) NULL,
  feedback TEXT NULL,
  evaluated_by INT NULL,
  FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (evaluated_by) REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE KEY unique_student_assignment (assignment_id, student_id)
);

-- 16. Exams Table (Online & Offline)
CREATE TABLE exams (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  type ENUM('Online', 'Offline') DEFAULT 'Offline',
  class_id INT NOT NULL,
  start_date DATETIME NOT NULL,
  end_date DATETIME NOT NULL,
  total_marks DECIMAL(5, 2) NOT NULL,
  passing_marks DECIMAL(5, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
);

-- 17. Exam Questions Table
CREATE TABLE exam_questions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  exam_id INT NOT NULL,
  question_text TEXT NOT NULL,
  type ENUM('MCQ', 'Subjective') DEFAULT 'MCQ',
  option_a VARCHAR(255) NULL,
  option_b VARCHAR(255) NULL,
  option_c VARCHAR(255) NULL,
  option_d VARCHAR(255) NULL,
  correct_option ENUM('A', 'B', 'C', 'D') NULL,
  marks DECIMAL(5, 2) NOT NULL,
  negative_marks DECIMAL(5, 2) DEFAULT 0.00,
  FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE
);

-- 18. Exam Submissions Table
CREATE TABLE exam_submissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  exam_id INT NOT NULL,
  student_id INT NOT NULL,
  start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  end_time TIMESTAMP NULL,
  status ENUM('In Progress', 'Submitted') DEFAULT 'In Progress',
  total_score DECIMAL(5, 2) DEFAULT 0.00,
  FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  UNIQUE KEY unique_student_exam (exam_id, student_id)
);

-- 19. Exam Answers Table
CREATE TABLE exam_answers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  submission_id INT NOT NULL,
  question_id INT NOT NULL,
  student_answer TEXT NULL,
  marks_obtained DECIMAL(5, 2) DEFAULT 0.00,
  FOREIGN KEY (submission_id) REFERENCES exam_submissions(id) ON DELETE CASCADE,
  FOREIGN KEY (question_id) REFERENCES exam_questions(id) ON DELETE CASCADE
);

-- 20. Exam Marks (Offline Marks entry)
CREATE TABLE exam_marks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  exam_id INT NOT NULL,
  student_id INT NOT NULL,
  subject_id INT NOT NULL,
  marks_obtained DECIMAL(5, 2) NOT NULL,
  remarks VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
  UNIQUE KEY unique_exam_student_subject (exam_id, student_id, subject_id)
);

-- 21. Grades Table
CREATE TABLE grades (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(10) NOT NULL,
  point DECIMAL(3, 2) NOT NULL,
  mark_from INT NOT NULL,
  mark_to INT NOT NULL,
  comment VARCHAR(255) NULL
);

-- 22. Fee Types Table
CREATE TABLE fee_types (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(50) NOT NULL UNIQUE,
  description TEXT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  due_date DATE NOT NULL
);

-- 23. Fee Invoices Table
CREATE TABLE fee_invoices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  invoice_no VARCHAR(50) NOT NULL UNIQUE,
  date DATE NOT NULL,
  due_date DATE NOT NULL,
  total_amount DECIMAL(10, 2) NOT NULL,
  discount DECIMAL(10, 2) DEFAULT 0.00,
  fine DECIMAL(10, 2) DEFAULT 0.00,
  paid_amount DECIMAL(10, 2) DEFAULT 0.00,
  status ENUM('Paid', 'Partially Paid', 'Unpaid') DEFAULT 'Unpaid',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

-- 24. Fee Invoice Details Table
CREATE TABLE fee_invoice_details (
  id INT AUTO_INCREMENT PRIMARY KEY,
  invoice_id INT NOT NULL,
  fee_type_id INT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  FOREIGN KEY (invoice_id) REFERENCES fee_invoices(id) ON DELETE CASCADE,
  FOREIGN KEY (fee_type_id) REFERENCES fee_types(id) ON DELETE RESTRICT
);

-- 25. Fee Payments Table
CREATE TABLE fee_payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  invoice_id INT NOT NULL,
  amount_paid DECIMAL(10, 2) NOT NULL,
  payment_method ENUM('Cash', 'Card', 'UPI', 'Stripe', 'Razorpay') DEFAULT 'Cash',
  transaction_no VARCHAR(100) NULL,
  payment_date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (invoice_id) REFERENCES fee_invoices(id) ON DELETE CASCADE
);

-- 26. Accounts Ledger Table
CREATE TABLE accounts_ledger (
  id INT AUTO_INCREMENT PRIMARY KEY,
  type ENUM('Income', 'Expense') NOT NULL,
  category ENUM('Fee', 'Salary', 'Maintenance', 'Library', 'Hostel', 'Transport', 'Other') NOT NULL,
  title VARCHAR(255) NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  date DATE NOT NULL,
  description TEXT NULL,
  payment_method VARCHAR(50) NULL,
  reference_no VARCHAR(100) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 27. Library Books Table
CREATE TABLE library_books (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  isbn VARCHAR(50) NOT NULL UNIQUE,
  author VARCHAR(255) NOT NULL,
  publisher VARCHAR(255) NULL,
  subject VARCHAR(100) NULL,
  quantity INT NOT NULL DEFAULT 1,
  rack_number VARCHAR(50) NULL,
  price DECIMAL(10, 2) DEFAULT 0.00,
  barcode VARCHAR(100) NOT NULL UNIQUE,
  status ENUM('Available', 'Out of Stock') DEFAULT 'Available'
);

-- 28. Library Issues Table
CREATE TABLE library_issues (
  id INT AUTO_INCREMENT PRIMARY KEY,
  book_id INT NOT NULL,
  user_id INT NOT NULL,
  issue_date DATE NOT NULL,
  due_date DATE NOT NULL,
  return_date DATE NULL,
  fine_amount DECIMAL(10, 2) DEFAULT 0.00,
  status ENUM('Issued', 'Returned') DEFAULT 'Issued',
  FOREIGN KEY (book_id) REFERENCES library_books(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 29. Transport Vehicles Table
CREATE TABLE transport_vehicles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  vehicle_no VARCHAR(50) NOT NULL UNIQUE,
  model VARCHAR(100) NOT NULL,
  capacity INT NOT NULL,
  driver_name VARCHAR(255) NOT NULL,
  driver_phone VARCHAR(20) NOT NULL,
  driver_license VARCHAR(100) NOT NULL
);

-- 30. Transport Routes Table
CREATE TABLE transport_routes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  route_name VARCHAR(100) NOT NULL,
  start_point VARCHAR(100) NOT NULL,
  end_point VARCHAR(100) NOT NULL,
  fare DECIMAL(10, 2) NOT NULL
);

-- 31. Transport Pickup Points Table
CREATE TABLE transport_pickup_points (
  id INT AUTO_INCREMENT PRIMARY KEY,
  route_id INT NOT NULL,
  point_name VARCHAR(100) NOT NULL,
  pickup_time TIME NOT NULL,
  monthly_fee DECIMAL(10, 2) NOT NULL,
  FOREIGN KEY (route_id) REFERENCES transport_routes(id) ON DELETE CASCADE
);

-- 32. Student Transport Table
CREATE TABLE student_transport (
  student_id INT PRIMARY KEY,
  route_id INT NOT NULL,
  pickup_point_id INT NOT NULL,
  start_date DATE NOT NULL,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (route_id) REFERENCES transport_routes(id) ON DELETE RESTRICT,
  FOREIGN KEY (pickup_point_id) REFERENCES transport_pickup_points(id) ON DELETE RESTRICT
);

-- 33. Hostels Table
CREATE TABLE hostels (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  type ENUM('Boys', 'Girls', 'Mixed') NOT NULL,
  address TEXT NULL,
  description TEXT NULL
);

-- 34. Hostel Rooms Table
CREATE TABLE hostel_rooms (
  id INT AUTO_INCREMENT PRIMARY KEY,
  hostel_id INT NOT NULL,
  room_no VARCHAR(50) NOT NULL,
  room_type ENUM('Single', 'Double', 'Triple', 'Dormitory') NOT NULL,
  capacity INT NOT NULL,
  no_of_beds INT NOT NULL,
  cost_per_bed DECIMAL(10, 2) NOT NULL,
  FOREIGN KEY (hostel_id) REFERENCES hostels(id) ON DELETE CASCADE,
  UNIQUE KEY unique_hostel_room (hostel_id, room_no)
);

-- 35. Student Hostel Table
CREATE TABLE student_hostel (
  student_id INT PRIMARY KEY,
  room_id INT NOT NULL,
  bed_no INT NOT NULL,
  join_date DATE NOT NULL,
  status ENUM('Allocated', 'Vacated') DEFAULT 'Allocated',
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (room_id) REFERENCES hostel_rooms(id) ON DELETE RESTRICT
);

-- 36. Employees Table (HR)
CREATE TABLE employees (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  employee_id VARCHAR(50) NOT NULL UNIQUE,
  department VARCHAR(100) NOT NULL,
  designation VARCHAR(100) NOT NULL,
  salary DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  status ENUM('active', 'inactive') DEFAULT 'active',
  hire_date DATE NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 37. Employee Payroll Table
CREATE TABLE employee_payroll (
  id INT AUTO_INCREMENT PRIMARY KEY,
  employee_id INT NOT NULL,
  month INT NOT NULL,
  year INT NOT NULL,
  basic_salary DECIMAL(10, 2) NOT NULL,
  allowance DECIMAL(10, 2) DEFAULT 0.00,
  deduction DECIMAL(10, 2) DEFAULT 0.00,
  net_salary DECIMAL(10, 2) NOT NULL,
  payment_date DATE NULL,
  status ENUM('Paid', 'Unpaid') DEFAULT 'Unpaid',
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  UNIQUE KEY unique_employee_payroll_period (employee_id, month, year)
);

-- 38. Leaves Table
CREATE TABLE leaves (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  leave_type VARCHAR(100) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT NOT NULL,
  status ENUM('Pending', 'Approved', 'Rejected') DEFAULT 'Pending',
  approved_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
);

-- 39. Notices Table (Notice Board)
CREATE TABLE notices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  target_audience ENUM('All', 'Teachers', 'Students', 'Parents', 'Staff') DEFAULT 'All',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by INT NOT NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

-- 40. Chats Table (Internal Messaging)
CREATE TABLE chats (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sender_id INT NOT NULL,
  receiver_id INT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 41. Events Table (Calendar Events & Holidays)
CREATE TABLE events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT NULL,
  start_date DATETIME NOT NULL,
  end_date DATETIME NOT NULL,
  type ENUM('Event', 'Holiday') DEFAULT 'Event'
);

-- ==========================================================
-- Triggers and Views
-- ==========================================================

-- Trigger to log fee payments to Accounts Ledger
DELIMITER //
CREATE TRIGGER after_fee_payment_insert
AFTER INSERT ON fee_payments
FOR EACH ROW
BEGIN
  -- Find student name and invoice details
  DECLARE student_name VARCHAR(255);
  SELECT u.name INTO student_name 
  FROM fee_invoices fi
  JOIN students s ON fi.student_id = s.id
  JOIN users u ON s.user_id = u.id
  WHERE fi.id = NEW.invoice_id;

  -- Insert into accounts ledger
  INSERT INTO accounts_ledger (type, category, title, amount, date, description, payment_method, reference_no)
  VALUES (
    'Income', 
    'Fee', 
    CONCAT('Fee payment from student: ', student_name), 
    NEW.amount_paid, 
    NEW.payment_date, 
    CONCAT('Received fee payment for invoice ID: ', NEW.invoice_id), 
    NEW.payment_method, 
    NEW.transaction_no
  );
END//
DELIMITER ;

-- Trigger to log payroll payments to Accounts Ledger
DELIMITER //
CREATE TRIGGER after_payroll_payment_update
AFTER UPDATE ON employee_payroll
FOR EACH ROW
BEGIN
  DECLARE employee_name VARCHAR(255);
  IF OLD.status = 'Unpaid' AND NEW.status = 'Paid' THEN
    SELECT u.name INTO employee_name 
    FROM employees e
    JOIN users u ON e.user_id = u.id
    WHERE e.id = NEW.employee_id;

    INSERT INTO accounts_ledger (type, category, title, amount, date, description, payment_method)
    VALUES (
      'Expense', 
      'Salary', 
      CONCAT('Salary payment to employee: ', employee_name), 
      NEW.net_salary, 
      NEW.payment_date, 
      CONCAT('Paid salary for ', NEW.month, '/', NEW.year), 
      'Bank Transfer'
    );
  END IF;
END//
DELIMITER ;

-- View for Student Profiles
CREATE OR REPLACE VIEW view_student_profiles AS
SELECT 
  s.id AS student_id,
  u.id AS user_id,
  u.name,
  u.email,
  u.phone,
  u.status AS user_status,
  s.roll_number,
  s.admission_no,
  s.admission_date,
  c.name AS class_name,
  sec.name AS section_name,
  s.gender,
  s.dob,
  s.blood_group,
  p.father_name,
  p.father_phone
FROM students s
JOIN users u ON s.user_id = u.id
LEFT JOIN parents p ON s.parent_id = p.id
JOIN classes c ON s.class_id = c.id
JOIN sections sec ON s.section_id = sec.id;

-- View for Teacher Profiles
CREATE OR REPLACE VIEW view_teacher_profiles AS
SELECT 
  t.id AS id,
  t.user_id,
  u.name,
  u.email,
  u.phone,
  u.avatar,
  u.status AS user_status,
  t.employee_id,
  t.designation,
  t.department,
  t.qualification,
  t.experience,
  t.salary,
  t.hire_date,
  t.status AS status
FROM teachers t
JOIN users u ON t.user_id = u.id;

-- ==========================================================
-- Insert Default Configurations & Sample Data
-- ==========================================================

-- Insert School Settings
INSERT INTO school_settings (id, name, logo, address, phone, email, current_session, academic_year, medium, shift)
VALUES (1, 'Secondary School of Modern Education', '/logo.png', '123 Education Blvd, Silicon Valley', '+1 555-0199', 'info@eskooly.com', '2026-2027', '2026', 'English', 'Morning')
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- Insert Default Hashed Passwords (bcrypt for 'admin123')
-- Hash: $2b$10$kG6BJhwDmzr0ql.SugdbfuK1uzWC6qkHBVdQgAdhFgieC8bpOJvuG
INSERT INTO users (name, email, password, role, phone, status) VALUES 
('Super Admin User', 'superadmin@eskooly.com', '$2b$10$kG6BJhwDmzr0ql.SugdbfuK1uzWC6qkHBVdQgAdhFgieC8bpOJvuG', 'super_admin', '+15550100', 'active'),
('School Admin User', 'admin@eskooly.com', '$2b$10$kG6BJhwDmzr0ql.SugdbfuK1uzWC6qkHBVdQgAdhFgieC8bpOJvuG', 'school_admin', '+15550101', 'active'),
('Principal User', 'principal@eskooly.com', '$2b$10$kG6BJhwDmzr0ql.SugdbfuK1uzWC6qkHBVdQgAdhFgieC8bpOJvuG', 'principal', '+15550102', 'active'),
('Vice Principal User', 'viceprincipal@eskooly.com', '$2b$10$kG6BJhwDmzr0ql.SugdbfuK1uzWC6qkHBVdQgAdhFgieC8bpOJvuG', 'vice_principal', '+15550103', 'active'),
('John Doe (Teacher)', 'teacher@eskooly.com', '$2b$10$kG6BJhwDmzr0ql.SugdbfuK1uzWC6qkHBVdQgAdhFgieC8bpOJvuG', 'teacher', '+15550104', 'active'),
('Jane Smith (Teacher)', 'janesmith@eskooly.com', '$2b$10$kG6BJhwDmzr0ql.SugdbfuK1uzWC6qkHBVdQgAdhFgieC8bpOJvuG', 'teacher', '+15550105', 'active'),
('Bob Johnson (Student)', 'student@eskooly.com', '$2b$10$kG6BJhwDmzr0ql.SugdbfuK1uzWC6qkHBVdQgAdhFgieC8bpOJvuG', 'student', '+15550106', 'active'),
('Alice Johnson (Parent)', 'parent@eskooly.com', '$2b$10$kG6BJhwDmzr0ql.SugdbfuK1uzWC6qkHBVdQgAdhFgieC8bpOJvuG', 'parent', '+15550107', 'active'),
('Charlie Brown (Accountant)', 'accountant@eskooly.com', '$2b$10$kG6BJhwDmzr0ql.SugdbfuK1uzWC6qkHBVdQgAdhFgieC8bpOJvuG', 'accountant', '+15550108', 'active'),
('Lilly Read (Librarian)', 'librarian@eskooly.com', '$2b$10$kG6BJhwDmzr0ql.SugdbfuK1uzWC6qkHBVdQgAdhFgieC8bpOJvuG', 'librarian', '+15550109', 'active'),
('Rita Desk (Receptionist)', 'receptionist@eskooly.com', '$2b$10$kG6BJhwDmzr0ql.SugdbfuK1uzWC6qkHBVdQgAdhFgieC8bpOJvuG', 'receptionist', '+15550110', 'active'),
('Harry Recruiter (HR)', 'hr@eskooly.com', '$2b$10$kG6BJhwDmzr0ql.SugdbfuK1uzWC6qkHBVdQgAdhFgieC8bpOJvuG', 'hr', '+15550111', 'active'),
('Tommy Route (Transport)', 'transport@eskooly.com', '$2b$10$kG6BJhwDmzr0ql.SugdbfuK1uzWC6qkHBVdQgAdhFgieC8bpOJvuG', 'transport_manager', '+15550112', 'active'),
('Helen Host (Hostel)', 'hostel@eskooly.com', '$2b$10$kG6BJhwDmzr0ql.SugdbfuK1uzWC6qkHBVdQgAdhFgieC8bpOJvuG', 'hostel_manager', '+15550113', 'active');

-- Insert Classes
INSERT INTO classes (id, name) VALUES 
(1, 'Class 1'),
(2, 'Class 2'),
(3, 'Class 3'),
(4, 'Class 4'),
(5, 'Class 5');

-- Insert Sections
INSERT INTO sections (id, class_id, name, room_no, capacity) VALUES 
(1, 1, 'Section A', 'Room 101', 30),
(2, 1, 'Section B', 'Room 102', 30),
(3, 2, 'Section A', 'Room 201', 30),
(4, 3, 'Section A', 'Room 301', 30);

-- Insert Subjects
INSERT INTO subjects (id, name, code, type) VALUES 
(1, 'Mathematics', 'MATH101', 'Theory'),
(2, 'Science', 'SCI101', 'Theory'),
(3, 'Computer Science Lab', 'CS101P', 'Practical'),
(4, 'English Literature', 'ENG101', 'Theory');

-- Map Subjects & Teachers
INSERT INTO class_subjects (class_id, section_id, subject_id, teacher_id) VALUES 
(1, 1, 1, 5), -- Class 1 A: Math (John Doe)
(1, 1, 2, 6), -- Class 1 A: Science (Jane Smith)
(1, 1, 3, 5); -- Class 1 A: CS Lab (John Doe)

-- Insert Parents
INSERT INTO parents (id, user_id, father_name, father_phone, father_occupation, mother_name, mother_phone, mother_occupation, address) VALUES
(1, 8, 'Alice Johnson', '+15550107', 'Software Engineer', 'Sarah Johnson', '+15550114', 'Doctor', '456 Elm St, Silicon Valley');

-- Insert Students
INSERT INTO students (id, user_id, parent_id, roll_number, admission_no, admission_date, class_id, section_id, gender, dob, blood_group, status) VALUES
(1, 7, 1, 'R101', 'ADM2026001', '2026-06-01', 1, 1, 'Male', '2016-05-15', 'O+', 'active');

-- Insert Teachers
INSERT INTO teachers (id, user_id, employee_id, designation, department, qualification, experience, salary, hire_date, status) VALUES
(1, 5, 'EMP001', 'Senior Mathematics Teacher', 'Science & Mathematics', 'M.Sc in Mathematics', '8 Years teaching experience', 4500.00, '2020-08-01', 'active'),
(2, 6, 'EMP002', 'Science Lecturer', 'Natural Sciences', 'B.Ed, B.Sc in Biology', '5 Years teaching experience', 4200.00, '2022-09-15', 'active');

-- Insert Employees (HR, Accountant, Librarian, Receptionist, Transport, Hostel)
INSERT INTO employees (user_id, employee_id, department, designation, salary, status, hire_date) VALUES 
(9, 'EMP003', 'Finance', 'Senior Accountant', 3800.00, 'active', '2021-02-15'),
(10, 'EMP004', 'Academics Support', 'Head Librarian', 3200.00, 'active', '2019-11-01'),
(11, 'EMP005', 'Administration', 'Front Desk Receptionist', 2500.00, 'active', '2023-01-10'),
(12, 'EMP006', 'HR Department', 'HR Specialist', 4000.00, 'active', '2021-05-20'),
(13, 'EMP007', 'Logistics', 'Transport Manager', 3000.00, 'active', '2022-03-12'),
(14, 'EMP008', 'Logistics', 'Hostel Warden', 2900.00, 'active', '2020-06-05');

-- Insert Grades
INSERT INTO grades (name, point, mark_from, mark_to, comment) VALUES 
('A+', 4.00, 90, 100, 'Outstanding'),
('A', 3.75, 80, 89, 'Excellent'),
('B', 3.00, 70, 79, 'Good'),
('C', 2.00, 60, 69, 'Satisfactory'),
('D', 1.00, 50, 59, 'Pass'),
('F', 0.00, 0, 49, 'Fail');

-- Insert Fee Types
INSERT INTO fee_types (name, code, description, amount, due_date) VALUES 
('Tuition Fee - Monthly', 'TUIT100', 'Monthly academic tuition fee', 250.00, '2026-07-10'),
('Admission Registration Fee', 'ADMISSION', 'One-time admission fee', 500.00, '2026-06-30'),
('Exam Fee - Term 1', 'EXAM1', 'First term examination fee', 50.00, '2026-07-05'),
('Library Annual Card', 'LIBCARD', 'Annual library card fee', 20.00, '2026-12-31');

-- Insert Fee Invoices
INSERT INTO fee_invoices (id, student_id, invoice_no, date, due_date, total_amount, discount, fine, paid_amount, status) VALUES 
(1, 1, 'INV20260001', '2026-06-05', '2026-07-10', 300.00, 20.00, 0.00, 280.00, 'Paid'),
(2, 1, 'INV20260002', '2026-06-25', '2026-07-10', 250.00, 0.00, 0.00, 0.00, 'Unpaid');

-- Insert Fee Invoice Details
INSERT INTO fee_invoice_details (invoice_id, fee_type_id, amount) VALUES 
(1, 1, 250.00),
(1, 3, 50.00),
(2, 1, 250.00);

-- Insert Fee Payments (This will fire the trigger after_fee_payment_insert)
INSERT INTO fee_payments (invoice_id, amount_paid, payment_method, transaction_no, payment_date) VALUES 
(1, 280.00, 'UPI', 'TXN9876543210', '2026-06-08');

-- Insert Library Books
INSERT INTO library_books (title, isbn, author, publisher, subject, quantity, rack_number, price, barcode) VALUES 
('Introduction to Algorithms', '9780262033848', 'Thomas H. Cormen', 'MIT Press', 'Computer Science', 5, 'CS-RACK-01', 89.99, 'B00001'),
('Concepts of Physics Vol 1', '9788177091878', 'H. C. Verma', 'Bharati Bhawan', 'Physics', 10, 'PHY-RACK-02', 15.50, 'B00002'),
('Calculus and Analytic Geometry', '9780201531749', 'George B. Thomas', 'Addison-Wesley', 'Mathematics', 4, 'MATH-RACK-03', 45.00, 'B00003');

-- Insert Transport Routes & Pickup Points
INSERT INTO transport_routes (id, route_name, start_point, end_point, fare) VALUES 
(1, 'Route 1 - North Line', 'Downtown Terminal', 'School Campus', 50.00),
(2, 'Route 2 - East Line', 'City Station', 'School Campus', 45.00);

INSERT INTO transport_pickup_points (id, route_id, point_name, pickup_time, monthly_fee) VALUES 
(1, 1, 'Green Square Sector A', '07:15:00', 50.00),
(2, 1, 'North Crossing Stop 3', '07:30:00', 40.00),
(3, 2, 'Oakwood Residential Park', '07:20:00', 45.00);

-- Insert Hostels & Rooms
INSERT INTO hostels (id, name, type, address, description) VALUES 
(1, 'Newton Boys Hostel', 'Boys', 'North Campus Wing B', 'Comfortable residential facility for male students'),
(2, 'Marie Curie Girls Hostel', 'Girls', 'North Campus Wing A', 'Safe and modern residential facility for female students');

INSERT INTO hostel_rooms (id, hostel_id, room_no, room_type, capacity, no_of_beds, cost_per_bed) VALUES 
(1, 1, '101', 'Double', 2, 2, 120.00),
(2, 1, '102', 'Triple', 3, 3, 90.00),
(3, 2, '201', 'Single', 1, 1, 200.00);

-- Insert Notices
INSERT INTO notices (title, content, target_audience, created_by) VALUES 
('Welcome to Academic Session 2026-2027', 'Dear teachers, students, and parents, welcome to the new academic session. We look forward to an exciting year of learning and growth.', 'All', 2),
('Staff Meeting on Academic Planning', 'There will be a staff meeting this Friday at 2:00 PM in the Principal Conference Room to discuss the term curriculum.', 'Teachers', 3);

-- Insert Events
INSERT INTO events (title, description, start_date, end_date, type) VALUES 
('Annual Science Fair 2026', 'Annual exhibition of science projects by students across all grades.', '2026-07-15 09:00:00', '2026-07-16 16:00:00', 'Event'),
('Independence Day Holiday', 'National holiday celebration. School remains closed.', '2026-07-04 00:00:00', '2026-07-04 23:59:59', 'Holiday');
