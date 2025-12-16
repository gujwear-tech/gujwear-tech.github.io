# GujWear — Coming Soon Landing Page

Beautiful, interactive coming soon page for GujWear men's shirt brand with email subscription and verification system.

## Features

- ✨ **Interactive UI** — Card tilt, button ripples, smooth animations
- 🎨 **Modern Design** — Gradient backgrounds, glassmorphism effects, premium styling
- 📧 **Email Subscription** — Collect emails with verification system
- ⏰ **Countdown Timer** — Launches Jan 1st, 2026
- 👕 **Swinging Shirt Animation** — Engaging brand element
- 🚀 **Node.js Backend** — Express server with email sending
- 🔐 **Security** — Rate limiting, input validation, token expiration
- 📊 **Admin Panel** — View subscription statistics (protected)
- 🌐 **SMTP Support** — Real email verification or test mode

## Quick Start

### 1. Static Preview (No Backend)

```bash
python3 -m http.server 8000
# Open: http://localhost:8000/index.html
```

### 2. Run with Node.js Backend

```bash
npm install
npm start
# Open: http://localhost:3000
```

## Configuration

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `SMTP_HOST` | - | SMTP server (e.g., `smtp.gmail.com`) |
| `SMTP_PORT` | `587` | SMTP port |
| `SMTP_USER` | - | SMTP username/email |
| `SMTP_PASS` | - | SMTP password |
| `SMTP_SECURE` | `false` | Use TLS/SSL |
| `SMTP_FROM` | `noreply@gujwear.com` | From email address |
| `ADMIN_TOKEN` | - | Token to access admin stats |

### Gmail SMTP Setup

1. Enable 2-Step Verification in [Google Account](https://myaccount.google.com)
2. Create an [App Password](https://myaccount.google.com/apppasswords)
3. Use the 16-character password in `.env`:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=youremail@gmail.com
SMTP_PASS=xxxx xxxx xxxx xxxx
SMTP_FROM=noreply@gujwear.com
```

## API Endpoints

### `POST /api/subscribe`

Subscribe email for notifications.

**Request:**
```json
{
  "email": "user@example.com"
}
```

**Response (with SMTP):**
```json
{
  "ok": true,
  "message": "Verification email sent! Check your inbox."
}
```

**Response (test mode):**
```json
{
  "ok": true,
  "message": "SMTP not configured...",
  "verificationUrl": "http://localhost:3000/api/verify?token=..."
}
```

### `GET /api/verify?token=...`

Verify email and mark subscription as complete. Redirects to success page.

### `GET /api/health`

Health check endpoint.

**Response:**
```json
{
  "ok": true,
  "timestamp": "2025-12-16T12:00:00Z",
  "smtpConfigured": true
}
```

### `GET /api/admin/subscriptions?token=...`

Get subscription statistics (requires `ADMIN_TOKEN`).

**Response:**
```json
{
  "total": 42,
  "verified": 35,
  "unverified": 7,
  "subscriptions": [...]
}
```

## Features

### 🎨 Frontend

- Responsive design (desktop & mobile)
- Countdown timer (Jan 1, 2026)
- Email subscription form with validation
- Card tilt & hover effects
- Button ripple animations
- Swinging shirt animation
- Interactive teaser cards
- Social links (Instagram, mailto)
- Gradient backgrounds & glassmorphism

### 🛡️ Backend

- **Rate Limiting** — 5 requests per hour per IP
- **Input Validation** — Email validation & length checks
- **Email Verification** — 24-hour token expiration
- **Logging** — Detailed server logs with timestamps
- **Error Handling** — Comprehensive error messages
- **Beautiful Emails** — HTML & text templates
- **Admin Panel** — Protected statistics endpoint
- **Test Mode** — Works without SMTP (shows verification link)

## File Structure

```
/
├── index.html           # Main page
├── css/
│   └── style.css        # Styling & animations
├── js/
│   └── main.js          # Frontend logic
├── assets/
│   └── logo.png         # Brand logo (add yours here)
├── server.js            # Express backend
├── package.json         # Node dependencies
├── subscriptions.json    # Email database
├── .env.example         # Configuration template
└── README.md            # This file
```

## Development

- Replace `assets/logo.png` with your brand logo
- Customize countdown date in `js/main.js` (line 11)
- Customize email templates in `server.js` (`getEmailTemplate` function)
- Customize brand colors in `css/style.css` (CSS variables section)

## Deployment

### Heroku

```bash
git push heroku main
```

### Netlify (Frontend only)

Deploy the static files to Netlify without backend.

### Railway / Render

Create a new Node.js project and set environment variables.

## License

Built for GujWear. © 2025.