require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const nodemailer = require('nodemailer');
const { createClient } = require('@supabase/supabase-js');

// === CONFIG ===
const PORT = process.env.PORT || 3000;
const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
const RATE_LIMIT = {}; 
const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PRODUCTION = NODE_ENV === 'production';

// === SUPABASE SETUP ===
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = (supabaseUrl && supabaseKey) 
  ? createClient(supabaseUrl, supabaseKey) 
  : null;

if (!supabase) console.warn('⚠️ WARNING: Supabase credentials missing.');

// === LOGGER ===
const log = (level, msg, data = '') => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${level}: ${msg}`, data ? JSON.stringify(data) : '');
};

const app = express();

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  if (IS_PRODUCTION) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json({ limit: '10kb' })); 
app.use(express.urlencoded({ limit: '10kb', extended: false }));

// === CRITICAL FIX: Static Files ===
// Serve static files correctly from root, css, js, and assets folders
app.use(express.static(__dirname)); 
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/js', express.static(path.join(__dirname, 'js')));
app.use('/assets', express.static(path.join(__dirname, 'assets')));

// === RATE LIMITER ===
function checkRateLimit(ip) {
  const now = Date.now();
  if (!RATE_LIMIT[ip]) RATE_LIMIT[ip] = [];
  RATE_LIMIT[ip] = RATE_LIMIT[ip].filter(t => now - t < 60 * 60 * 1000);
  if (RATE_LIMIT[ip].length >= 5) return false;
  RATE_LIMIT[ip].push(now);
  return true;
}

// === EMAIL HELPER ===
function isValidEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(String(email).toLowerCase()) && email.length <= 254;
}

let transporter = null;
if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

// === ROUTES ===

// API: Subscribe
app.post('/api/subscribe', async (req, res) => {
  const ip = req.ip || req.connection.remoteAddress;
  if (!checkRateLimit(ip)) return res.status(429).json({ error: 'Too many requests.' });

  const { email } = req.body || {};
  if (!email || !isValidEmail(email)) return res.status(400).json({ error: 'Invalid email.' });

  try {
    const token = uuidv4();
    const tokenExpiry = new Date(Date.now() + TOKEN_EXPIRY_MS).toISOString();
    const verifyUrl = `${req.protocol}://${req.get('host')}/api/verify?token=${token}`;

    if (supabase) {
      const { data: existing } = await supabase.from('subscriptions').select('*').eq('email', email).single();
      
      if (existing) {
        await supabase.from('subscriptions').update({ token, token_expiry: tokenExpiry }).eq('email', email);
      } else {
        await supabase.from('subscriptions').insert([{ email, token, token_expiry: tokenExpiry }]);
      }
    }

    if (transporter) {
      await transporter.sendMail({
        from: process.env.SMTP_FROM || 'noreply@gujwear.com',
        to: email,
        subject: 'Verify Your Email — GujWear',
        html: `<a href="${verifyUrl}">Click here to verify</a>`
      });
      return res.json({ ok: true, message: 'Check your inbox to verify.' });
    }

    return res.json({ ok: true, message: 'Subscription successful (Test Mode)', verificationUrl: verifyUrl });

  } catch (err) {
    log('ERROR', 'Subscribe error', err.message);
    return res.status(500).json({ error: 'Server Error' });
  }
});

// API: Verify
app.get('/api/verify', async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).send('Missing token');

  try {
    if (supabase) {
      const { data: user } = await supabase.from('subscriptions').select('*').eq('token', token).single();
      if (!user) return res.status(404).send('Invalid Token');
      
      await supabase.from('subscriptions').update({ verified: true }).eq('id', user.id);
    }
    res.send('<h1>✅ Email Verified!</h1><a href="/">Back to Home</a>');
  } catch (err) {
    res.status(500).send('Error verifying.');
  }
});

// Serve Index HTML for all other routes (SPA support)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// === SERVER START ===
if (require.main === module) {
  app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
}

module.exports = app;