const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');

function isValidEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(String(email).toLowerCase()) && email.length <= 254;
}

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_KEY must be set');
  return createClient(url, key, { auth: { persistSession: false } });
}

function generateToken() {
  return uuidv4();
}

module.exports = { isValidEmail, getSupabase, generateToken };
