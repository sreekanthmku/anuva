import { AccessToken } from 'livekit-server-sdk';
import { afterEach, describe, expect, it } from 'vitest';
import { consultationPublishGrant, consultationVideoEnabled } from '../src/consultationCallMedia.js';

// Video in consultation calls is off unless CONSULTATION_VIDEO_ENABLED is exactly "true", and the
// LiveKit token is what enforces it: with video off a participant may publish a microphone only.

const original = process.env.CONSULTATION_VIDEO_ENABLED;

afterEach(() => {
  if (original === undefined) delete process.env.CONSULTATION_VIDEO_ENABLED;
  else process.env.CONSULTATION_VIDEO_ENABLED = original;
});

/** The `video` grant LiveKit would read from a token minted the way the API mints them. */
async function grantInToken(): Promise<Record<string, unknown>> {
  const token = new AccessToken('devkey', 'devsecret-that-is-long-enough-for-hs256', { identity: 'doctor:c1' });
  token.addGrant({ roomJoin: true, room: 'consultation-c1', ...consultationPublishGrant(), canSubscribe: true });
  const jwt = await token.toJwt();
  const payload = JSON.parse(Buffer.from(jwt.split('.')[1]!, 'base64url').toString('utf8'));
  return payload.video;
}

describe('consultation call video switch', () => {
  it('is off when unset, and on only for exactly "true"', () => {
    delete process.env.CONSULTATION_VIDEO_ENABLED;
    expect(consultationVideoEnabled()).toBe(false);
    for (const value of ['false', '1', 'yes', 'TRUE ', '']) {
      process.env.CONSULTATION_VIDEO_ENABLED = value;
      expect(consultationVideoEnabled()).toBe(false);
    }
    process.env.CONSULTATION_VIDEO_ENABLED = 'true';
    expect(consultationVideoEnabled()).toBe(true);
  });

  it('with video off, the token lets a participant publish a microphone and nothing else', async () => {
    delete process.env.CONSULTATION_VIDEO_ENABLED;
    const grant = await grantInToken();
    expect(grant.canPublish).toBe(true);
    expect(grant.canPublishSources).toEqual(['microphone']);
  });

  it('with video on, the token does not restrict what is published', async () => {
    process.env.CONSULTATION_VIDEO_ENABLED = 'true';
    const grant = await grantInToken();
    expect(grant.canPublish).toBe(true);
    expect(grant.canPublishSources).toBeUndefined();
  });
});
