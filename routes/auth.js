const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { auth } = require('../middleware/auth');

// Public routes
router.post('/login', authController.login);
router.post('/verify-2fa', authController.verify2FA);
router.post('/refresh-token', authController.refreshToken);
router.post('/forgot-password', authController.forgotPassword);
router.post('/verify-otp', authController.verifyOTP);
router.post('/reset-password', authController.resetPassword);

// Protected routes (require login)
router.get('/profile', auth, authController.getProfile);
router.put('/profile', auth, authController.updateProfile);
router.post('/change-password', auth, authController.changePassword);
router.post('/setup-2fa', auth, authController.setup2FA);
router.post('/enable-2fa', auth, authController.enable2FA);
router.post('/disable-2fa', auth, authController.disable2FA);
router.post('/logout', auth, authController.logout);

// Setup route for convenience
router.post('/setup-admin', authController.setupAdmin);

module.exports = router;
