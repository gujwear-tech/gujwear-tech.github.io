const nodemailer = require('nodemailer');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { email, message } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Missing email' });

  const ownerEmail = process.env.NOTIFY_EMAIL || process.env.SMTP_FROM || 'official@gujwear.live';

  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });

    try {
      await transporter.sendMail({
        from: process.env.SMTP_FROM || 'noreply@gujwear.live',
        to: ownerEmail,
        subject: `New interest: ${email} — GujWear`,
        text: `Email: ${email}\nMessage: ${message || '—'}`,
      });
      return res.json({ ok: true, message: 'Owner notified' });
    } catch (err) {
      console.error('notify error', err.message || err);
      return res.status(500).json({ error: 'Failed to send' });
    }
  }

  // No SMTP — log and return success
  console.log('Owner notify (logged):', { email, message });
  return res.json({ ok: true, message: 'Owner notification logged (no SMTP)' });
};
