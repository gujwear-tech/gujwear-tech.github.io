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

// === STATIC FILES ===
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

// === CUSTOM EMAIL TEMPLATE (With Logo & Insta) ===
function getEmailTemplate(verifyUrl) {
  // Ensure 'assets/logo.svg' exists in your project for this to work perfectly in production
  const logoUrl = 'https://www.gujwear.live/assets/logo.svg'; 
  const instaUrl = 'https://www.instagram.com/gujwear';

  return {
    subject: '🚀 You’re on the list! Verify your GujWear subscription',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.05); }
            .header { background: #0f2040; padding: 40px 20px; text-align: center; }
            .header img { width: 80px; height: 80px; border-radius: 12px; }
            .header h1 { color: #ff6b35; margin: 15px 0 0; font-size: 24px; letter-spacing: 2px; text-transform: uppercase; }
            .content { padding: 40px 30px; text-align: center; color: #333; }
            .button { 
              display: inline-block; margin: 25px 0; padding: 16px 40px; 
              background: linear-gradient(135deg, #ff6b35 0%, #ff8a5c 100%);
              color: white !important; text-decoration: none; border-radius: 50px; 
              font-weight: bold; font-size: 16px;
            }
            .footer { background: #f4f4f4; padding: 20px; text-align: center; font-size: 12px; color: #888; }
            .footer a { color: #ff6b35; text-decoration: none; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <img src="${logoUrl}" alt="GujWear Logo">
              <h1>GujWear</h1>
            </div>
            <div class="content">
              <h2>Verify Your Email</h2>
              <p>Thanks for joining. You are one step away from exclusive access to our launch on <strong>Jan 1st, 2026</strong>.</p>
              <a href="${verifyUrl}" class="button">Verify Now</a>
              <p style="margin-top: 30px; font-size: 14px;">Follow us for daily drops: <br> <a href="${instaUrl}" style="color: #0f2040; font-weight: bold; text-decoration: none;">@gujwear</a></p>
            </div>
            <div class="footer">
              <p>Authentic Style. GujWear Pride.</p>
            </div>
          </div>
        </body>
      </html>
    `
  };
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
      // USE THE CUSTOM TEMPLATE HERE
      const template = getEmailTemplate(verifyUrl);
      
      await transporter.sendMail({
        from: process.env.SMTP_FROM || 'noreply@gujwear.com',
        to: email,
        subject: template.subject,
        html: template.html
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
    // Simple HTML response for verification
    res.send(`
      <html>
        <body style="background:#050d1a; color:white; font-family:sans-serif; text-align:center; display:flex; flex-direction:column; justify-content:center; height:100vh; margin:0;">
          <h1 style="color:#ff6b35;">✅ Email Verified!</h1>
          <p>You are now on the list.</p>
          <a href="/" style="color:white; text-decoration:underline;">Back to GujWear</a>
        </body>
      </html>
    `);
  } catch (err) {
    res.status(500).send('Error verifying.');
  }
});

// Serve Index HTML for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// === SERVER START ===
if (require.main === module) {
  app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
}

module.exports = app;