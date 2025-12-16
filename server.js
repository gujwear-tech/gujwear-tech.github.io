require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const nodemailer = require('nodemailer');

// === CONFIG ===
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'subscriptions.json');
const TOKEN_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours
const RATE_LIMIT = {}; // in-memory rate limiting

// === LOGGER ===
const log = (level, msg, data = '') => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${level}: ${msg}`, data);
};

// === APP SETUP ===
const app = express();
app.use(cors());
app.use(express.json({ limit: '10kb' })); // limit payload size
app.use(express.urlencoded({ limit: '10kb', extended: false }));
app.use(express.static(path.join(__dirname, '/')));

// === DATABASE HELPERS ===
function readDB() {
  try {
    const data = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(data || '[]');
  } catch (e) {
    log('ERROR', 'Failed to read DB', e.message);
    return [];
  }
}

function writeDB(data) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
  } catch (e) {
    log('ERROR', 'Failed to write DB', e.message);
  }
}

// === RATE LIMITER ===
function checkRateLimit(ip) {
  const now = Date.now();
  if (!RATE_LIMIT[ip]) RATE_LIMIT[ip] = [];
  
  // Clean old entries (older than 1 hour)
  RATE_LIMIT[ip] = RATE_LIMIT[ip].filter(t => now - t < 60 * 60 * 1000);
  
  // Allow 5 requests per hour per IP
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
          <meta charset="utf-8">
          <style>
            body { font-family: 'Segoe UI', Roboto, sans-serif; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
            .header { text-align: center; margin-bottom: 40px; }
            .header h1 { color: #ff6b35; margin: 0; font-size: 28px; }
            .content { background: #f5f5f5; padding: 30px; border-radius: 10px; text-align: center; }
            .content p { margin: 16px 0; line-height: 1.6; }
            .button { 
              display: inline-block; 
              margin: 20px 0; 
              padding: 14px 32px; 
              background: linear-gradient(135deg, #ff6b35 0%, #ff8a5c 100%);
              color: white; 
              text-decoration: none; 
              border-radius: 8px; 
              font-weight: 700;
              transition: all 200ms ease;
            }
            .button:hover { transform: translateY(-2px); box-shadow: 0 10px 20px rgba(255, 107, 53, 0.3); }
            .footer { text-align: center; font-size: 12px; color: #999; margin-top: 40px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>GujWear</h1>
              <p style="color: #999; margin: 0;">Authentic Style, GujWear Pride.</p>
            </div>
            <div class="content">
              <h2 style="color: #333; margin-top: 0;">Verify Your Email</h2>
              <p>Thanks for joining the GujWear community! To confirm your subscription, click the button below:</p>
              <a href="${verifyUrl}" class="button">Verify My Email</a>
              <p style="font-size: 12px; color: #999;">Or copy this link: <br><code>${verifyUrl}</code></p>
              <p style="font-size: 12px; color: #999; margin-bottom: 0;">This link expires in 24 hours.</p>
            </div>
            <div class="footer">
              <p>You received this email because you signed up at gujwear.com</p>
              <p><a href="https://instagram.com/gujwear" style="color: #ff6b35; text-decoration: none;">Follow us on Instagram</a></p>
            </div>
          </div>
        </body>
      </html>
    `,
    text: `
      GujWear - Verify Your Email
      
      Thanks for joining GujWear! To confirm your subscription, visit this link:
      ${verifyUrl}
      
      This link expires in 24 hours.
      
      Follow us on Instagram: https://instagram.com/gujwear
    `,
  };
}

// === ROUTES ===

// Health check
app.get('/api/health', (req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString(), smtpConfigured });
});

