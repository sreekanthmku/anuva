import { describe, expect, it } from 'vitest';
import { serializeSubscription, urlBase64ToUint8Array } from '../src/lib/notifications/webPush';

describe('urlBase64ToUint8Array', () => {
  it('decodes a VAPID key, restoring the padding the URL form drops', () => {
    // "hello" — the browser rejects a key it cannot decode with an opaque error, so this is worth
    // pinning rather than discovering on a phone.
    expect([...urlBase64ToUint8Array('aGVsbG8')]).toEqual([104, 101, 108, 108, 111]);
  });

  it('accepts the URL-safe alphabet, which real keys use', () => {
    // -_ stand in for +/ ; these bytes are exactly what the standard alphabet would give.
    expect([...urlBase64ToUint8Array('-_8')]).toEqual([251, 255]);
    expect([...urlBase64ToUint8Array('+/8=')]).toEqual([251, 255]);
  });

  it('produces the 65 bytes a real VAPID public key decodes to', () => {
    const key = 'B' + 'a'.repeat(86); // 87 chars, the length these keys come in
    expect(urlBase64ToUint8Array(key).length).toBe(65);
  });
});

describe('serializeSubscription', () => {
  const subscription = (json: unknown) => ({ toJSON: () => json }) as unknown as PushSubscription;

  it('keeps the endpoint and both keys', () => {
    expect(
      serializeSubscription(
        subscription({ endpoint: 'https://push.example/x', keys: { p256dh: 'p', auth: 'a' } }),
      ),
    ).toEqual({ endpoint: 'https://push.example/x', keys: { p256dh: 'p', auth: 'a' } });
  });

  it('refuses a subscription missing its keys, which cannot be delivered to', () => {
    expect(serializeSubscription(subscription({ endpoint: 'https://push.example/x' }))).toBeNull();
    expect(serializeSubscription(subscription({ keys: { p256dh: 'p', auth: 'a' } }))).toBeNull();
    expect(
      serializeSubscription(subscription({ endpoint: 'https://push.example/x', keys: { p256dh: 'p' } })),
    ).toBeNull();
  });
});
