const { isValidEmail, getSupabase, generateToken } = require('./_helpers');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email } = req.body || {};
  if (!email || !isValidEmail(email)) return res.status(400).json({ error: 'Invalid email' });

  try {
    const supabase = getSupabase();
    const token = generateToken();
    const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    // Upsert subscription
    const { data, error } = await supabase
      .from(process.env.SUBSCRIPTIONS_TABLE || 'subscriptions')
      .upsert({ email: email.toLowerCase(), token, token_expiry: tokenExpiry, verified: false, last_attempt_at: new Date().toISOString() }, { onConflict: 'email' })
      .select();

    if (error) throw error;

    const host = process.env.FRONTEND_URL || `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}`;
    const verifyUrl = `${host.replace(/\/$/, '')}/api/verify?token=${token}`;

    return res.json({ ok: true, verificationUrl: verifyUrl });
  } catch (err) {
    console.error('subscribe error', err.message || err);
    return res.status(500).json({ error: 'Server error' });
  }
};
