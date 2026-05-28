# Cloudflare Configuration Checklist — hfc.tlserver.pro.vn

## 1. SSL/TLS (Encryption)
- [x] SSL Mode: **Full (Strict)** — origin has valid cert or Cloudflare origin cert
  - If Synology origin is HTTP-only behind tunnel: **Full** is sufficient
- [x] Always Use HTTPS: **ON**
- [x] HTTP/3 (QUIC): **ON**
- [x] 0-RTT Connection Resumption: **ON**
- [x] TLS 1.3: **ON**
- [x] Minimum TLS Version: **1.2**

## 2. Speed → Optimization
- [x] Auto Minify: **OFF** (already minified by Vite/esbuild; double-minify can break)
- [x] Brotli: **ON** (Cloudflare edge compression, ~15-20% smaller than gzip)
- [x] Early Hints (103): **ON** (preload hints for fonts/CSS)
- [x] Rocket Loader: **OFF** ⚠️ (breaks SPA React apps — defers scripts incorrectly)
- [x] Mirage: **OFF** (image lazy-loading for mobile; not needed for SPA)
- [x] Polish: **OFF** (image optimization; no images served from origin)

## 3. Caching
- [x] Caching Level: **Standard**
- [x] Browser Cache TTL: **Respect Existing Headers** (nginx sends correct Cache-Control)
- [x] Page Rules or Cache Rules:
  - `/assets/*` → Cache Everything, Edge TTL: 30 days
  - `/api/*` → Bypass Cache
  - `/auth/*` → Bypass Cache
  - `/index.html` → Bypass Cache

### Recommended Cache Rules (Dashboard → Caching → Cache Rules):
```
Rule 1: Cache static assets
  When: URI Path starts with "/assets/"
  Then: Cache Everything, Edge TTL = 30 days, Browser TTL = 365 days

Rule 2: Bypass API
  When: URI Path starts with "/api/" OR URI Path starts with "/auth/"
  Then: Bypass Cache

Rule 3: Bypass HTML
  When: URI Path equals "/" OR URI Path equals "/index.html"
  Then: Bypass Cache
```

## 4. Security
- [x] WAF: **Managed Rules ON** (default Cloudflare managed ruleset)
- [x] Bot Fight Mode: **ON** (basic bot protection)
- [x] Browser Integrity Check: **ON**
- [x] Hotlink Protection: **OFF** (no external image assets)
- [x] Security Level: **Medium**
- [x] Challenge Passage: **30 minutes**

## 5. Network
- [x] HTTP/2: **ON** (enabled by default)
- [x] HTTP/3: **ON**
- [x] WebSockets: **ON** (if needed in future)
- [x] gRPC: **OFF** (not used)
- [x] Onion Routing: **OFF**

## 6. Cloudflare Tunnel Configuration
```yaml
# ~/.cloudflared/config.yml on Synology
tunnel: <TUNNEL_ID>
credentials-file: /etc/cloudflared/<TUNNEL_ID>.json

ingress:
  - hostname: hfc.tlserver.pro.vn
    service: http://hfc-web:80
    originRequest:
      connectTimeout: 30s
      noTLSVerify: true
      keepAliveConnections: 10
      keepAliveTimeout: 90s
  - service: http_status:404
```

### Tunnel run command (docker-compose addition if needed):
```yaml
  cloudflared:
    image: cloudflare/cloudflared:latest
    container_name: hfc-tunnel
    restart: unless-stopped
    command: tunnel --config /etc/cloudflared/config.yml run
    volumes:
      - ./cloudflared:/etc/cloudflared:ro
    networks:
      - hfc-net
    depends_on:
      - web
```

## 7. DNS
- [x] `hfc.tlserver.pro.vn` → CNAME to `<TUNNEL_ID>.cfargotunnel.com`
- [x] Proxy status: **Proxied** (orange cloud ON)
- [x] TTL: **Auto**

## 8. Post-Deploy Validation
```bash
# 1. TTFB check
curl -w "TTFB: %{time_starttransfer}s\nTotal: %{time_total}s\n" -o /dev/null -s https://hfc.tlserver.pro.vn

# 2. Cache headers on assets
curl -sI https://hfc.tlserver.pro.vn/assets/vite-index-HASH.js | grep -i "cache-control\|cf-cache"

# 3. Gzip/Brotli
curl -sI -H "Accept-Encoding: br,gzip" https://hfc.tlserver.pro.vn/assets/vite-index-HASH.js | grep -i content-encoding

# 4. No mixed content (check browser console)
# 5. Security headers
curl -sI https://hfc.tlserver.pro.vn | grep -i "x-content-type\|x-frame\|referrer"

# 6. API passthrough
curl -s https://hfc.tlserver.pro.vn/api/health

# 7. Lighthouse
# Run Chrome DevTools → Lighthouse → Performance target > 90
```
