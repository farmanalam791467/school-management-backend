const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { authenticator } = require('otplib');
const QRCode = require('qrcode');
const { sendEmail } = require('../services/emailService');

const JWT_SECRET = process.env.JWT_SECRET || 'eskooly_secret_key';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'eskooly_refresh_secret_key';

// Helper to generate tokens
const generateTokens = (user) => {
  const accessToken = jwt.sign(
    { id: user.id, name: user.name, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '15m' } // Short-lived access token
  );

  const refreshToken = jwt.sign(
    { id: user.id },
    JWT_REFRESH_SECRET,
    { expiresIn: '7d' } // Long-lived refresh token
  );

  return { accessToken, refreshToken };
};

// Login
exports.login = async (req, res) => {
  const { email, password, rememberMe } = req.body;
  try {
    const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (users.length === 0) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const user = users[0];
    if (user.status !== 'active') {
      return res.status(403).json({ message: 'Your account is inactive. Please contact administration.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Check if 2FA is enabled
    if (user.is_two_factor_enabled) {
      const tempToken = jwt.sign({ id: user.id, temp: true }, JWT_SECRET, { expiresIn: '5m' });
      return res.json({
        twoFactorRequired: true,
        tempToken,
        message: 'Two-factor authentication required'
      });
    }

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user);

    // Save refresh token in DB
    await db.query('UPDATE users SET refresh_token = ? WHERE id = ?', [refreshToken, user.id]);

    res.json({
      token: accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        phone: user.phone
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Verify 2FA
exports.verify2FA = async (req, res) => {
  const { code, tempToken } = req.body;
  try {
    const decoded = jwt.verify(tempToken, JWT_SECRET);
    if (!decoded.temp) {
      return res.status(400).json({ message: 'Invalid temporary token' });
    }

    const [users] = await db.query('SELECT * FROM users WHERE id = ?', [decoded.id]);
    if (users.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = users[0];
    const verified = authenticator.verify({
      token: code,
      secret: user.two_factor_secret
    });

    if (!verified) {
      return res.status(400).json({ message: 'Invalid 2FA code' });
    }

    const { accessToken, refreshToken } = generateTokens(user);
    await db.query('UPDATE users SET refresh_token = ? WHERE id = ?', [refreshToken, user.id]);

    res.json({
      token: accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        phone: user.phone
      }
    });
  } catch (err) {
    console.error(err);
    res.status(400).json({ message: 'Invalid or expired temporary token' });
  }
};

// Setup 2FA
exports.setup2FA = async (req, res) => {
  try {
    const [users] = await db.query('SELECT * FROM users WHERE id = ?', [req.user.id]);
    const user = users[0];

    const secret = authenticator.generateSecret();
    const otpauth = authenticator.keyuri(user.email, 'Secondary School of Modern Education', secret);
    const qrCodeUrl = await QRCode.toDataURL(otpauth);

    // Save secret temporarily in DB (we only enable it once they verify a code)
    await db.query('UPDATE users SET two_factor_secret = ? WHERE id = ?', [secret, req.user.id]);

    res.json({ secret, qrCodeUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Enable 2FA
exports.enable2FA = async (req, res) => {
  const { code } = req.body;
  try {
    const [users] = await db.query('SELECT * FROM users WHERE id = ?', [req.user.id]);
    const user = users[0];

    if (!user.two_factor_secret) {
      return res.status(400).json({ message: '2FA setup not initiated' });
    }

    const verified = authenticator.verify({
      token: code,
      secret: user.two_factor_secret
    });

    if (!verified) {
      return res.status(400).json({ message: 'Invalid code. Verification failed.' });
    }

    await db.query('UPDATE users SET is_two_factor_enabled = TRUE WHERE id = ?', [req.user.id]);
    res.json({ message: 'Two-factor authentication enabled successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Disable 2FA
exports.disable2FA = async (req, res) => {
  try {
    await db.query('UPDATE users SET is_two_factor_enabled = FALSE, two_factor_secret = NULL WHERE id = ?', [req.user.id]);
    res.json({ message: 'Two-factor authentication disabled successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Refresh Token
exports.refreshToken = async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(401).json({ message: 'Refresh token is required' });
  }

  try {
    const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
    const [users] = await db.query('SELECT * FROM users WHERE id = ? AND refresh_token = ?', [decoded.id, refreshToken]);
    
    if (users.length === 0) {
      return res.status(403).json({ message: 'Invalid refresh token' });
    }

    const user = users[0];
    const tokens = generateTokens(user);

    await db.query('UPDATE users SET refresh_token = ? WHERE id = ?', [tokens.refreshToken, user.id]);

    res.json({
      token: tokens.accessToken,
      refreshToken: tokens.refreshToken
    });
  } catch (err) {
    console.error(err);
    res.status(403).json({ message: 'Invalid or expired refresh token' });
  }
};

// Forgot Password
exports.forgotPassword = async (req, res) => {
  const { email } = req.body;
  try {
    const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (users.length === 0) {
      return res.status(404).json({ message: 'User with this email does not exist' });
    }

    const user = users[0];
    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await db.query('UPDATE users SET otp_code = ?, otp_expires_at = ? WHERE id = ?', [otp, expiresAt, user.id]);

    // Send email
    await sendEmail(
      user.email,
      'Password Reset OTP - Secondary School of Modern Education',
      `Your OTP for resetting password is: ${otp}. It is valid for 10 minutes.`,
      `<h3>Password Reset Request</h3><p>Your OTP for resetting password is: <strong>${otp}</strong></p><p>It is valid for 10 minutes.</p>`
    );

    res.json({ message: 'OTP sent to your registered email address' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Verify OTP
exports.verifyOTP = async (req, res) => {
  const { email, otp } = req.body;
  try {
    const [users] = await db.query('SELECT * FROM users WHERE email = ? AND otp_code = ? AND otp_expires_at > NOW()', [email, otp]);
    if (users.length === 0) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    // OTP is valid. Generate temporary reset token
    const user = users[0];
    const resetToken = jwt.sign({ id: user.id, reset: true }, JWT_SECRET, { expiresIn: '15m' });

    res.json({ resetToken, message: 'OTP verified successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Reset Password
exports.resetPassword = async (req, res) => {
  const { resetToken, newPassword } = req.body;
  try {
    const decoded = jwt.verify(resetToken, JWT_SECRET);
    if (!decoded.reset) {
      return res.status(400).json({ message: 'Invalid reset token' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await db.query(
      'UPDATE users SET password = ?, otp_code = NULL, otp_expires_at = NULL, refresh_token = NULL WHERE id = ?',
      [hashedPassword, decoded.id]
    );

    res.json({ message: 'Password reset successful. Please login with your new password.' });
  } catch (err) {
    console.error(err);
    res.status(400).json({ message: 'Invalid or expired reset token' });
  }
};

// Change Password (when logged in)
exports.changePassword = async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  try {
    const [users] = await db.query('SELECT * FROM users WHERE id = ?', [req.user.id]);
    const user = users[0];

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Incorrect old password' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await db.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, req.user.id]);

    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get Profile
exports.getProfile = async (req, res) => {
  try {
    const [users] = await db.query('SELECT id, name, email, role, phone, avatar, is_two_factor_enabled, status, created_at FROM users WHERE id = ?', [req.user.id]);
    if (users.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = users[0];
    let extraDetails = {};

    // Get role-specific details
    if (user.role === 'student') {
      const [students] = await db.query(
        `SELECT s.*, c.name AS class_name, sec.name AS section_name, p.father_name, p.father_phone 
         FROM students s 
         JOIN classes c ON s.class_id = c.id 
         JOIN sections sec ON s.section_id = sec.id 
         LEFT JOIN parents p ON s.parent_id = p.id 
         WHERE s.user_id = ?`, 
        [user.id]
      );
      if (students.length > 0) extraDetails = students[0];
    } else if (user.role === 'teacher') {
      const [teachers] = await db.query('SELECT * FROM teachers WHERE user_id = ?', [user.id]);
      if (teachers.length > 0) extraDetails = teachers[0];
    } else if (['accountant', 'librarian', 'receptionist', 'hr', 'transport_manager', 'hostel_manager'].includes(user.role)) {
      const [employees] = await db.query('SELECT * FROM employees WHERE user_id = ?', [user.id]);
      if (employees.length > 0) extraDetails = employees[0];
    } else if (user.role === 'parent') {
      const [parents] = await db.query('SELECT * FROM parents WHERE user_id = ?', [user.id]);
      if (parents.length > 0) {
        extraDetails = parents[0];
        // Fetch children
        const [children] = await db.query(
          `SELECT s.id, u.name, s.roll_number, c.name AS class_name, sec.name AS section_name 
           FROM students s 
           JOIN users u ON s.user_id = u.id 
           JOIN classes c ON s.class_id = c.id 
           JOIN sections sec ON s.section_id = sec.id 
           WHERE s.parent_id = ?`, 
          [extraDetails.id]
        );
        extraDetails.children = children;
      }
    }

    res.json({ user, details: extraDetails });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Update Profile
exports.updateProfile = async (req, res) => {
  const { name, phone, avatar } = req.body;
  try {
    await db.query(
      'UPDATE users SET name = ?, phone = ?, avatar = ? WHERE id = ?',
      [name, phone, avatar, req.user.id]
    );

    // If student/teacher, we can also update name in their respective tables if needed (though we join users usually)
    res.json({ message: 'Profile updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Logout
exports.logout = async (req, res) => {
  try {
    if (req.user) {
      await db.query('UPDATE users SET refresh_token = NULL WHERE id = ?', [req.user.id]);
    }
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Setup Admin helper
exports.setupAdmin = async (req, res) => {
  try {
    const [users] = await db.query('SELECT * FROM users WHERE email = ?', ['admin@eskooly.com']);
    const hashedPassword = await bcrypt.hash('admin123', 10);

    if (users.length === 0) {
      await db.query(
        'INSERT INTO users (name, email, password, role, status) VALUES (?, ?, ?, ?, "active")',
        ['Admin', 'admin@eskooly.com', hashedPassword, 'school_admin']
      );
      res.json({ message: 'Admin created with password: admin123' });
    } else {
      await db.query('UPDATE users SET password = ?, status = "active" WHERE email = ?', [hashedPassword, 'admin@eskooly.com']);
      res.json({ message: 'Admin updated with hashed password' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

