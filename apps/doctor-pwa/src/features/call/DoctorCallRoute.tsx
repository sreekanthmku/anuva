import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Room, RoomEvent, Track, type RemoteTrack } from 'livekit-client';
import type { ConsultationCallState } from '@anuva/shared';
import { endDoctorCall, startDoctorCall } from '../bookings/api';

type ConnectState = 'connecting' | 'connected' | 'ended' | 'error';

function attachTrack(track: RemoteTrack, videoEl: HTMLVideoElement | null, audioEl: HTMLAudioElement | null) {
  if (track.kind === Track.Kind.Video && videoEl) {
    track.attach(videoEl);
  }

  if (track.kind === Track.Kind.Audio && audioEl) {
    track.attach(audioEl);
  }
}

export function DoctorCallRoute() {
  const { consultationId = '' } = useParams();
  const navigate = useNavigate();
  const roomRef = useRef<Room | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const [state, setState] = useState<ConnectState>('connecting');
  const [call, setCall] = useState<ConsultationCallState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [micOn, setMicOn] = useState(true);
  // Calls start audio-only. The doctor opts into video explicitly.
  const [cameraOn, setCameraOn] = useState(false);
  const [remoteConnected, setRemoteConnected] = useState(false);
  const [remoteVideoOn, setRemoteVideoOn] = useState(false);
  const [ending, setEnding] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
    });
    roomRef.current = room;

    const handleTrackSubscribed = (track: RemoteTrack) => {
      attachTrack(track, remoteVideoRef.current, remoteAudioRef.current);
      setRemoteConnected(true);
      if (track.kind === Track.Kind.Video) {
        setRemoteVideoOn(true);
      }
    };
    const handleTrackUnsubscribed = (track: RemoteTrack) => {
      track.detach();
      if (track.kind === Track.Kind.Video) {
        setRemoteVideoOn(false);
      }
    };

    room.on(RoomEvent.TrackSubscribed, handleTrackSubscribed);
    room.on(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed);
    room.on(RoomEvent.ParticipantConnected, () => setRemoteConnected(true));
    room.on(RoomEvent.ParticipantDisconnected, () => {
      setRemoteConnected(false);
      setRemoteVideoOn(false);
    });
    room.on(RoomEvent.Disconnected, () => {
      if (!cancelled) {
        // Ending the call disconnects us, so this must not clobber a failure message.
        setState((current) => (current === 'error' ? current : 'ended'));
      }
    });

    async function connect() {
      if (!consultationId) {
        setError('Missing consultation id.');
        setState('error');
        return;
      }

      try {
        const response = await startDoctorCall(consultationId);
        if (cancelled) return;

        setCall(response.call);
        await room.connect(response.livekitUrl, response.token);
        if (cancelled) return;

        // Audio only to begin with — the camera is published only if the doctor turns it on.
        await room.localParticipant.setMicrophoneEnabled(true);
        setState('connected');
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Unable to start the call.');
        setState('error');
      }
    }

    void connect();

    return () => {
      cancelled = true;
      room.off(RoomEvent.TrackSubscribed, handleTrackSubscribed);
      room.off(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed);
      room.disconnect();
      roomRef.current = null;
    };
  }, [consultationId]);

  // The button label has to reflect what is actually published, so the state is only flipped
  // once the SDK confirms the change. Flipping first meant a denied mic permission or a failed
  // publish left the UI claiming "Mute" while the track was still live.
  const toggleMic = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;

    const next = !micOn;
    try {
      await room.localParticipant.setMicrophoneEnabled(next);
      setMicOn(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change the microphone.');
    }
  }, [micOn]);

  const toggleCamera = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;

    const next = !cameraOn;
    try {
      const publication = await room.localParticipant.setCameraEnabled(next);
      setCameraOn(next);

      if (next && publication?.track && localVideoRef.current) {
        publication.track.attach(localVideoRef.current);
      }
      if (!next && localVideoRef.current) {
        // setCameraEnabled(false) unpublishes and stops the track, but the element keeps
        // painting the last frame until its source is cleared.
        localVideoRef.current.srcObject = null;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change the camera.');
    }
  }, [cameraOn]);

  const endCall = useCallback(async () => {
    if (!consultationId || ending) return;
    setEnding(true);

    try {
      const response = await endDoctorCall(consultationId);
      setCall(response.call);
      setState('ended');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to end the call.');
      setState('error');
    } finally {
      roomRef.current?.disconnect();
      setEnding(false);
    }
  }, [consultationId, ending]);

  return (
    <main className="min-h-mobile bg-surface text-on-surface">
      <header className="border-b border-border-default bg-surface/95 px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <Link to="/" className="rounded-full border border-border-default px-3 py-1.5 text-[12px] font-semibold">
            Back
          </Link>
          <div className="rounded-full bg-primary-fixed px-3 py-1 text-[11px] font-semibold text-primary">
            {call?.recording?.status
              ? `Recording ${call.recording.status}`
              : call?.patientConsentRequired
                ? 'Audio recording starts on patient join'
                : 'Secure call'}
          </div>
        </div>
        <h1 className="mt-4 font-display text-[29px] leading-[1.08]">Consultation call</h1>
        <p className="mt-2 text-[13px] leading-[1.5] text-on-surface-variant">
          {call?.patientConsentRequired
            ? 'Patient consent is required before server audio recording starts.'
            : 'The patient can join once they open the consultation link.'}
        </p>
      </header>

      <section className="px-4 py-4">
        {state === 'connecting' || state === 'connected' ? (
          <div className="relative aspect-[3/4] overflow-hidden rounded-[20px] border border-border-default bg-inverse-surface text-inverse-on-surface shadow-[0_16px_35px_rgba(62,37,66,0.14)] sm:aspect-video">
            <video ref={remoteVideoRef} className="h-full w-full bg-[#2F2034] object-cover" autoPlay playsInline />
            <audio ref={remoteAudioRef} autoPlay />
            {!remoteConnected ? (
              <div className="absolute inset-0 grid place-items-center px-8 text-center">
                <div>
                  <div className="font-display text-[26px]">Waiting for patient</div>
                  <p className="mt-2 text-[13px] leading-[1.5] text-[#EADFEF]">
                    They will see the consent screen before joining.
                  </p>
                </div>
              </div>
            ) : !remoteVideoOn ? (
              <div className="absolute inset-0 grid place-items-center px-8 text-center">
                <div>
                  <div className="font-display text-[26px]">Patient camera is off</div>
                  <p className="mt-2 text-[13px] leading-[1.5] text-[#EADFEF]">
                    You are connected on audio.
                  </p>
                </div>
              </div>
            ) : null}
            <div className="absolute bottom-3 right-3 h-32 w-24 overflow-hidden rounded-[16px] border border-white/30 bg-[#4A3050] shadow-lg sm:h-40 sm:w-32">
              <video ref={localVideoRef} className="h-full w-full object-cover" autoPlay muted playsInline />
              {!cameraOn ? (
                <div className="absolute inset-0 grid place-items-center bg-[#4A3050] px-2 text-center text-[10px] font-semibold text-[#EADFEF]">
                  Camera off
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {state === 'error' ? (
          <div className="mt-4 rounded-[20px] border border-error/20 bg-error-container px-4 py-3 text-[13px] text-on-error-container">
            {error ?? 'Unable to connect.'}
          </div>
        ) : null}

        {state === 'ended' ? (
          <div className="mt-4 rounded-[20px] border border-border-default bg-surface-raised px-4 py-3 text-[13px] text-on-surface-variant">
            Call ended. Recording status: {call?.recording?.status ?? 'not started'}.
          </div>
        ) : null}

        {state === 'connecting' || state === 'connected' ? (
          <div className="mt-4 grid grid-cols-3 gap-3">
            <button
              type="button"
              onClick={toggleMic}
              disabled={state !== 'connected'}
              className="rounded-full border border-border-default bg-surface-raised px-3 py-3 text-[13px] font-semibold disabled:opacity-45"
            >
              {micOn ? 'Mute' : 'Unmute'}
            </button>
            <button
              type="button"
              onClick={toggleCamera}
              disabled={state !== 'connected'}
              className="rounded-full border border-border-default bg-surface-raised px-3 py-3 text-[13px] font-semibold disabled:opacity-45"
            >
              {cameraOn ? 'Camera off' : 'Camera on'}
            </button>
            <button
              type="button"
              onClick={endCall}
              disabled={ending || state !== 'connected'}
              className="rounded-full bg-error px-3 py-3 text-[13px] font-semibold text-on-error disabled:opacity-45"
            >
              {ending ? 'Ending' : 'End'}
            </button>
          </div>
        ) : null}

        {state === 'connecting' ? (
          <p className="mt-4 text-center text-[12px] text-on-surface-variant">Starting secure room...</p>
        ) : null}

        {state === 'ended' ? (
          <button
            type="button"
            onClick={() => navigate('/')}
            className="mt-4 w-full rounded-full bg-secondary px-4 py-3 text-[14px] font-semibold text-on-secondary"
          >
            Return to bookings
          </button>
        ) : null}
      </section>
    </main>
  );
}
