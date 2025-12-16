# Build & Deployment Configuration

## Build Process

### Scripts

```bash
# Production build (default)
npm start

# Development mode
npm run dev

# Build assets
npm run build

# Run tests
npm test

# Lint code
npm lint
```

### Environment Variables

Set these in `.env`:

```env
NODE_ENV=production
PORT=3000
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
ADMIN_TOKEN=your-secret-token
```

## Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Configure SMTP variables for real email sending
- [ ] Set `ADMIN_TOKEN` for admin panel access
- [ ] Test all endpoints on production domain
- [ ] Verify SSL/TLS certificate
- [ ] Configure CDN for static assets
- [ ] Set up monitoring/logging
- [ ] Enable error tracking (Sentry, etc.)

## Deployment Platforms

### Heroku

```bash
# Login to Heroku
heroku login

# Create app
heroku create gujwear-coming-soon

# Set config vars
heroku config:set NODE_ENV=production
heroku config:set SMTP_HOST=smtp.gmail.com
heroku config:set SMTP_USER=your-email@gmail.com
heroku config:set SMTP_PASS=your-app-password
heroku config:set ADMIN_TOKEN=your-secret

# Deploy
git push heroku main

# View logs
heroku logs --tail
```

### Railway

1. Connect GitHub repo to Railway
2. Set environment variables in Railway dashboard
3. Deploy automatically on push

### Docker

```bash
# Build image
docker build -t gujwear-coming-soon .

# Run container
docker run -p 3000:3000 \
  -e NODE_ENV=production \
  -e SMTP_HOST=smtp.gmail.com \
  -e SMTP_USER=your-email@gmail.com \
  -e SMTP_PASS=your-app-password \
  gujwear-coming-soon
```

### Dockerfile

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

ENV NODE_ENV=production
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

CMD ["node", "server.js"]
```

## Performance Optimization

### Caching Strategy

- Static files: 1 day cache (production)
- API responses: No cache (dynamic content)
- Database: In-memory rate limiting

### Security Headers

- X-Content-Type-Options: nosniff
- X-Frame-Options: SAMEORIGIN
- X-XSS-Protection: 1; mode=block
- Strict-Transport-Security: max-age=31536000

### Rate Limiting

- 5 requests per hour per IP
- Automatic cleanup of old entries
- Protects against abuse

## Monitoring

### Health Check

```bash
curl http://localhost:3000/api/health
```

### View Subscriptions

```bash
curl "http://localhost:3000/api/admin/subscriptions?token=YOUR_ADMIN_TOKEN"
```

### Server Logs

```bash
npm run dev 2>&1 | tee server.log
```

## Troubleshooting

### Port Already in Use

```bash
# Find process using port 3000
lsof -i :3000

# Kill process
kill -9 <PID>
```

### SMTP Not Working

1. Verify credentials in `.env`
2. Check firewall settings
3. Test with telnet: `telnet smtp.gmail.com 587`
4. Review SMTP logs in server output

### Database Issues

1. Check `subscriptions.json` exists and is readable
2. Verify write permissions to directory
3. Backup database regularly

## Backup & Recovery

```bash
# Backup subscriptions
cp subscriptions.json subscriptions.json.backup

# Restore from backup
cp subscriptions.json.backup subscriptions.json
```
