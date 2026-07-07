const fs = require('fs/promises');
const path = require('path');
const nodemailer = require('nodemailer');

const STORE_PATH = path.join(__dirname, 'waitlist-store.json');

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function extractEmail(record) {
  if (typeof record === 'string') {
    return normalizeEmail(record);
  }

  if (record && typeof record === 'object') {
    return normalizeEmail(record.normalizedEmail || record.email || '');
  }

  return '';
}

async function readStore() {
  try {
    const raw = await fs.readFile(STORE_PATH, 'utf8');

    if (!raw.trim()) {
      return [];
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }

    throw error;
  }
}

async function writeStore(entries) {
  await fs.writeFile(STORE_PATH, `${JSON.stringify(entries, null, 2)}\n`, 'utf8');
}

function buildAdminHtml(email) {
  return `
    <div style="margin:0;padding:0;background:#fff7ef;font-family:Inter,Arial,sans-serif;">
      <div style="max-width:640px;margin:0 auto;padding:32px 16px;">
        <div style="background:linear-gradient(135deg,#fb7a1a 0%,#ff9a3e 100%);border-radius:28px 28px 18px 18px;padding:22px 26px;color:#fff;box-shadow:0 18px 38px rgba(251,122,26,.24);">
          <div style="font-size:13px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;opacity:.92;">StrayCare</div>
          <h1 style="margin:10px 0 0;font-size:28px;line-height:1.05;letter-spacing:-.04em;">Nuova iscrizione alla waitlist</h1>
          <p style="margin:10px 0 0;font-size:15px;line-height:1.6;opacity:.95;">Hai ricevuto una nuova email da monitorare nel flusso del progetto.</p>
        </div>
        <div style="background:#ffffff;border:1px solid #f3e3d4;border-top:0;border-radius:0 0 28px 28px;padding:28px 26px;color:#17212b;box-shadow:0 18px 38px rgba(25,33,42,.08);">
          <p style="margin:0 0 8px;font-size:14px;color:#5e6974;">Indirizzo registrato</p>
          <p style="margin:0 0 18px;font-size:20px;font-weight:800;letter-spacing:-.02em;">${email}</p>
          <p style="margin:0;font-size:15px;line-height:1.65;color:#5e6974;">L'utente ha chiesto di seguire i prossimi aggiornamenti legati a StrayCare e alla campagna di crowdfunding.</p>
        </div>
      </div>
    </div>
  `;
}

function buildThankYouHtml(email) {
  return `
    <div style="margin:0;padding:0;background:#fff7ef;font-family:Inter,Arial,sans-serif;">
      <div style="max-width:680px;margin:0 auto;padding:32px 16px;">
        <div style="background:linear-gradient(135deg,#fb7a1a 0%,#ff9a3e 100%);border-radius:30px;overflow:hidden;box-shadow:0 22px 48px rgba(251,122,26,.26);">
          <div style="padding:28px 28px 20px;color:#fff;">
            <div style="font-size:13px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;opacity:.9;">StrayCare</div>
            <h1 style="margin:10px 0 0;font-size:34px;line-height:1.02;letter-spacing:-.05em;">Grazie per il tuo supporto.</h1>
            <p style="margin:12px 0 0;font-size:16px;line-height:1.65;max-width:52ch;opacity:.96;">Sei entrato nella community che vuole rendere più semplice l'aiuto agli animali randagi.</p>
          </div>
          <div style="background:#fff;border-top:1px solid rgba(255,255,255,.18);padding:28px;color:#17212b;">
            <p style="margin:0 0 14px;font-size:16px;line-height:1.7;color:#374151;">Ciao <strong>${email}</strong>,</p>
            <p style="margin:0 0 14px;font-size:15px;line-height:1.75;color:#5e6974;">grazie per aver sostenuto StrayCare e per aver scelto di seguire questo progetto dedicato alla tutela degli animali randagi. Ogni iscritto ci aiuta a costruire una rete più consapevole, più vicina e più pronta ad agire.</p>
            <p style="margin:0 0 14px;font-size:15px;line-height:1.75;color:#5e6974;">Ti aggiorneremo sui prossimi passi, sulle novità della piattaforma e sull'avanzamento della campagna di crowdfunding, così potrai accompagnare da vicino la nascita di StrayCare.</p>
            <div style="margin-top:22px;padding:18px 20px;border-radius:22px;background:linear-gradient(180deg,#fff7ef 0%,#fffdf9 100%);border:1px solid #f2dfd0;">
              <p style="margin:0;font-size:15px;line-height:1.7;color:#374151;">Con il tuo supporto possiamo trasformare una buona intenzione in uno strumento utile per chi segnala, per chi aiuta e soprattutto per gli animali che hanno bisogno di attenzione.</p>
            </div>
            <p style="margin:22px 0 0;font-size:14px;line-height:1.65;color:#6b7280;">Con gratitudine,<br /><strong>Team StrayCare</strong></p>
          </div>
        </div>
      </div>
    </div>
  `;
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
  const normalizedEmail = normalizeEmail(email);

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
    const entries = await readStore();
    const alreadyRegistered = entries.some((entry) => extractEmail(entry) === normalizedEmail);

    if (alreadyRegistered) {
      return res.status(409).json({
        error: 'Questa email è già presente nella waitlist.'
      });
    }

    const updatedEntries = [
      ...entries,
      {
        email,
        normalizedEmail,
        createdAt: new Date().toISOString()
      }
    ];

    await writeStore(updatedEntries);

    const [adminResult, thankYouResult] = await Promise.allSettled([
      transporter.sendMail({
      from: process.env.MAIL_FROM || `StrayCare <${smtpUser}>`,
      to: mailTo,
      replyTo: email,
      subject: 'Nuova iscrizione alla waitlist StrayCare',
      text: `Nuova email waitlist: ${email}\n\nInviata dalla landing StrayCare.`,
      html: buildAdminHtml(email)
      }),
      transporter.sendMail({
        from: process.env.MAIL_FROM || `StrayCare <${smtpUser}>`,
        to: email,
        subject: 'Grazie per il tuo supporto a StrayCare',
        text: `Grazie per il tuo supporto a StrayCare. Riceverai presto aggiornamenti sulla piattaforma e sulla campagna crowdfunding.`,
        html: buildThankYouHtml(email)
      })
    ]);

    if (thankYouResult.status === 'rejected') {
      return res.status(500).json({ error: 'Unable to send thank-you email' });
    }

    return res.status(200).json({ ok: true, warning: adminResult.status === 'rejected' ? 'admin-notification-failed' : undefined });
  } catch (error) {
    return res.status(500).json({ error: 'Unable to send email' });
  }
};