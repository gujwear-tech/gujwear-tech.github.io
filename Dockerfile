FROM node:20-bullseye-slim

WORKDIR /app

# Install runtime/build deps required by some native modules (sharp/libvips)
RUN apt-get update && apt-get install -y --no-install-recommends \
  build-essential python3 libvips-dev ca-certificates && \
  rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production

# Install dependencies first for caching
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# Copy app sources
COPY . .

# Build static assets if present
RUN npm run build || true

EXPOSE 3000
ENV PORT=3000

CMD ["node", "server.js"]
