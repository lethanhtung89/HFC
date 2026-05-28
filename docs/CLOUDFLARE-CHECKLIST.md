# Cloudflare Configuration Checklist for hfc.tlserver.pro.vn

## 1. SSL/TLS (cloudflare.com → SSL/TLS)
- [x] Encryption mode: **Full (Strict)**
  - Origin (nginx) serves HTTP on port 80 behind tunnel → Cloudflare terminates TLS
  - "Full (Strict)" requires valid origin cert OR Cloudflare tunnel handles it natively
- [x] Always Use HTTPS: **ON**
- [x] HTTP/3 (QUIC): **ON**
- [x] 0-RTT Connection Resumption: **ON**
- [x] Minimum TLS Version: **TLS 1.2**
- [x] TLS 1.3: **ON**

## 2. Speed (cloudflare.com → Speed → Optimization)
- [x] Brotli: **ON** (Cloudflare re-compresses with brotli at edge, better than gzip)
- [x] Early Hints: **ON** (103 hints for preload)
- [ ] Auto Minify: **OFF for JS** (Vite already minifies; double-minify can break)
  - HTML: ON (safe)
  - CSS: ON (safe)
  - JS: **OFF**
- [ ] Rocket Loader: **OFF** (breaks SPA — defers all scripts including React bootstrap)
- [ ] Mirage: **OFF** (image lazy-load for mobile; not needed for internal SPA)
- [ ] Polish: **OFF** (image optimization; not needed)

## 3. Caching (cloudflare.com → Caching → Configuration)
- [x] Caching Level: **Standard**
- [x] Browser Cache TTL: **Respect Existing Headers**
  - nginx already sets `immutable` on /assets/ and `no-store` on index.html
- [x] Always Online: **OFF** (SPA needs live API; stale HTML is useless)
- [x] Development Mode: **OFF** (only for debugging)

### Cache Rules (cloudflare.com → Rules → Cache Rules)
Create rule: **Bypass API cache**
  - If: URI Path starts with `/api/` OR URI Path starts with `/auth/`
  - Then: Cache eligibility = **Bypass cache**

## 4. Network (cloudflare.com → Network)
- [x] HTTP/2: **ON** (default)
- [x] HTTP/3 (QUIC): **ON**
- [x] WebSockets: **ON** (if future SSE/WS needed)
- [x] gRPC: OFF (not used)

## 5. Tunnel Configuration (cloudflare.com → Zero Trust → Networks → Tunnels)
- Tunnel name: `hfc-tunnel` (or existing)
- Public hostname: `hfc.tlserver.pro.vn`
  - Service: `http://hfc-web:80` (Docker internal network)
  - OR: `http://localhost:7000` (if tunnel runs on host)
- TLS: No TLS on origin (tunnel encrypts the link)
- HTTP2 Origin: OFF (nginx doesn't need HTTP/2 on loopback)
- Keep Alive Connections: ON
- Keep Alive Timeout: 90s

## 6. DNS (cloudflare.com → DNS)
- `hfc.tlserver.pro.vn` → CNAME → tunnel UUID.cfargotunnel.com
- Proxy status: **Proxied** (orange cloud)
- TTL: Auto

## 7. Security
- [x] WAF: Default rules (Cloudflare Managed)
- [x] Bot Fight Mode: **OFF** (internal tool, not public)
- [x] Under Attack Mode: **OFF** (only enable during DDoS)
- [x] Security Level: **Medium**

## 8. Post-Deploy Validation
```bash
# 1. TTFB check
curl -o /dev/null -s -w "TTFB: %{time_starttransfer}s\n" https://hfc.tlserver.pro.vn

# 2. Compression check
curl -sI -H "Accept-Encoding: br,gzip" https://hfc.tlserver.pro.vn/assets/ | grep -i content-encoding

# 3. Cache headers
curl -sI https://hfc.tlserver.pro.vn/ | grep -i cache-control
curl -sI https://hfc.tlserver.pro.vn/assets/vite-index*.js | grep -i cache-control

# 4. Security headers
curl -sI https://hfc.tlserver.pro.vn/ | grep -iE "x-content-type|x-frame|referrer"

# 5. No mixed content
# Open browser DevTools → Console → check for "Mixed Content" warnings

# 6. API routes work
curl -s https://hfc.tlserver.pro.vn/api/health | head
```
