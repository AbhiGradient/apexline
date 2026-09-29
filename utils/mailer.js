const nodemailer = require('nodemailer');
const site = require('../config/site');

const transporter = process.env.SMTP_HOST
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined
    })
  : null;

const send = async ({ to, subject, text, html }) => {
  if (!transporter) {
    console.log(`\n[mail:dev] To: ${to}\nSubject: ${subject}\n${text}\n`);
    return { dev: true };
  }
  return transporter.sendMail({
    from: process.env.MAIL_FROM || `${site.name} <no-reply@localhost>`,
    to,
    subject,
    text,
    html
  });
};

const sendPasswordReset = (user, link) =>
  send({
    to: user.email,
    subject: `Reset your ${site.shortName} password`,
    text: `Hi ${user.name},\n\nUse this link within 60 minutes to choose a new password:\n${link}\n\nIf you did not ask for this, you can ignore this email.`,
    html: `<p>Hi ${user.name},</p><p>Use this link within 60 minutes to choose a new password:</p><p><a href="${link}">${link}</a></p><p>If you did not ask for this, you can ignore this email.</p>`
  });

module.exports = { send, sendPasswordReset };