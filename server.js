require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const nodemailer = require('nodemailer');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '/')));

const DB = path.join(__dirname, 'subscriptions.json');
function readDB(){
  try{ return JSON.parse(fs.readFileSync(DB,'utf8')||'[]'); }catch(e){return []}
}
function writeDB(data){ fs.writeFileSync(DB, JSON.stringify(data, null, 2)); }

// Create transporter if SMTP env variables provided
let transporter = null;
if(process.env.SMTP_HOST && process.env.SMTP_USER){
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587',10),
    secure: (process.env.SMTP_SECURE === 'true'),
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
}

app.post('/api/subscribe', async (req,res)=>{
  const { email } = req.body || {};
  if(!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){
    return res.status(400).json({ error: 'Invalid email' });
  }
  const token = uuidv4();
  const db = readDB();
  const existing = db.find(s=>s.email.toLowerCase()===email.toLowerCase());
  if(existing){
    // regenerate token
    existing.token = token; existing.verified = !!existing.verified;
  } else {
    db.push({email, token, verified:false, created: new Date().toISOString()});
  }
  writeDB(db);

  const verifyUrl = `${req.protocol}://${req.get('host')}/api/verify?token=${token}`;

  // If transporter available, send real email, else return URL for simulation
  if(transporter){
    try{
      await transporter.sendMail({
        from: process.env.SMTP_FROM || 'no-reply@gujwear.example',
        to: email,
        subject: 'Verify your email — GujWear',
        text: `Thanks for joining GujWear! Verify here: ${verifyUrl}`,
        html: `<p>Thanks for joining GujWear! Click <a href="${verifyUrl}" target="_blank">Verify your email</a></p>`
      });
      return res.json({ ok: true, message: 'Verification email sent (check your inbox).' });
    }catch(err){
      console.error('Failed to send mail', err);
      return res.status(500).json({ ok:false, error: 'Failed to send email. Check server logs.' });
    }
  }

  // No SMTP configured — return verification URL for testing
  return res.json({ ok:true, message: 'No SMTP configured — use verificationUrl to simulate.', verificationUrl: verifyUrl });
});

app.get('/api/verify', (req,res)=>{
  const { token } = req.query || {};
  if(!token) return res.status(400).send('Missing token');
  const db = readDB();
  const item = db.find(s=>s.token===token);
  if(!item) return res.status(404).send('Token not found');
  item.verified = true; item.verifiedAt = new Date().toISOString();
  writeDB(db);
  // Simple confirmation page
  res.send(`<html><body style="font-family:system-ui,-apple-system,Segoe UI,Roboto;margin:40px;"><h2>GujWear — Email verified</h2><p>${item.email} is now verified. Thank you!</p><p><a href="/index.html">Return to site</a></p></body></html>`);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=>console.log(`Server running on http://localhost:${PORT}`));
