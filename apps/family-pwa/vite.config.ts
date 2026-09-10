import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');

/**
 * The FCM service worker cannot read `import.meta.env`, so the web config is written out as a plain
 * script it can `importScripts`. Same mechanism as the patient app — same Firebase project, and the
 * generated file is git-ignored in both.
 */
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
    name: 'anuva-family-firebase-config',
    config(_config, { mode }) {
      writeFirebaseWebConfig(loadEnv(mode, repoRoot, ''));
    },
  };
}

export default defineConfig({
  root: __dirname,
  envDir: repoRoot,
  plugins: [
    firebaseWebConfigPlugin(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.png',
        'apple-touch-icon.png',
        'anuva-logo-icon.png',
        'firebase-config.js',
      ],
      manifest: {
        name: 'Anuva Family',
        short_name: 'Anuva Family',
        description: 'A soft place for family to support her wellness journey',
        theme_color: '#F7F0E8',
        background_color: '#F7F0E8',
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
        // The FCM worker registers itself under its own scope; precaching it here would let workbox
        // serve a stale copy of a worker it does not own.
        globIgnores: ['**/firebase-messaging-sw.js'],
      },
    }),
  ],
  server: {
    port: 5175,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
});
