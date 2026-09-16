const nodemailer = require('nodemailer');

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function buildAdminHtml(lead) {
  const fields = [
    ['Nome e cognome', lead.name],
    ['Ruolo', lead.role],
    ['Ente o Comune', lead.ente],
    ['Provincia', lead.provincia],
    ['Email istituzionale', lead.email],
    ['Telefono', lead.phone || 'Non indicato'],
    ['Richiesta', lead.requestType],
    ['Note', lead.notes || 'Nessuna nota aggiuntiva']
  ];

  const rows = fields.map(([label, value]) => `
    <tr>
      <td style="padding:12px 0;border-bottom:1px solid #f0e4d9;color:#7b6b60;font-size:13px;vertical-align:top;width:34%;">${escapeHtml(label)}</td>
      <td style="padding:12px 0;border-bottom:1px solid #f0e4d9;color:#17212b;font-size:15px;font-weight:700;vertical-align:top;">${escapeHtml(value).replace(/\n/g, '<br />')}</td>
    </tr>
  `).join('');

  return `
    <div style="margin:0;padding:0;background:#fff7ef;font-family:Arial,sans-serif;">
      <div style="max-width:680px;margin:0 auto;padding:32px 16px;">
        <div style="background:linear-gradient(135deg,#fb7a1a 0%,#ff9a3e 100%);border-radius:28px 28px 18px 18px;padding:24px 26px;color:#fff;">
          <div style="font-size:13px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;opacity:.92;">StrayCare GovTech</div>
          <h1 style="margin:10px 0 0;font-size:28px;line-height:1.1;">Nuova richiesta istituzionale</h1>
          <p style="margin:10px 0 0;font-size:15px;line-height:1.6;opacity:.95;">Un ente ha richiesto un contatto per la piattaforma di gestione del randagismo.</p>
        </div>
        <div style="background:#fff;border:1px solid #f3e3d4;border-top:0;border-radius:0 0 28px 28px;padding:24px 26px;color:#17212b;">
          <table style="width:100%;border-collapse:collapse;">${rows}</table>
          <p style="margin:22px 0 0;color:#6b7280;font-size:13px;line-height:1.6;">Puoi rispondere direttamente a questa email per contattare il richiedente.</p>
        </div>
      </div>
    </div>
  `;
}

function buildConfirmationHtml(lead) {
  return `
    <div style="margin:0;padding:0;background:#fff7ef;font-family:Arial,sans-serif;">
      <div style="max-width:680px;margin:0 auto;padding:32px 16px;">
        <div style="background:linear-gradient(135deg,#fb7a1a 0%,#ff9a3e 100%);border-radius:30px;overflow:hidden;box-shadow:0 22px 48px rgba(251,122,26,.2);">
          <div style="padding:28px 28px 22px;color:#fff;">
            <div style="font-size:13px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;opacity:.9;">StrayCare GovTech</div>
            <h1 style="margin:10px 0 0;font-size:32px;line-height:1.05;">Richiesta ricevuta.</h1>
            <p style="margin:12px 0 0;font-size:16px;line-height:1.6;opacity:.96;">Grazie ${escapeHtml(lead.name)}, abbiamo ricevuto la tua richiesta per ${escapeHtml(lead.ente)}.</p>
          </div>
          <div style="background:#fff;padding:26px 28px;color:#17212b;">
            <p style="margin:0 0 14px;font-size:15px;line-height:1.7;color:#5e6974;">Il nostro referente per i Comuni e la Pubblica Amministrazione esaminerà le informazioni inviate e ti ricontatterà entro 24 ore lavorative.</p>
            <div style="margin-top:20px;padding:18px 20px;border-radius:18px;background:#fff7ef;border:1px solid #f2dfd0;">
              <p style="margin:0 0 8px;font-size:13px;color:#7b6b60;">Riepilogo richiesta</p>
              <p style="margin:0;font-size:16px;font-weight:800;color:#17212b;">${escapeHtml(lead.requestType)}</p>
              <p style="margin:8px 0 0;font-size:14px;color:#5e6974;">${escapeHtml(lead.ente)} · ${escapeHtml(lead.provincia)}</p>
            </div>
            <p style="margin:22px 0 0;font-size:14px;line-height:1.65;color:#6b7280;">Conferma automatica della richiesta inviata a StrayCare GovTech.</p>
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

  const body = req.body || {};
  const lead = {
    name: String(body.name || '').trim(),
    role: String(body.role || '').trim(),
    ente: String(body.ente || '').trim(),
    provincia: String(body.provincia || '').trim(),
    email: String(body.email || '').trim(),
    phone: String(body.phone || '').trim(),
    requestType: String(body.requestType || '').trim(),
    notes: String(body.notes || '').trim()
  };

  if (!lead.name || !lead.role || !lead.ente || !lead.provincia || !isValidEmail(lead.email) || !lead.requestType) {
    return res.status(400).json({ error: 'Dati della richiesta non validi' });
  }

  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = Number(process.env.SMTP_PORT || 587);
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const mailTo = process.env.MAIL_TO || 'straycareofficial@gmail.com';

  if (!smtpHost || !smtpUser || !smtpPass) {
    return res.status(200).json({ ok: true, warning: 'smtp-not-configured' });
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: { user: smtpUser, pass: smtpPass }
  });

  try {
    const [adminResult, confirmationResult] = await Promise.allSettled([
      transporter.sendMail({
        from: process.env.MAIL_FROM || `StrayCare GovTech <${smtpUser}>`,
        to: mailTo,
        replyTo: lead.email,
        subject: `Nuova richiesta PA: ${lead.requestType} - ${lead.ente}`,
        text: `Nuova richiesta istituzionale da ${lead.name} (${lead.role}) - ${lead.ente}, ${lead.provincia}. Email: ${lead.email}. Telefono: ${lead.phone || 'non indicato'}. Richiesta: ${lead.requestType}. Note: ${lead.notes || 'nessuna'}`,
        html: buildAdminHtml(lead)
      }),
      transporter.sendMail({
        from: process.env.MAIL_FROM || `StrayCare GovTech <${smtpUser}>`,
        to: lead.email,
        subject: 'Conferma richiesta istituzionale StrayCare',
        text: `Ciao ${lead.name}, abbiamo ricevuto la tua richiesta (${lead.requestType}) per ${lead.ente}. Ti ricontatteremo entro 24 ore lavorative.`,
        html: buildConfirmationHtml(lead)
      })
    ]);

    if (confirmationResult.status === 'rejected') {
      return res.status(500).json({ error: 'Unable to send confirmation email' });
    }

    return res.status(200).json({
      ok: true,
      warning: adminResult.status === 'rejected' ? 'admin-notification-failed' : undefined
    });
  } catch (error) {
    return res.status(500).json({ error: 'Unable to send email' });
  }
};
