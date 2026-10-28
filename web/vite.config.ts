import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig, type Plugin, type ProxyOptions } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const API_TARGET = process.env.VITE_API_TARGET ?? 'http://localhost:3000';

/** Proxy para Server-Sent Events: sin compresión ni buffering, sin timeout. */
const streamProxy: ProxyOptions = {
  target: API_TARGET,
  changeOrigin: true,
  timeout: 0,
  proxyTimeout: 0,
  configure: (proxy) => {
    proxy.on('proxyReq', (proxyReq) => {
      // Sin gzip el server no tiene que bufferear los eventos.
      proxyReq.setHeader('accept-encoding', 'identity');
    });
    proxy.on('proxyRes', (proxyRes) => {
      proxyRes.headers['cache-control'] = 'no-cache, no-transform';
      proxyRes.headers['x-accel-buffering'] = 'no';
    });
  },
};

/**
 * PWA: estampa un id de build en dist/sw.js (`__BUILD_ID__`), así cada deploy cambia el archivo del
 * service worker → el navegador detecta la versión nueva y la app ofrece "Actualizar".
 */
function swBuildId(): Plugin {
  let outDir = 'dist';
  return {
    name: 'foro-sw-build-id',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      const file = resolve(outDir, 'sw.js');
      if (!existsSync(file)) return;
      const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      writeFileSync(file, readFileSync(file, 'utf8').replaceAll('__BUILD_ID__', id));
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), swBuildId()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      // El orden importa: /api/stream antes que /api.
      '/api/stream': streamProxy,
      '/api': { target: API_TARGET, changeOrigin: true },
      '/uploads': { target: API_TARGET, changeOrigin: true },
    },
  },
  preview: {
    port: 4173,
    proxy: {
      '/api/stream': streamProxy,
      '/api': { target: API_TARGET, changeOrigin: true },
      '/uploads': { target: API_TARGET, changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (/node_modules\/(react|react-dom|scheduler|react-router|cookie|set-cookie-parser)\//.test(id)) return 'react';
          if (id.includes('@tanstack')) return 'query';
          if (id.includes('@radix-ui') || id.includes('@floating-ui')) return 'radix';
          if (/node_modules\/(react-markdown|remark-|rehype-|micromark|mdast-|hast-|unist-|unified|vfile|property-information|space-separated-tokens|comma-separated-tokens|decode-named-character-reference|character-entities|markdown-table|ccount|devlop|bail|trough|zwitch|longest-streak|estree-util|html-url-attributes|style-to-|inline-style-parser|trim-lines|is-plain-obj|extend|escape-string-regexp)/.test(id))
            return 'markdown';
          return 'vendor';
        },
      },
    },
  },
});
