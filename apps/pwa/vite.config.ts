import { writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { sentryVitePlugin } from '@sentry/vite-plugin';

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

/**
 * Source map upload.
 *
 * Without it a production stack trace points into a minified bundle and is close to unreadable —
 * `a.b is not a function` at column 4821 of `index-Bp1TPtNV.js`. With it, Sentry shows the original
 * TypeScript.
 *
 * Gated on the three env vars so a local `pnpm build` still works for anyone without a token: no
 * token, no plugin, and — importantly — no source maps emitted either. Maps are only generated when
 * they are going to be uploaded and then deleted from the bundle, because a `.map` left in `dist/`
 * is served to the browser and hands anyone the unminified app.
 */
function sentrySourcemapPlugins(env: Record<string, string>) {
  const { SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT } = env;

  if (!SENTRY_AUTH_TOKEN || !SENTRY_ORG || !SENTRY_PROJECT) {
    return [];
  }

  return [
    sentryVitePlugin({
      authToken: SENTRY_AUTH_TOKEN,
      org: SENTRY_ORG,
      project: SENTRY_PROJECT,
      sourcemaps: { filesToDeleteAfterUpload: ['**/*.js.map'] },
      // A failed upload must not fail the deploy. By default this plugin throws — so a wrong org, a
      // rotated token or a Sentry outage would turn a routine release into a red build, for the
      // sake of a debugging convenience. Warn loudly in the log and ship the app.
      errorHandler: (error) => {
        console.warn('[sentry] source map upload failed; shipping without them:', error.message);
      },
    }),
  ];
}

/**
 * The build stamp, injected at compile time.
 *
 * The single most useful thing on a bug report during beta. A tester whose service worker is still
 * serving last week's bundle reports a bug that was fixed on Tuesday, and without a build id there
 * is no way to tell that from a real regression — you go looking for a fault that is not there.
 *
 * The git SHA when it is available, `dev` when the build is not in a checkout, and the wall-clock
 * time either way so two builds of the same commit are still distinguishable.
 */
function buildStamp(): string {
  let sha = 'dev';
  try {
    sha = execSync('git rev-parse --short HEAD', { cwd: repoRoot, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    // Not a git checkout — a CI tarball or a Docker context. The timestamp alone still identifies it.
  }

  return `${sha}-${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '')}`;
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, repoRoot, '');
  const sentry = sentrySourcemapPlugins(env);

  return {
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
          description: 'Anuva Wellness: your daily bloom',
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
          // Lets navigator.getInstalledRelatedApps() report this app as installed,
          // so the install gate can point an already-installed visitor at the app
          // instead of showing them a button that can never fire (once installed,
          // beforeinstallprompt stops firing). The URL has to be absolute and
          // match the served manifest, so it only resolves on production —
          // previews fall through to the normal per-platform screen.
          related_applications: [
            { platform: 'webapp', url: 'https://app.anuvawellness.com/manifest.webmanifest' },
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
      ...sentry,
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
    define: {
      __BUILD_ID__: JSON.stringify(buildStamp()),
      // Compiled away entirely when off, so a production bundle does not ship the reporter at all.
      __BETA_MODE__: JSON.stringify(env.VITE_BETA_MODE === 'true'),
    },
    build: {
      // Only emitted when they will be uploaded and then deleted. See above.
      sourcemap: sentry.length > 0,
    },
  };
});
