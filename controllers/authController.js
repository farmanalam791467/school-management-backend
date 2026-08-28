const User = require('../models/User');
const Student = require('../models/Student');
const Parent = require('../models/Parent');
const Teacher = require('../models/Teacher');
const Employee = require('../models/Employee');
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
    { id: user._id.toString(), name: user.name, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '15m' }
  );

  const refreshToken = jwt.sign(
    { id: user._id.toString() },
    JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );

  return { accessToken, refreshToken };
};

// Login
exports.login = async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    if (user.status !== 'active') {
      return res.status(403).json({ message: 'Your account is inactive. Please contact administration.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Check if 2FA is enabled
    if (user.is_two_factor_enabled) {
      const tempToken = jwt.sign({ id: user._id.toString(), temp: true }, JWT_SECRET, { expiresIn: '5m' });
      return res.json({
        twoFactorRequired: true,
        tempToken,
        message: 'Two-factor authentication required'
      });
    }

    const { accessToken, refreshToken } = generateTokens(user);
    user.refresh_token = refreshToken;
    await user.save();

    res.json({
      token: accessToken,
      refreshToken,
      user: {
        id: user._id.toString(),
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

    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const verified = authenticator.verify({
      token: code,
      secret: user.two_factor_secret
    });

    if (!verified) {
      return res.status(400).json({ message: 'Invalid 2FA code' });
    }

    const { accessToken, refreshToken } = generateTokens(user);
    user.refresh_token = refreshToken;
    await user.save();

    res.json({
      token: accessToken,
      refreshToken,
      user: {
        id: user._id.toString(),
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
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const secret = authenticator.generateSecret();
    const otpauth = authenticator.keyuri(user.email, 'Secondary School of Modern Education', secret);
    const qrCodeUrl = await QRCode.toDataURL(otpauth);

    user.two_factor_secret = secret;
    await user.save();

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
    const user = await User.findById(req.user.id);
    if (!user || !user.two_factor_secret) {
      return res.status(400).json({ message: '2FA setup not initiated' });
    }

    const verified = authenticator.verify({
      token: code,
      secret: user.two_factor_secret
    });

    if (!verified) {
      return res.status(400).json({ message: 'Invalid code. Verification failed.' });
    }

    user.is_two_factor_enabled = true;
    await user.save();

    res.json({ message: 'Two-factor authentication enabled successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Disable 2FA
exports.disable2FA = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user.id, {
      is_two_factor_enabled: false,
      two_factor_secret: null
    });
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
    const user = await User.findOne({ _id: decoded.id, refresh_token: refreshToken });
    
    if (!user) {
      return res.status(403).json({ message: 'Invalid refresh token' });
    }

    const tokens = generateTokens(user);
    user.refresh_token = tokens.refreshToken;
    await user.save();

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
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User with this email does not exist' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    user.otp_code = otp;
    user.otp_expires_at = expiresAt;
    await user.save();

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
    const user = await User.findOne({
      email,
      otp_code: otp,
      otp_expires_at: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    const resetToken = jwt.sign({ id: user._id.toString(), reset: true }, JWT_SECRET, { expiresIn: '15m' });
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

    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    user.otp_code = null;
    user.otp_expires_at = null;
    user.refresh_token = null;
    await user.save();

    res.json({ message: 'Password reset successful. Please login with your new password.' });
  } catch (err) {
    console.error(err);
    res.status(400).json({ message: 'Invalid or expired reset token' });
  }
};

// Change Password
exports.changePassword = async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Incorrect old password' });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get Profile
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password -refresh_token');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    let extraDetails = {};
    const userId = user._id;

    if (user.role === 'student') {
      const student = await Student.findOne({ user: userId })
        .populate('class', 'name')
        .populate('section', 'name')
        .populate({
          path: 'parent',
          populate: { path: 'user', select: 'name email phone' }
        });
      
      if (student) {
        extraDetails = {
          ...student.toObject(),
          class_name: student.class ? student.class.name : '',
          section_name: student.section ? student.section.name : '',
          father_name: student.parent ? student.parent.father_name : '',
          father_phone: student.parent ? student.parent.father_phone : ''
        };
      }
    } else if (user.role === 'teacher') {
      const teacher = await Teacher.findOne({ user: userId });
      if (teacher) extraDetails = teacher.toObject();
    } else if (['accountant', 'librarian', 'receptionist', 'hr', 'transport_manager', 'hostel_manager'].includes(user.role)) {
      const employee = await Employee.findOne({ user: userId });
      if (employee) extraDetails = employee.toObject();
    } else if (user.role === 'parent') {
      const parent = await Parent.findOne({ user: userId });
      if (parent) {
        extraDetails = parent.toObject();
        // Fetch children
        const children = await Student.find({ parent: parent._id })
          .populate('class', 'name')
          .populate('section', 'name')
          .populate('user', 'name');
        
        extraDetails.children = children.map(child => ({
          id: child._id.toString(),
          name: child.user ? child.user.name : '',
          roll_number: child.roll_number,
          class_name: child.class ? child.class.name : '',
          section_name: child.section ? child.section.name : ''
        }));
      }
    }

    res.json({
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        avatar: user.avatar,
        status: user.status,
        is_two_factor_enabled: user.is_two_factor_enabled,
        created_at: user.created_at
      },
      details: extraDetails
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Update Profile
exports.updateProfile = async (req, res) => {
  const { name, phone, avatar } = req.body;
  try {
    await User.findByIdAndUpdate(req.user.id, { name, phone, avatar });
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
      await User.findByIdAndUpdate(req.user.id, { refresh_token: null });
    }
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Setup Admin
exports.setupAdmin = async (req, res) => {
  try {
    const adminEmail = 'admin@eskooly.com';
    const hashedPassword = await bcrypt.hash('admin123', 10);
    
    let admin = await User.findOne({ email: adminEmail });
    if (!admin) {
      admin = new User({
        name: 'Admin',
        email: adminEmail,
        password: hashedPassword,
        role: 'school_admin',
        status: 'active'
      });
      await admin.save();
      res.json({ message: 'Admin created with password: admin123' });
    } else {
      admin.password = hashedPassword;
      admin.status = 'active';
      await admin.save();
      res.json({ message: 'Admin updated with hashed password' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Refresh Token
exports.refreshToken = async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(401).json({ message: 'Refresh token required' });
  }

  try {
    const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.id);
    if (!user || user.status !== 'active') {
      return res.status(401).json({ message: 'User not found or inactive' });
    }

    const tokens = generateTokens(user);
    res.json({
      token: tokens.accessToken,
      refreshToken: tokens.refreshToken
    });
  } catch (err) {
    console.error('Refresh token error:', err);
    res.status(401).json({ message: 'Invalid refresh token' });
  }
};
