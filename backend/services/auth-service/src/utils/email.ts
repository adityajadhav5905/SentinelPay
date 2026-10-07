import nodemailer from 'nodemailer';

// Generate Ethereal test account on the fly or use a fixed one if provided in env
let transporter: nodemailer.Transporter;

const initTransporter = async () => {
  if (!transporter) {
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
    } else {
      // Create a test account dynamically if no SMTP config is found
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false, // true for 465, false for other ports
        auth: {
          user: testAccount.user, // generated ethereal user
          pass: testAccount.pass, // generated ethereal password
        },
      });
      console.log('📧 Ethereal Email Account Created: %s', testAccount.user);
    }
  }
  return transporter;
};

export const sendOTPEmail = async (to: string, otp: string, purpose: 'registration' | 'reset') => {
  const mailer = await initTransporter();

  const subject = purpose === 'registration'
    ? 'Verify your SentinelPay Account'
    : 'Reset your SentinelPay Password';

  const html = `
    <div style="font-family: Arial, sans-serif; max-w-lg mx-auto p-6 bg-gray-50 rounded-lg">
      <h2 style="color: #4f46e5;">SentinelPay ${purpose === 'registration' ? 'Registration' : 'Password Reset'}</h2>
      <p>Here is your One-Time Password (OTP) to ${purpose === 'registration' ? 'verify your email' : 'reset your password'}:</p>
      <div style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #111827; padding: 20px; background: #fff; border-radius: 8px; text-align: center; margin: 20px 0;">
        ${otp}
      </div>
      <p>This code will expire in 10 minutes.</p>
      <p style="color: #6b7280; font-size: 14px;">If you did not request this, please ignore this email.</p>
    </div>
  `;

  const info = await mailer.sendMail({
    from: '"SentinelPay Security" <security@sentinelpay.io>',
    to,
    subject,
    html,
  });

  console.log('Message sent: %s', info.messageId);
  // Preview only available when sending through an Ethereal account
  const previewUrl = nodemailer.getTestMessageUrl(info);
  if (previewUrl) {
    console.log('Preview URL: %s', previewUrl);
  }
};
