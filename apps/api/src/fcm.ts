import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import admin from 'firebase-admin';
import { logger } from './logger.js';

const FCM_BATCH_SIZE = 500;
const log = logger.child({ module: 'fcm' });

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

let messaging: admin.messaging.Messaging | null = null;

function loadServiceAccountRaw(): string {
  const filePath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim();
  if (filePath) {
    const resolved = path.isAbsolute(filePath) ? filePath : path.join(repoRoot, filePath);
    return readFileSync(resolved, 'utf8');
  }

  const inline = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (inline) {
    return inline;
  }

  throw new Error(
    'Set FIREBASE_SERVICE_ACCOUNT_PATH (path to JSON file) or FIREBASE_SERVICE_ACCOUNT_JSON in .env.',
  );
}

function getMessaging(): admin.messaging.Messaging {
  if (messaging) {
    return messaging;
  }

  const serviceAccount = JSON.parse(loadServiceAccountRaw()) as admin.ServiceAccount;
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  messaging = admin.messaging();
  return messaging;
}

export type PushSendResult = {
  successCount: number;
  failureCount: number;
};

export async function sendPushToAllTokens(
  tokens: string[],
  notification: { title: string; body: string },
  data?: Record<string, string>,
): Promise<PushSendResult> {
  if (tokens.length === 0) {
    return { successCount: 0, failureCount: 0 };
  }

  const fcm = getMessaging();
  let successCount = 0;
  let failureCount = 0;

  for (let offset = 0; offset < tokens.length; offset += FCM_BATCH_SIZE) {
    const batch = tokens.slice(offset, offset + FCM_BATCH_SIZE);
    const response = await fcm.sendEachForMulticast({
      tokens: batch,
      notification,
      data,
      webpush: {
        fcmOptions: {
          link: data?.url ?? '/home',
        },
      },
    });

    successCount += response.successCount;
    failureCount += response.failureCount;

    // Per-token failures were only ever counted, never reported. Codes, not tokens: a token is
    // a device credential, and `registration-token-not-registered` is the one worth acting on.
    if (response.failureCount > 0) {
      const codes: Record<string, number> = {};
      for (const result of response.responses) {
        if (result.success) {
          continue;
        }
        const code = result.error?.code ?? 'unknown';
        codes[code] = (codes[code] ?? 0) + 1;
      }
      log.warn(
        { attempted: batch.length, failed: response.failureCount, codes },
        'Some push tokens failed',
      );
    }
  }

  return { successCount, failureCount };
}
