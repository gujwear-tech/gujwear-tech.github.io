module.exports = async (req, res) => {
  return res.json({ ok: true, timestamp: new Date().toISOString(), mode: 'serverless' });
};
