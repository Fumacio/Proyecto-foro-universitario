import { fileURLToPath, URL } from 'node:url';
import { defineConfig, type ProxyOptions } from 'vite';
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

export default defineConfig({
  plugins: [react(), tailwindcss()],
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
        manualChunks: {
          react: ['react', 'react-dom', 'react-router'],
          query: ['@tanstack/react-query'],
          markdown: ['react-markdown', 'remark-gfm'],
          radix: [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-popover',
            '@radix-ui/react-tooltip',
          ],
        },
      },
    },
  },
});
