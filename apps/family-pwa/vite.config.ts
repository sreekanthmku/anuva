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
          // Lets `getInstalledRelatedApps` answer "they already have it", so the gate can point an
          // already-installed member at their home screen instead of at a button that does nothing:
          // `beforeinstallprompt` never fires a second time.
          related_applications: [
            { platform: 'webapp', url: 'https://family.anuvawellness.com/manifest.webmanifest' },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          // The FCM worker registers itself under its own scope; precaching it here would let workbox
          // serve a stale copy of a worker it does not own.
          globIgnores: ['**/firebase-messaging-sw.js'],
          // i18n locale JSON is glob-bundled into the main chunk; headroom for future languages
          // pushing it past Workbox's 2 MiB default precache limit.
          maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        },
      }),
      ...sentry,
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
