// src/services/email.service.ts
import nodemailer, { Transporter } from 'nodemailer';

interface EmailAttachment {
  filename: string;
  content: string;     // Raw string content (e.g. CSV)
  contentType?: string;
}

interface EmailPayload {
  to: string;
  subject: string;
  body?: string;       // Plain text (legacy, used as fallback)
  html?: string;       // HTML body (preferred)
  attachments?: EmailAttachment[];
}

let transporter: Transporter | null = null;

// Initialize transporter if SMTP credentials are available
if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
} else {
  console.warn('⚠️ SMTP credentials not found. Emails will be logged only.');
}

export const sendEmailNotification = async ({ to, subject, body, html, attachments }: EmailPayload) => {
  if (!transporter) {
    // Log a shorter summary instead of full HTML
    const preview = html
      ? `[HTML email, ${html.length} chars]`
      : (body || '').slice(0, 200);
    console.log(`📧 [EMAIL LOG] To: ${to}, Subject: ${subject}, Body: ${preview}`);
    if (attachments?.length) {
      attachments.forEach(att => {
        console.log(`📎 [ATTACHMENT] ${att.filename} (${att.content.length} chars)`);
      });
    }
    return;
  }

  try {
    const fromAddress = process.env.EMAIL_FROM || 'no-reply@sentinelpay.com';

    const mailOptions: any = {
      from: fromAddress,
      to,
      subject,
    };

    if (html) {
      mailOptions.html = html;
      // Plain text fallback
      mailOptions.text = body || 'Please view this email in an HTML-compatible email client.';
    } else {
      mailOptions.text = body;
    }

    if (attachments?.length) {
      mailOptions.attachments = attachments.map(att => ({
        filename: att.filename,
        content: att.content,
        contentType: att.contentType || 'text/csv',
      }));
    }

    const info = await transporter.sendMail(mailOptions);
    console.log(`📧 Email sent: MessageId=${info.messageId}, To=${to}`);
  } catch (err) {
    console.error('❌ Failed to send email:', err);
  }
};