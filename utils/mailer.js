const nodemailer = require('nodemailer');
const site = require('../config/site');

const provider = (process.env.MAIL_PROVIDER || (process.env.SMTP_HOST ? 'smtp' : '')).toLowerCase();
const from = process.env.MAIL_FROM || `${site.name} <no-reply@localhost>`;

const parseFrom = (value) => {
  const match = value.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  return match ? { name: match[1].replace(/^"|"$/g, ''), email: match[2] } : { name: site.name, email: value.trim() };
};

const postJson = async (url, headers, body) => {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000)
  });
  if (!res.ok) throw new Error(`Mail API ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json().catch(() => ({}));
};

let smtp = null;
const smtpTransport = () => {
  if (!smtp) {
    smtp = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined
    });
  }
  return smtp;
};

const senders = {
  resend: ({ to, subject, text, html }) =>
    postJson('https://api.resend.com/emails', { Authorization: `Bearer ${process.env.MAIL_API_KEY}` }, { from, to: [to], subject, text, html }),
  brevo: ({ to, subject, text, html }) =>
    postJson(
      'https://api.brevo.com/v3/smtp/email',
      { 'api-key': process.env.MAIL_API_KEY },
      { sender: parseFrom(from), to: [{ email: to }], subject, textContent: text, htmlContent: html }
    ),
  smtp: (mail) => smtpTransport().sendMail({ from, ...mail })
};

const send = async (mail) => {
  const deliver = senders[provider];
  if (!deliver) {
    console.log(`\n[mail:console] To: ${mail.to}\nSubject: ${mail.subject}\n${mail.text}\n`);
    return { console: true };
  }
  return deliver(mail);
};

const sendPasswordReset = (user, link) =>
  send({
    to: user.email,
    subject: `Reset your ${site.shortName} password`,
    text: `Hi ${user.name},\n\nUse this link within 60 minutes to choose a new password:\n${link}\n\nIf you did not ask for this, you can ignore this email.`,
    html: `<p>Hi ${user.name},</p><p>Use this link within 60 minutes to choose a new password:</p><p><a href="${link}">${link}</a></p><p>If you did not ask for this, you can ignore this email.</p>`
  });

module.exports = { send, sendPasswordReset };