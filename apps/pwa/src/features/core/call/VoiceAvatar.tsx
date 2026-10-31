import { useEffect, useRef, useState } from 'react';

/**
 * A person on a voice call, as Google Meet shows someone with their camera off: their photo or
 * initials in a circle, with a soft ring that swells while they speak.
 *
 * The level comes from a Web Audio analyser on their audio track and is written straight to the
 * ring's style on each animation frame, so a talking person does not re-render React sixty times a
 * second. With reduced motion asked for, the ring stays still.
 */

const RING_RGB = '201, 126, 146'; // dusty rose, the `secondary` token

function initialsOf(name: string): string {
  const words = name
    .replace(/^(dr|doctor)\.?\s+/i, '')
    .split(/\s+/)
    .filter(Boolean);
  const letters = words.length > 1 ? [words[0]![0], words[words.length - 1]![0]] : [words[0]?.[0]];
  return letters.filter(Boolean).join('').toUpperCase();
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

function ringShadow(level: number, size: number): string {
  const spread = Math.round(2 + level * size * 0.14);
  const glow = Math.round(6 + level * size * 0.3);
  return `0 0 0 ${spread}px rgba(${RING_RGB}, ${0.35 + level * 0.5}), 0 0 ${glow}px ${Math.round(glow / 3)}px rgba(${RING_RGB}, ${0.15 + level * 0.35})`;
}

/** Drives `ringRef`'s box-shadow from the live level of `track`. Cleans up on track change and unmount. */
function useVoiceRing(track: MediaStreamTrack | null, ringRef: React.RefObject<HTMLDivElement>, size: number, active: boolean) {
  useEffect(() => {
    const ring = ringRef.current;
    if (!ring) return;
    ring.style.boxShadow = active ? ringShadow(0, size) : 'none';
    if (!track || !active || prefersReducedMotion()) return;

    const AudioContextClass =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    let context: AudioContext;
    try {
      context = new AudioContextClass();
    } catch {
      return;
    }
    // A context made outside a tap starts suspended on iOS; resuming may still be refused, and the
    // ring then simply stays still.
    void context.resume().catch(() => undefined);

    // Only measured, never played: the call's <audio> element does the playing.
    const source = context.createMediaStreamSource(new MediaStream([track]));
    const analyser = context.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    const samples = new Uint8Array(analyser.fftSize);

    let level = 0;
    let frame = 0;
    const tick = () => {
      analyser.getByteTimeDomainData(samples);
      let sum = 0;
      for (const sample of samples) {
        const centred = (sample - 128) / 128;
        sum += centred * centred;
      }
      const rms = Math.sqrt(sum / samples.length);
      const target = Math.min(1, Math.max(0, (rms - 0.01) * 7));
      // Quick to rise, slow to fall, so the ring follows speech without flickering.
      level = target > level ? level + (target - level) * 0.5 : level + (target - level) * 0.12;
      ring.style.boxShadow = ringShadow(level, size);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      source.disconnect();
      analyser.disconnect();
      void context.close().catch(() => undefined);
      ring.style.boxShadow = 'none';
    };
  }, [track, ringRef, size, active]);
}

export function VoiceAvatar({
  name,
  imageUrl = null,
  track,
  size,
  active = true,
  muted = false,
  mutedLabel,
}: {
  name: string;
  imageUrl?: string | null;
  /** Their audio, to drive the ring. Null while not connected. */
  track: MediaStreamTrack | null;
  size: number;
  /** False while they have not joined: no ring, and the circle is dimmed. */
  active?: boolean;
  muted?: boolean;
  mutedLabel?: string;
}) {
  const ringRef = useRef<HTMLDivElement>(null);
  const [imageFailed, setImageFailed] = useState(false);
  useVoiceRing(muted ? null : track, ringRef, size, active);

  const initials = initialsOf(name);
  const showImage = Boolean(imageUrl) && !imageFailed;

  return (
    // Decorative for a screen reader: the name is printed beside it, and mute is on the Mute button.
    <div className="relative shrink-0" style={{ width: size, height: size }} aria-hidden="true">
      <div
        ref={ringRef}
        className={`h-full w-full overflow-hidden rounded-full transition-opacity duration-200 ${active ? '' : 'opacity-60'}`}
      >
        {showImage ? (
          <img
            src={imageUrl ?? undefined}
            alt=""
            onError={() => setImageFailed(true)}
            className="h-full w-full object-cover"
          />
        ) : (
          <div
            className="grid h-full w-full place-items-center bg-primary font-display text-on-primary"
            style={{ fontSize: Math.round(size * 0.36) }}
            aria-hidden="true"
          >
            {initials || <PersonGlyph size={Math.round(size * 0.5)} />}
          </div>
        )}
      </div>
      {muted ? (
        <span
          className="absolute -bottom-0.5 -right-0.5 grid place-items-center rounded-full border-2 border-inverse-surface bg-error text-on-error"
          style={{ width: Math.max(22, size * 0.3), height: Math.max(22, size * 0.3) }}
          role="img"
          aria-label={mutedLabel}
        >
          <MicOffGlyph size={Math.max(12, Math.round(size * 0.16))} />
        </span>
      ) : null}
    </div>
  );
}

function PersonGlyph({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" aria-hidden="true">
      <circle cx="12" cy="8.5" r="3.5" stroke="currentColor" strokeWidth="1.7" />
      <path d="M5 19.5c1.2-3.3 3.8-5 7-5s5.8 1.7 7 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function MicOffGlyph({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" aria-hidden="true">
      <path d="M9 9v2a3 3 0 0 0 5.1 2.1M15 10.5V6a3 3 0 0 0-5.7-1.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M5.5 11a6.5 6.5 0 0 0 10.4 5.2M18.5 11c0 .6-.1 1.2-.2 1.7M12 17.5V21M4 4l16 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
