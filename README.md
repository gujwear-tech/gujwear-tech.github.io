# GujWear

This repo contains a simple "Coming Soon" landing page for the GujWear men's shirt brand.

Changes in this update:
- Added interactive card tilt and button ripple.
- Replaced brand header to use `assets/logo.png` (place your logo there).
- Social links: Instagram -> https://www.instagram.com/gujwear and Contact -> `mailto:gujwear@gmail.com`.

Preview locally (static only):

```bash
# from the repository root (static preview only)
python3 -m http.server 8000
# then open http://localhost:8000/index.html in your browser
```

Run backend server (subscribe + verify):

```bash
# install deps
npm install
# start server (defaults to port 3000)
npm start
# open http://localhost:3000/index.html
```

SMTP (optional): set these environment variables to send real verification emails

- `SMTP_HOST` - SMTP host
- `SMTP_PORT` - SMTP port (587)
- `SMTP_SECURE` - `true` if using TLS/SSL
- `SMTP_USER` - SMTP username
- `SMTP_PASS` - SMTP password
- `SMTP_FROM` - optional from address

Files added/updated: `index.html`, `css/style.css`, `js/main.js`, `assets/README.md`, `server.js`, `package.json`, `subscriptions.json`.