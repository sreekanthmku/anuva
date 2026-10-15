// What a consultation call may carry. Video is off unless CONSULTATION_VIDEO_ENABLED is exactly
// "true": calls are voice only for now. The apps hide the camera when `videoEnabled` is false, and
// the LiveKit token enforces it, so a modified client cannot publish a camera either.

import { TrackSource, type VideoGrant } from 'livekit-server-sdk';

/** Read on every call, like the notes AI settings, so a changed env needs no code path of its own. */
export function consultationVideoEnabled(): boolean {
  return process.env.CONSULTATION_VIDEO_ENABLED?.trim() === 'true';
}

/**
 * The publish part of a participant's grant. With video off, the microphone is the only source
 * LiveKit accepts from them; camera and screen share are refused by the server.
 */
export function consultationPublishGrant(
  videoEnabled = consultationVideoEnabled(),
): Pick<VideoGrant, 'canPublish' | 'canPublishSources'> {
  return videoEnabled
    ? { canPublish: true }
    : { canPublish: true, canPublishSources: [TrackSource.MICROPHONE] };
}