// Subscribe endpoint
app.post('/api/subscribe', async (req, res) => {
  const ip = req.ip || req.connection.remoteAddress;
  
  // Rate limiting
  if (!checkRateLimit(ip)) {
    log('WARN', 'Rate limit exceeded', ip);
    return res.status(429).json({ error: 'Too many requests. Try again later.' });
  }

  const { email } = req.body || {};

  // Validation
  if (!email || !isValidEmail(email)) {
    log('WARN', 'Invalid email attempt', email);
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  try {
    const token = uuidv4();
    const db = readDB();
    const now = new Date().toISOString();

    // Check if email already exists
    const existing = db.find(s => s.email.toLowerCase() === email.toLowerCase());
    if (existing) {
      // Regenerate token and reset expiry
      existing.token = token;
      existing.tokenExpiry = new Date(Date.now() + TOKEN_EXPIRY).toISOString();
      if (!existing.firstSubscribedAt) existing.firstSubscribedAt = now;
      existing.lastAttemptAt = now;
      log('INFO', 'Email re-subscribed', email);
    } else {
      // New subscription
      db.push({
        id: uuidv4(),
        email,
        token,
        tokenExpiry: new Date(Date.now() + TOKEN_EXPIRY).toISOString(),
        verified: false,
        firstSubscribedAt: now,
        lastAttemptAt: now,
      });
      log('INFO', 'New subscription', email);
    }
    writeDB(db);

    const verifyUrl = `${req.protocol}://${req.get('host')}/api/verify?token=${token}`;
    const emailTemplate = getEmailTemplate(verifyUrl, email);

    // Send email if SMTP is configured
    if (smtpConfigured && transporter) {
      try {
        await transporter.sendMail({
          from: process.env.SMTP_FROM || 'noreply@gujwear.com',
          to: email,
          subject: emailTemplate.subject,
          text: emailTemplate.text,
          html: emailTemplate.html,
        });
        log('INFO', 'Verification email sent', email);
        return res.json({
          ok: true,
          message: 'Verification email sent! Check your inbox.',
        });
      } catch (err) {
        log('ERROR', 'Failed to send email', `${email}: ${err.message}`);
        return res.status(500).json({
          ok: false,
          error: 'Failed to send verification email. Please try again later.',
        });
      }
    }

    // No SMTP — return verification URL for testing
    log('WARN', 'SMTP disabled, returning test URL', email);
    return res.json({
      ok: true,
      message:
        'SMTP not configured. Use the verification URL below to simulate email verification.',
      verificationUrl: verifyUrl,
    });
  } catch (err) {
    log('ERROR', 'Subscribe endpoint error', err.message);
    return res.status(500).json({ error: 'An unexpected error occurred. Please try again.' });
  }
});

// Verify endpoint
app.get('/api/verify', (req, res) => {
  const { token } = req.query || {};

  if (!token) {
    return res.status(400).send(
      '<html><body style="font-family:system-ui;margin:40px;"><h2>❌ Error</h2><p>Missing verification token.</p></body></html>'
    );
  }

  try {
    const db = readDB();
    const item = db.find(s => s.token === token);

    if (!item) {
      log('WARN', 'Invalid verification token', token);
      return res.status(404).send(
        '<html><body style="font-family:system-ui;margin:40px;"><h2>❌ Token Not Found</h2><p>This verification link is invalid.</p><p><a href="/">Back to home</a></p></body></html>'
      );
    }

    // Check token expiry
    if (new Date() > new Date(item.tokenExpiry)) {
      log('WARN', 'Expired verification token', item.email);
      return res.status(410).send(
        '<html><body style="font-family:system-ui;margin:40px;"><h2>⏰ Link Expired</h2><p>This verification link has expired. Please subscribe again.</p><p><a href="/">Back to home</a></p></body></html>'
      );
    }

    // Mark as verified
    item.verified = true;
    item.verifiedAt = new Date().toISOString();
    writeDB(db);

    log('INFO', 'Email verified', item.email);

    // Success page
    return res.send(
      `<html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: 'Segoe UI', Roboto, sans-serif; color: #333; margin: 40px; }
            .container { max-width: 500px; margin: 0 auto; text-align: center; }
            .header h2 { color: #ff6b35; font-size: 28px; }
            .content p { line-height: 1.6; color: #666; }
            .button { display: inline-block; padding: 12px 24px; background: #ff6b35; color: white; text-decoration: none; border-radius: 8px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>✅ Email Verified!</h2>
            </div>
            <div class="content">
              <p><strong>${item.email}</strong> is now verified.</p>
              <p>Thanks for joining the GujWear community!</p>
              <p>We'll notify you when the new collection launches on <strong>January 1st, 2026</strong>.</p>
              <a href="/" class="button">Return to GujWear</a>
            </div>
          </div>
        </body>
      </html>`
    );
  } catch (err) {
    log('ERROR', 'Verify endpoint error', err.message);
    return res.status(500).send(
      '<html><body style="font-family:system-ui;margin:40px;"><h2>❌ Error</h2><p>An error occurred. Please try again.</p></body></html>'
    );
  }
});

// Admin: Get all subscriptions (protected by simple token)
app.get('/api/admin/subscriptions', (req, res) => {
  const adminToken = process.env.ADMIN_TOKEN;
  const token = req.query.token || req.headers['authorization']?.split(' ')[1];

  if (!adminToken || token !== adminToken) {
    log('WARN', 'Unauthorized admin access attempt', req.ip);
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const db = readDB();
    const stats = {
      total: db.length,
      verified: db.filter(s => s.verified).length,
      unverified: db.filter(s => !s.verified).length,
      subscriptions: db,
    };
    log('INFO', 'Admin stats accessed');
    return res.json(stats);
  } catch (err) {
    log('ERROR', 'Admin stats error', err.message);
    return res.status(500).json({ error: 'Failed to retrieve stats' });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// === START SERVER ===
app.listen(PORT, () => {
  log('INFO', `🚀 Server running on http://localhost:${PORT}`);
  log('INFO', `📧 SMTP: ${smtpConfigured ? 'Configured' : 'Not configured (test mode)'}`);
});
