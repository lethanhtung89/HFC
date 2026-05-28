import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import viteCompression from 'vite-plugin-compression';

// Plugin: rename vite-index.html → index.html after build
function renameHtmlPlugin() {
  return {
    name: 'rename-html',
    closeBundle() {
      const distDir = path.resolve(__dirname, 'dist');
      const src = path.join(distDir, 'vite-index.html');
      const dest = path.join(distDir, 'index.html');
      if (fs.existsSync(src)) {
        if (fs.existsSync(dest)) fs.unlinkSync(dest);
        fs.renameSync(src, dest);
        console.log('[vite] Renamed vite-index.html → index.html');
      }
    }
  };
}

// Plugin: inject <link rel="modulepreload"> for the main JS bundle
// This tells the browser to start downloading+parsing JS immediately
// instead of waiting until the <script type="module"> tag is encountered
function preloadHintsPlugin() {
  return {
    name: 'preload-hints',
    enforce: 'post' as const,
    closeBundle() {
      const distDir = path.resolve(__dirname, 'dist');
      const indexPath = path.join(distDir, 'index.html');
      if (!fs.existsSync(indexPath)) return;

      let html = fs.readFileSync(indexPath, 'utf8');

      // Find the main JS bundle filename
      const jsMatch = html.match(/src="(\/assets\/vite-index-[^"]+\.js)"/);
      const cssMatch = html.match(/href="(\/assets\/style-[^"]+\.css)"/);

      const hints: string[] = [];
      if (jsMatch) {
        // crossorigin must match <script type="module" crossorigin> — Vite adds
        // crossorigin="" (anonymous) to module scripts, so the preload must too.
        hints.push(`  <link rel="modulepreload" crossorigin href="${jsMatch[1]}">`);
      }
      if (cssMatch) {
        // crossorigin must match <link rel="stylesheet" crossorigin> — without
        // this, the browser sees a credential-mode mismatch and re-fetches the
        // CSS, doubling load time over high-latency links (Cloudflare Tunnel).
        hints.push(`  <link rel="preload" href="${cssMatch[1]}" as="style" crossorigin>`);
      }

      if (hints.length > 0) {
        // Insert preload hints right after <meta charset>
        html = html.replace(
          '<meta charset="UTF-8" />',
          '<meta charset="UTF-8" />\n' + hints.join('\n')
        );
        fs.writeFileSync(indexPath, html, 'utf8');
        console.log(`[vite] Injected ${hints.length} preload hints`);
      }
    }
  };
}

const isProd = process.env.NODE_ENV === 'production';

export default defineConfig({
  plugins: [
    react(),
    renameHtmlPlugin(),
    preloadHintsPlugin(),
    // v5.6: Pre-compress assets at build time for nginx to serve directly
    // Brotli gives ~15-20% smaller payloads than gzip
    ...(isProd ? [
      viteCompression({
        algorithm: 'brotliCompress',
        ext: '.br',
        threshold: 1024,       // only compress files > 1KB
        deleteOriginFile: false // keep originals for gzip fallback
      }),
      viteCompression({
        algorithm: 'gzip',
        ext: '.gz',
        threshold: 1024,
        deleteOriginFile: false
      }),
    ] : []),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    dedupe: ['react', 'react-dom', '@emotion/react', '@emotion/styled'],
  },
  root: '.',
  base: '/',
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'esbuild',
    target: 'es2020',       // v5.6: Raised from es2018 — smaller output, all modern browsers support
    cssCodeSplit: true,      // v5.6: CSS per-chunk instead of single file
    emptyOutDir: true,
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      input: path.resolve(__dirname, 'vite-index.html'),
      output: {
        // v5.6: Enable code splitting — removed inlineDynamicImports: true
        // Vendor chunks are long-term cached; app code changes independently
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
        manualChunks(id) {
          // React core — changes rarely
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/')) {
            return 'vendor-react';
          }
          // MUI — large but stable
          if (id.includes('node_modules/@mui/') || id.includes('node_modules/@emotion/')) {
            return 'vendor-mui';
          }
          // Heavy on-demand libraries — loaded lazily via dynamic import
          if (id.includes('node_modules/xlsx')) {
            return 'vendor-xlsx';
          }
          if (id.includes('node_modules/chart.js')) {
            return 'vendor-chart';
          }
          // Zustand — small but separate for caching
          if (id.includes('node_modules/zustand')) {
            return 'vendor-zustand';
          }
        },
      },
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': { target: 'http://localhost:7000', changeOrigin: true },
      '/auth': { target: 'http://localhost:7000', changeOrigin: true },
    },
  },
  esbuild: {
    logOverride: { 'this-is-undefined-in-esm': 'silent' },
    drop: isProd ? ['debugger'] : [],
    pure: isProd ? ['console.log', 'console.debug', 'console.info'] : [],
  },
});
