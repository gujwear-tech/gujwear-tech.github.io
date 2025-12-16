require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const nodemailer = require('nodemailer');
const { createClient } = require('@supabase/supabase-js');

// === CONFIG ===
const PORT = process.env.PORT || 3000;
const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000; 
const ADMIN_EMAIL = 'gujwear@gmail.com'; // <--- Admin gets notified here
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

// === HELPER: Email Validation ===
function isValidEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(String(email).toLowerCase()) && email.length <= 254;
}

// === TEMPLATE 1: For USER (Verification) ===
function getUserTemplate(verifyUrl) {
  const logoUrl = 'https://www.gujwear.live/assets/logo.png'; 
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
              <img src="${logoUrl}" alt="GujWear Logo" />
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

// === TEMPLATE 2: For ADMIN (Notification) ===
function getAdminTemplate(userEmail, ip) {
  return {
    subject: `🔔 New Subscriber: ${userEmail}`,
    html: `
      <div style="font-family:sans-serif; padding:20px; border:1px solid #333; background:#0f2040; color:white;">
        <h2 style="color:#ff6b35;">New Subscription!</h2>
        <p><strong>Email:</strong> ${userEmail}</p>
        <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
        <p><strong>IP Address:</strong> ${ip}</p>
        <hr style="border-color:#555;">
        <p style="font-size:12px; color:#ccc;">This is an automated alert from GujWear Live.</p>
      </div>
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

app.post('/api/subscribe', async (req, res) => {
  const ip = req.ip || req.connection.remoteAddress;
  if (!checkRateLimit(ip)) return res.status(429).json({ error: 'Too many requests.' });

  const { email } = req.body || {};
  if (!email || !isValidEmail(email)) return res.status(400).json({ error: 'Invalid email.' });

  try {
    const token = uuidv4();
    const tokenExpiry = new Date(Date.now() + TOKEN_EXPIRY_MS).toISOString();
    const verifyUrl = `${req.protocol}://${req.get('host')}/api/verify?token=${token}`;

    // 1. Save to DB
    if (supabase) {
      const { data: existing } = await supabase.from('subscriptions').select('*').eq('email', email).single();
      if (existing) {
        await supabase.from('subscriptions').update({ token, token_expiry: tokenExpiry }).eq('email', email);
      } else {
        await supabase.from('subscriptions').insert([{ email, token, token_expiry: tokenExpiry }]);
      }
    }

    if (transporter) {
      // 2. Send Email to USER
      const userMail = getUserTemplate(verifyUrl);
      await transporter.sendMail({
        from: process.env.SMTP_FROM || 'noreply@gujwear.com',
        to: email,
        subject: userMail.subject,
        html: userMail.html
      });

      // 3. Send Email to ADMIN (You)
      const adminMail = getAdminTemplate(email, ip);
      await transporter.sendMail({
        from: process.env.SMTP_FROM || 'noreply@gujwear.com',
        to: ADMIN_EMAIL, // gujwear@gmail.com
        subject: adminMail.subject,
        html: adminMail.html
      });

      return res.json({ ok: true, message: 'Check your inbox to verify.' });
    }

    return res.json({ ok: true, message: 'Subscription successful (Test Mode)', verificationUrl: verifyUrl });

  } catch (err) {
    console.error('Subscribe error:', err.message);
    return res.status(500).json({ error: 'Server Error' });
  }
});

app.get('/api/verify', async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).send('Missing token');

  try {
    if (supabase) {
      const { data: user } = await supabase.from('subscriptions').select('*').eq('token', token).single();
      if (!user) return res.status(404).send('Invalid Token');
      
      await supabase.from('subscriptions').update({ verified: true }).eq('id', user.id);
    }
    res.send(`
      <body style="background:#050d1a; color:white; font-family:sans-serif; text-align:center; padding-top:100px;">
        <h1 style="color:#ff6b35;">✅ Email Verified!</h1>
        <p>You are now on the list.</p>
        <a href="/" style="color:white;">Back to Home</a>
      </body>
    `);
  } catch (err) {
    res.status(500).send('Error verifying.');
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

if (require.main === module) {
  app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
}

module.exports = app;