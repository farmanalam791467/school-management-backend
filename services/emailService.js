const nodemailer = require('nodemailer');
require('dotenv').config();

// Create reusable transporter object using the default SMTP transport
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.mailtrap.io',
  port: parseInt(process.env.SMTP_PORT || '2525'),
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || ''
  }
});

/**
 * Send an email
 * @param {string} to - Recipient email
 * @param {string} subject - Subject of the email
 * @param {string} text - Plain text body
 * @param {string} html - HTML body (optional)
 */
const sendEmail = async (to, subject, text, html = null) => {
  const mailOptions = {
    from: process.env.EMAIL_FROM || '"Secondary School of Modern Education" <no-reply@eskooly.com>',
    to,
    subject,
    text,
    html: html || text
  };

  // Check if SMTP is configured, else log to console
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
    console.log('\n==================================================');
    console.log(`[EMAIL LOG] Sending email to: ${to}`);
    console.log(`[EMAIL LOG] Subject: ${subject}`);
    console.log(`[EMAIL LOG] Content:\n${text}`);
    console.log('==================================================\n');
    return { message: 'Email logged to console (SMTP not configured)' };
  }

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`Email sent: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error('Error sending email: ', error);
    // Return mock success so the API doesn't crash
    return { error: error.message, fallback: true };
  }
};

module.exports = { sendEmail };
