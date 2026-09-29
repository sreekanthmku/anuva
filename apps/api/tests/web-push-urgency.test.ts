/**
 * Android shows a web push only when it is sent at high urgency. The options once said `high`
 * through `headers`, web-push quietly replaced it with `normal`, and Android stopped showing
 * notifications — so this checks the header the library actually builds, not the options we pass.
 */
import { createECDH, randomBytes } from 'node:crypto';
import webpush from 'web-push';
import { describe, expect, it } from 'vitest';
import { sendOptions } from '../src/push/webPush.js';

function androidSubscription() {
  const ecdh = createECDH('prime256v1');
  ecdh.generateKeys();
  return {
    endpoint: 'https://fcm.googleapis.com/fcm/send/test-token',
    keys: {
      p256dh: ecdh.getPublicKey().toString('base64url'),
      auth: randomBytes(16).toString('base64url'),
    },
  };
}

describe('sendOptions', () => {
  it('sends every push with Urgency: high', () => {
    const { publicKey, privateKey } = webpush.generateVAPIDKeys();
    const options = sendOptions({ publicKey, privateKey, subject: 'mailto:test@example.com' });

    const request = webpush.generateRequestDetails(androidSubscription(), '{"anuva":1}', options);

    expect(request.headers.Urgency).toBe('high');
  });
});
