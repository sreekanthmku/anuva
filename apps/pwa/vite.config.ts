import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');

function writeFirebaseWebConfig(env: Record<string, string>) {
  const config = {
    apiKey: env.VITE_FIREBASE_API_KEY || '',
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || '',
    projectId: env.VITE_FIREBASE_PROJECT_ID || '',
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: env.VITE_FIREBASE_APP_ID || '',
  };

  writeFileSync(
    path.join(__dirname, 'public/firebase-config.js'),
    `self.FIREBASE_WEB_CONFIG = ${JSON.stringify(config)};\n`,
  );
}

function firebaseWebConfigPlugin(): Plugin {
  return {
    name: 'anuva-firebase-config',
    config(_config, { mode }) {
      writeFirebaseWebConfig(loadEnv(mode, repoRoot, ''));
    },
  };
}

export default defineConfig({
  // Monorepo: root .env holds VITE_FIREBASE_* and VITE_API_URL
  envDir: repoRoot,
  plugins: [
    firebaseWebConfigPlugin(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'apple-touch-icon.png', 'firebase-config.js'],
      manifest: {
        name: 'Anuva Wellness',
        short_name: 'Anuva Wellness',
        description: 'Anuva Wellness — your daily bloom',
        theme_color: '#141136',
        background_color: '#141136',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: 'pwa-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api') && !url.pathname.startsWith('/api/auth/'),
            handler: 'NetworkFirst',
            options: { cacheName: 'api-cache' },
          },
          {
            // Library hero photos are hotlinked from Unsplash's CDN and never change per URL,
            // so they are worth holding on to rather than refetching on every article open.
            urlPattern: ({ url }) => url.hostname === 'images.unsplash.com',
            handler: 'CacheFirst',
            options: {
              cacheName: 'library-images',
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
});
