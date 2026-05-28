#!/bin/sh
set -e

echo "=== HFC Build ==="

# Safety: ensure no conflicting vite.config.js
if [ -f "vite.config.js" ] && [ -f "vite.config.ts" ]; then
    echo "⚠️  Removing conflicting vite.config.js (using .ts)"
    mv vite.config.js vite.config.js.bak
fi

# Verify critical config removed for code splitting

echo "📦 Installing dependencies..."
npm ci --no-audit --no-fund

echo "🔨 Building..."
NODE_ENV=production npm run build

echo ""
ls -lh dist/assets/*.js dist/assets/*.css 2>/dev/null

# Verify code splitting
if ! ls dist/assets/vendor-*.js 2>/dev/null | grep -q .; then
    echo "❌ No vendor chunks detected! Code splitting might be broken."
    exit 1
fi
echo "✅ Code splitting: vendor chunks verified"

# Verify preload crossorigin consistency
if grep -q 'rel="modulepreload" crossorigin' dist/index.html && \
   grep -q 'rel="preload".*crossorigin' dist/index.html; then
    echo "✅ Preload crossorigin consistent"
else
    echo "⚠️  Preload hints may have crossorigin mismatch — check manually"
fi

echo "✅ Build OK"
