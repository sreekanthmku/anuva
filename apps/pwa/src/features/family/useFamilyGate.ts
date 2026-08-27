import { useCallback, useEffect, useRef, useState } from 'react';
import type { FamilyShareChannel, FamilyStatusResponse } from '@anuva/shared';
import { fetchFamilyStatus, markFamilyInviteShared } from './api';

/**
 * Owns the invite gate's state.
 *
 * Two clocks matter and neither is trusted to the client. The server decides whether the gate is
 * open (`gate.mustShare`) and how long a share bought (`gate.repromptAfterSeconds`), both derived
 * from `FamilyInvite.sharedAt` in Postgres — so reloading, switching devices, or reinstalling the
 * PWA cannot extend the window. This hook only arms a timer for the deadline the server named, and
 * re-asks.
 *
 * It also polls, because the gate has to disappear on its own the moment a family member verifies:
 * she will be looking at the dialog when it happens, with no reason to touch anything.
 */

const POLL_MS = 30_000;

export type FamilyGateState = {
  open: boolean;
  status: FamilyStatusResponse | null;
  isSharing: boolean;
  error: string | null;
  /** Set once, when a member is first seen joining during this session. */
  justJoinedName: string | null;
  share: (channel: FamilyShareChannel, action: () => void | Promise<void>) => Promise<void>;
  refresh: () => Promise<void>;
  dismissJoinedNotice: () => void;
};

export function useFamilyGate(enabled: boolean): FamilyGateState {
  const [status, setStatus] = useState<FamilyStatusResponse | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justJoinedName, setJustJoinedName] = useState<string | null>(null);

  // Once a member exists or she is opted out there is nothing left to learn, so the polling stops
  // for the rest of the session rather than running forever behind every screen.
  const settled = useRef(false);
  const sawMember = useRef(false);
  const reopenTimer = useRef<number | null>(null);

  const load = useCallback(async () => {
    if (!enabled || settled.current) return;

    try {
      const next = await fetchFamilyStatus();
      setStatus(next);
      setError(null);

      if (next.member && !sawMember.current) {
        sawMember.current = true;
        setJustJoinedName(next.member.name);
      }

      if (next.member || next.optedOut) {
        settled.current = true;
      }
    } catch (e) {
      // A failed poll must not blank a gate that is already open: keep the last known state and let
      // the next tick recover. Blocking on a network blip would be worse than a stale countdown.
      setError(e instanceof Error ? e.message : 'Could not check your family invite.');
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    void load();
    const poll = window.setInterval(() => void load(), POLL_MS);
    const onWake = () => void load();

    window.addEventListener('focus', onWake);
    document.addEventListener('visibilitychange', onWake);

    return () => {
      window.clearInterval(poll);
      window.removeEventListener('focus', onWake);
      document.removeEventListener('visibilitychange', onWake);
    };
  }, [enabled, load]);

  // Re-ask exactly when the server said the grace window ends. The extra second absorbs clock skew,
  // so the reply is "open" rather than "one more second".
  useEffect(() => {
    const seconds = status?.gate.repromptAfterSeconds;

    if (reopenTimer.current !== null) {
      window.clearTimeout(reopenTimer.current);
      reopenTimer.current = null;
    }

    if (!enabled || settled.current || seconds === null || seconds === undefined) {
      return;
    }

    reopenTimer.current = window.setTimeout(() => void load(), (seconds + 1) * 1000);

    return () => {
      if (reopenTimer.current !== null) {
        window.clearTimeout(reopenTimer.current);
        reopenTimer.current = null;
      }
    };
  }, [enabled, status?.gate.repromptAfterSeconds, load]);

  /**
   * `action` runs first and synchronously — it is the part that needs the user gesture (see
   * shareInvite.ts). Only then is the share recorded, and only then does the gate close.
   */
  const share = useCallback(
    async (channel: FamilyShareChannel, action: () => void | Promise<void>) => {
      const inviteId = status?.invite?.id;
      if (!inviteId) return;

      setIsSharing(true);
      try {
        await action();
        const result = await markFamilyInviteShared(inviteId, channel);
        setStatus((current) => (current ? { ...current, ...result } : current));
        setError(null);
      } catch (e) {
        // The link may well have been sent even though recording it failed. Say so, and leave the
        // gate open rather than pretending the window started.
        setError(
          e instanceof Error
            ? `${e.message} If you already sent the link, tap share again.`
            : 'Could not record that you shared the link.',
        );
      } finally {
        setIsSharing(false);
      }
    },
    [status?.invite?.id],
  );

  return {
    open: Boolean(enabled && status?.gate.mustShare),
    status,
    isSharing,
    error,
    justJoinedName,
    share,
    refresh: load,
    dismissJoinedNotice: () => setJustJoinedName(null),
  };
}
