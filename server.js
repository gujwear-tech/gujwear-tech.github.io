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
const RATE_LIMIT = {}; // In-memory rate limiting (Note: Resets on serverless cold start)
const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PRODUCTION = NODE_ENV === 'production';

// === SUPABASE SETUP ===
// Make sure SUPABASE_URL and SUPABASE_KEY are in your .env file
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = (supabaseUrl && supabaseKey) 
  ? createClient(supabaseUrl, supabaseKey) 
  : null;

if (!supabase) {
  console.warn('⚠️ WARNING: Supabase credentials missing. Database features will fail.');
}

// === LOGGER ===
const log = (level, msg, data = '') => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${level}: ${msg}`, data ? JSON.stringify(data) : '');
};

// === APP SETUP ===
const app = express();

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  if (IS_PRODUCTION) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

// Compression & CORS
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json({ limit: '10kb' })); 
app.use(express.urlencoded({ limit: '10kb', extended: false }));

// Static file serving
app.use(express.static(path.join(__dirname, '/'), {
  maxAge: IS_PRODUCTION ? '1d' : '0',
  etag: false,
}));

// === RATE LIMITER ===
function checkRateLimit(ip) {
  const now = Date.now();
  if (!RATE_LIMIT[ip]) RATE_LIMIT[ip] = [];
  RATE_LIMIT[ip] = RATE_LIMIT[ip].filter(t => now - t < 60 * 60 * 1000);
  if (RATE_LIMIT[ip].length >= 5) return false;
  RATE_LIMIT[ip].push(now);
  return true;
}

// === EMAIL VALIDATOR ===
function isValidEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(String(email).toLowerCase()) && email.length <= 254;
}

// === EMAIL TRANSPORTER ===
let transporter = null;
let smtpConfigured = false;

if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  smtpConfigured = true;
  log('INFO', 'SMTP configured', `Host: ${process.env.SMTP_HOST}`);
} else {
  log('WARN', 'SMTP not configured — using test mode');
}

// === EMAIL TEMPLATES ===
function getEmailTemplate(verifyUrl, email) {
  return {
    subject: '✉️ Verify Your Email — GujWear',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: 'Segoe UI', Roboto, sans-serif; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
            .button { 
              display: inline-block; margin: 20px 0; padding: 14px 32px; 
              background: linear-gradient(135deg, #ff6b35 0%, #ff8a5c 100%);
              color: white; text-decoration: none; border-radius: 8px; font-weight: 700;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1 style="color: #ff6b35;">GujWear</h1>
            <p>Thanks for joining! Click below to verify:</p>
            <a href="${verifyUrl}" class="button">Verify My Email</a>
            <p style="font-size: 12px; color: #999;">Link expires in 24 hours.</p>
          </div>
        </body>
      </html>
    `,
    text: `GujWear - Verify: ${verifyUrl}`,
  };
}

// === ROUTES ===

// Health check
app.get('/api/health', (req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString(), smtpConfigured, db: !!supabase });
});

// Subscribe endpoint
app.post('/api/subscribe', async (req, res) => {
  const ip = req.ip || req.connection.remoteAddress;
  
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: 'Too many requests. Try again later.' });
  }

  const { email } = req.body || {};
  if (!email || !isValidEmail(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  try {
    const token = uuidv4();
    const tokenExpiry = new Date(Date.now() + TOKEN_EXPIRY_MS).toISOString();
    const verifyUrl = `${req.protocol}://${req.get('host')}/api/verify?token=${token}`;

    // 1. Check if email exists in Supabase
    const { data: existingUser, error: fetchError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('email', email)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 is "not found"
      throw fetchError;
    }

    // 2. Insert or Update
    if (existingUser) {
      await supabase
        .from('subscriptions')
        .update({ token, token_expiry: tokenExpiry, last_attempt_at: new Date() })
        .eq('email', email);
      log('INFO', 'Email re-subscribed', email);
    } else {
      await supabase
        .from('subscriptions')
        .insert([{ 
          email, 
          token, 
          token_expiry: tokenExpiry, 
          verified: false,
          created_at: new Date() 
        }]);
      log('INFO', 'New subscription', email);
    }

    // 3. Send Email
    if (smtpConfigured && transporter) {
      const emailTemplate = getEmailTemplate(verifyUrl, email);
      await transporter.sendMail({
        from: process.env.SMTP_FROM || 'noreply@gujwear.com',
        to: email,
        subject: emailTemplate.subject,
        text: emailTemplate.text,
        html: emailTemplate.html,
      });
      return res.json({ ok: true, message: 'Verification email sent! Check your inbox.' });
    }

    return res.json({ ok: true, message: 'SMTP not configured (Test Mode)', verificationUrl: verifyUrl });

  } catch (err) {
    log('ERROR', 'Subscribe error', err.message);
    return res.status(500).json({ error: 'Database or Server Error.' });
  }
});

// Verify endpoint
app.get('/api/verify', async (req, res) => {
  const { token } = req.query || {};
  if (!token) return res.status(400).send('Missing token');

  try {
    // 1. Find user by token
    const { data: user, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('token', token)
      .single();

    if (error || !user) {
      return res.status(404).send('<h2>❌ Invalid or Unknown Token</h2>');
    }

    // 2. Check Expiry
    if (new Date() > new Date(user.token_expiry)) {
      return res.status(410).send('<h2>⏰ Token Expired</h2>');
    }

    // 3. Update to Verified
    await supabase
      .from('subscriptions')
      .update({ verified: true, verified_at: new Date() })
      .eq('id', user.id);

    return res.send(
      `<html><body style="font-family:sans-serif; text-align:center; margin-top:50px;">
        <h2 style="color:#ff6b35">✅ Email Verified!</h2>
        <p>${user.email} is now subscribed.</p>
        <a href="/">Return Home</a>
      </body></html>`
    );

  } catch (err) {
    log('ERROR', 'Verify error', err.message);
    return res.status(500).send('Internal Error');
  }
});

// Admin Stats
app.get('/api/admin/subscriptions', async (req, res) => {
  const adminToken = process.env.ADMIN_TOKEN;
  const token = req.query.token || req.headers['authorization']?.split(' ')[1];

  if (!adminToken || token !== adminToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { count, error } = await supabase
      .from('subscriptions')
      .select('*', { count: 'exact', head: true });
    
    if (error) throw error;

    return res.json({ total_subscribers: count });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// 404 handler
app.use((req, res) => {
  // If request is for API, return JSON
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'Endpoint not found' });
  }
  // Otherwise serve the main index.html for SPA (or just 404 page)
  res.sendFile(path.join(__dirname, 'index.html'));
});

// === SERVER START (FIXED FOR VERCEL) ===
if (require.main === module) {
  const server = app.listen(PORT, () => {
    log('INFO', `🚀 Server running on http://localhost:${PORT}`);
  });
}

// Export for Vercel
module.exports = app;