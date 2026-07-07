const nodemailer = require('nodemailer');

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const email = (req.body && req.body.email ? String(req.body.email) : '').trim();

  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'Invalid email' });
  }

  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = Number(process.env.SMTP_PORT || 587);
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const mailTo = process.env.MAIL_TO || 'straycareofficial@gmail.com';

  if (!smtpHost || !smtpUser || !smtpPass) {
    return res.status(500).json({
      error: 'Missing SMTP configuration. Set SMTP_HOST, SMTP_PORT, SMTP_USER and SMTP_PASS in Vercel.'
    });
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
      user: smtpUser,
      pass: smtpPass
    }
  });

  try {
    await transporter.sendMail({
      from: process.env.MAIL_FROM || `StrayCare <${smtpUser}>`,
      to: mailTo,
      replyTo: email,
      subject: 'Nuova iscrizione alla waitlist StrayCare',
      text: `Nuova email waitlist: ${email}\n\nInviata dalla landing StrayCare.`,
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
          <h2 style="margin:0 0 12px">Nuova iscrizione alla waitlist StrayCare</h2>
          <p style="margin:0 0 8px">Hai ricevuto una nuova iscrizione da:</p>
          <p style="font-size:18px;font-weight:700;margin:0 0 16px">${email}</p>
          <p style="margin:0">Landing page StrayCare</p>
        </div>
      `
    });

    return res.status(200).json({ ok: true });
  } catch (error) {
    return res.status(500).json({ error: 'Unable to send email' });
  }
};