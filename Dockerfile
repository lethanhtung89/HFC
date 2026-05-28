# ─── Stage 1: Build frontend ───────────────────────────────────
FROM node:18-alpine AS builder

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN NODE_ENV=production npm run build

# ─── Stage 2: Production nginx ─────────────────────────────────
FROM nginx:1.25-alpine

# Remove default config
RUN rm -f /etc/nginx/conf.d/default.conf

# Copy optimized nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Healthcheck for orchestration
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -qO- http://localhost/index.html > /dev/null || exit 1

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
