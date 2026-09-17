import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
// The instance, not the hook, for the error paths below: they run inside callbacks, and putting
// `t` in their dependency arrays would re-run the effect that loads the call on a language change.
import i18n from '../../i18n';
import { Room, RoomEvent, Track, type RemoteTrack } from 'livekit-client';
import type { ConsultationCallState } from '@anuva/shared';
import {
  consentToConsultationRecording,
  endConsultationCall,
  fetchConsultationCall,
  joinConsultationCall,
} from './call/api';

type ScreenState = 'loading' | 'waiting' | 'consent' | 'connecting' | 'connected' | 'ended' | 'error';

function attachTrack(track: RemoteTrack, videoEl: HTMLVideoElement | null, audioEl: HTMLAudioElement | null) {
  if (track.kind === Track.Kind.Video && videoEl) {
    track.attach(videoEl);
  }

  if (track.kind === Track.Kind.Audio && audioEl) {
    track.attach(audioEl);
  }
}

export default function ConsultationCallRoute() {
  const { t } = useTranslation();
  const { id = '' } = useParams();
  const roomRef = useRef<Room | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const [screen, setScreen] = useState<ScreenState>('loading');
  const [call, setCall] = useState<ConsultationCallState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [micOn, setMicOn] = useState(true);
  // Calls start audio-only. The patient opts into video explicitly.
  const [cameraOn, setCameraOn] = useState(false);
  const [remoteConnected, setRemoteConnected] = useState(false);
  const [remoteVideoOn, setRemoteVideoOn] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!id) {
        setError(i18n.t('call.missingId'));
        setScreen('error');
        return;
      }

      try {
        const response = await fetchConsultationCall(id);
        if (cancelled) return;

        setCall(response.call);
        if (!response.call.status) {
          setScreen('waiting');
        } else if (response.call.status === 'ended') {
          setScreen('ended');
        } else if (response.call.patientConsentRequired && !response.call.patientConsented) {
          setScreen('consent');
        } else {
          setScreen('consent');
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : i18n.t('call.loadFailed'));
        setScreen('error');
      }
    }

    void load();

    return () => {
      cancelled = true;
      roomRef.current?.disconnect();
      roomRef.current = null;
    };
  }, [id]);

  const connect = useCallback(async () => {
    if (!id) return;
    setScreen('connecting');
    setError(null);

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
    // Fires when the doctor ends the call: the API deletes the room, which disconnects us.
    // Must not clobber a failure message, since leaving also disconnects.
    room.on(RoomEvent.Disconnected, () =>
      setScreen((current) => (current === 'error' ? current : 'ended')),
    );

    try {
      if (!call?.patientConsented) {
        const consent = await consentToConsultationRecording(id);
        setCall(consent.call);
      }

      const response = await joinConsultationCall(id);
      setCall(response.call);
      await room.connect(response.livekitUrl, response.token);
      // Audio only to begin with — the camera is published only if the patient turns it on.
      await room.localParticipant.setMicrophoneEnabled(true);
      setScreen('connected');
    } catch (err) {
      room.off(RoomEvent.TrackSubscribed, handleTrackSubscribed);
      room.off(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed);
      room.disconnect();
      roomRef.current = null;
      setError(err instanceof Error ? err.message : i18n.t('call.joinFailed'));
      setScreen('error');
    }
  }, [call?.patientConsented, id]);

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
      setError(err instanceof Error ? err.message : i18n.t('call.micFailed'));
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
      setError(err instanceof Error ? err.message : i18n.t('call.cameraFailed'));
    }
  }, [cameraOn]);

  // Leaving ends the consultation for both sides, so the doctor is disconnected too rather
  // than being left alone in the room with egress still recording.
  const leaveCall = useCallback(async () => {
    if (!id || leaving) return;
    setLeaving(true);

    try {
      const response = await endConsultationCall(id);
      setCall(response.call);
    } catch (err) {
      setError(err instanceof Error ? err.message : i18n.t('call.endFailed'));
    } finally {
      roomRef.current?.disconnect();
      setScreen('ended');
      setLeaving(false);
    }
  }, [id, leaving]);

  return (
    <main className="h-[100dvh] min-h-mobile overflow-x-hidden overflow-y-auto bg-surface text-on-surface">
      <header className="border-b border-border-default bg-surface/95 px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <Link to="/home" className="rounded-full border border-border-default px-3 py-1.5 text-[12px] font-semibold">
            {t('call.home')}
          </Link>
          <div className="rounded-full bg-primary-fixed px-3 py-1 text-[11px] font-semibold text-primary">
            {call?.recording?.status
              ? t('call.recordingStatus', { status: call.recording.status })
              : call?.patientConsentRequired
                ? t('call.audioRecorded')
                : t('call.secure')}
          </div>
        </div>
        <h1 className="mt-4 font-display text-[29px] leading-[1.08]">{t('call.title')}</h1>
        <p className="mt-2 text-[13px] leading-[1.5] text-on-surface-variant">
          {call?.patientConsentRequired ? t('call.introRecorded') : t('call.intro')}
        </p>
      </header>

      <section className="px-4 py-4">
        {screen === 'loading' ? (
          <div className="rounded-[20px] border border-border-default bg-surface-raised px-4 py-6 text-[13px] text-on-surface-variant">
            {t('call.checkingStatus')}
          </div>
        ) : null}

        {screen === 'waiting' ? (
          <div className="rounded-[20px] border border-dashed border-border-default bg-surface-container-low px-4 py-6">
            <h2 className="font-display text-[24px] leading-[1.1]">{t('call.waitingTitle')}</h2>
            <p className="mt-2 text-[13px] leading-[1.5] text-on-surface-variant">
              {t('call.waitingBody')}
            </p>
          </div>
        ) : null}

        {screen === 'consent' ? (
          <div className="rounded-[20px] border border-border-default bg-surface-raised px-4 py-5">
            <h2 className="font-display text-[24px] leading-[1.1]">
              {call?.patientConsentRequired ? t('call.consentTitle') : t('call.joinTitle')}
            </h2>
            <p className="mt-3 text-[13px] leading-[1.6] text-on-surface-variant">
              {call?.patientConsentRequired ? t('call.consentBody') : t('call.joinBody')}
            </p>
            <button
              type="button"
              onClick={connect}
              className="mt-5 inline-flex w-full items-center justify-center rounded-full bg-secondary px-4 py-3 text-[14px] font-semibold text-on-secondary"
            >
              {call?.patientConsentRequired ? t('call.consentAndJoin') : t('call.joinCall')}
            </button>
          </div>
        ) : null}

        {screen === 'connecting' || screen === 'connected' ? (
          <>
            <div className="relative aspect-[3/4] overflow-hidden rounded-[20px] border border-border-default bg-inverse-surface text-inverse-on-surface shadow-[0_16px_35px_rgba(62,37,66,0.14)]">
              <video ref={remoteVideoRef} className="h-full w-full bg-[#2F2034] object-cover" autoPlay playsInline />
              <audio ref={remoteAudioRef} autoPlay />
              {!remoteConnected ? (
                <div className="absolute inset-0 grid place-items-center px-8 text-center">
                  <div>
                    <div className="font-display text-[26px]">{t('call.connecting')}</div>
                    <p className="mt-2 text-[13px] leading-[1.5] text-[#EADFEF]">
                      {t('call.keepOpen')}
                    </p>
                  </div>
                </div>
              ) : !remoteVideoOn ? (
                <div className="absolute inset-0 grid place-items-center px-8 text-center">
                  <div>
                    <div className="font-display text-[26px]">{t('call.doctorCameraOff')}</div>
                    <p className="mt-2 text-[13px] leading-[1.5] text-[#EADFEF]">
                      {t('call.audioOnly')}
                    </p>
                  </div>
                </div>
              ) : null}
              <div className="absolute bottom-3 right-3 h-32 w-24 overflow-hidden rounded-[16px] border border-white/30 bg-[#4A3050] shadow-lg">
                <video ref={localVideoRef} className="h-full w-full object-cover" autoPlay muted playsInline />
                {!cameraOn ? (
                  <div className="absolute inset-0 grid place-items-center bg-[#4A3050] px-2 text-center text-[10px] font-semibold text-[#EADFEF]">
                    {t('call.cameraOff')}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-3">
              <button
                type="button"
                onClick={toggleMic}
                disabled={screen !== 'connected'}
                className="rounded-full border border-border-default bg-surface-raised px-3 py-3 text-[13px] font-semibold disabled:opacity-45"
              >
                {micOn ? t('call.mute') : t('call.unmute')}
              </button>
              <button
                type="button"
                onClick={toggleCamera}
                disabled={screen !== 'connected'}
                className="rounded-full border border-border-default bg-surface-raised px-3 py-3 text-[13px] font-semibold disabled:opacity-45"
              >
                {cameraOn ? t('call.cameraOff') : t('call.cameraOn')}
              </button>
              <button
                type="button"
                onClick={leaveCall}
                disabled={leaving || screen !== 'connected'}
                className="rounded-full bg-error px-3 py-3 text-[13px] font-semibold text-on-error disabled:opacity-45"
              >
                {leaving ? t('call.leaving') : t('call.leave')}
              </button>
            </div>
          </>
        ) : null}

        {screen === 'error' ? (
          <div className="rounded-[20px] border border-error/20 bg-error-container px-4 py-4 text-[13px] text-on-error-container">
            {error ?? t('call.openFailed')}
          </div>
        ) : null}

        {screen === 'ended' ? (
          <div className="rounded-[20px] border border-border-default bg-surface-raised px-4 py-5">
            <h2 className="font-display text-[24px] leading-[1.1]">{t('call.endedTitle')}</h2>
            <p className="mt-2 text-[13px] leading-[1.5] text-on-surface-variant">
              {t('call.endedBody')}
            </p>
            <Link
              to="/home"
              className="mt-5 inline-flex w-full items-center justify-center rounded-full bg-secondary px-4 py-3 text-[14px] font-semibold text-on-secondary"
            >
              {t('call.backToHome')}
            </Link>
          </div>
        ) : null}
      </section>
    </main>
  );
}
