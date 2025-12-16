const { getSupabase } = require('./_helpers');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).send('Method not allowed');
  const { token } = req.query || {};
  if (!token) return res.status(400).send('Missing token');

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from(process.env.SUBSCRIPTIONS_TABLE || 'subscriptions')
      .select('*')
      .eq('token', token)
      .single();

    if (error || !data) return res.status(404).send('Token not found');

    if (new Date() > new Date(data.token_expiry)) return res.status(410).send('Link expired');

    await supabase
      .from(process.env.SUBSCRIPTIONS_TABLE || 'subscriptions')
      .update({ verified: true, verified_at: new Date().toISOString() })
      .eq('id', data.id);

    return res.send('<html><body><h2>Email verified. Thank you.</h2><p><a href="/">Back</a></p></body></html>');
  } catch (err) {
    console.error('verify error', err.message || err);
    return res.status(500).send('Server error');
  }
};
