const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

async function sendMail({ to, subject, html }) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log('SMTP no configurado. Email no enviado:', subject, '->', to);
    return { sent: false, reason: 'SMTP not configured' };
  }

  const info = await transporter.sendMail({
    from: process.env.SMTP_FROM || `"Foro UTN" <${process.env.SMTP_USER}>`,
    to,
    subject,
    html
  });

  return { sent: true, messageId: info.messageId };
}

module.exports = { sendMail };
