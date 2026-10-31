import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { DoctorNotification } from '@anuva/shared';
import { announce } from '../../lib/a11y/announce';
import { onForegroundPush, syncDoctorPushIfGranted } from '../../lib/push';
import { fetchDoctorNotifications, markDoctorNotificationsRead } from './api';

type NotificationsContextValue = {
  notifications: DoctorNotification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  markAllRead: () => Promise<void>;
};

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

/** How often the feed is re-pulled while the portal is open and visible. */
const POLL_MS = 60_000;

/**
 * One feed shared by the bell badge and the notifications tab, so the count in the nav and the
 * list behind it can never disagree. Push is the fast path; the poll is the fallback for a device
 * that never granted permission or lost its token.
 */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<DoctorNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Ids already seen, so a refresh that brings in a new alert can say so. Null until the first
  // load: what is there on sign-in is not news.
  const seenIds = useRef<Set<string> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await fetchDoctorNotifications();
      const seen = seenIds.current;
      if (seen) {
        const fresh = response.notifications.filter(
          (item) => item.readAt === null && !seen.has(item.id),
        );
        if (fresh.length === 1) announce(`New notification: ${fresh[0]!.title}`);
        else if (fresh.length > 1) announce(`${fresh.length} new notifications`);
      }
      seenIds.current = new Set([...(seen ?? []), ...response.notifications.map((item) => item.id)]);
      setNotifications(response.notifications);
      setUnreadCount(response.unreadCount);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load notifications.');
    } finally {
      setLoading(false);
    }
  }, []);

  const markAllRead = useCallback(async () => {
    // Optimistic: the badge clears the moment the tab opens, and a failed write is corrected by
    // the next refresh rather than blocking the read.
    const stamp = new Date().toISOString();
    setNotifications((current) =>
      current.map((item) => (item.readAt ? item : { ...item, readAt: stamp })),
    );
    setUnreadCount(0);

    try {
      const response = await markDoctorNotificationsRead();
      setUnreadCount(response.unreadCount);
    } catch {
      void refresh();
    }
  }, [refresh]);

  useEffect(() => {
    void refresh();

    // A token that rotated since the last visit is a device that has quietly stopped receiving.
    void syncDoctorPushIfGranted();

    const unsubscribe = onForegroundPush(() => {
      void refresh();
    });

    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void refresh();
      }
    }, POLL_MS);

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void refresh();
      }
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      unsubscribe();
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh]);

  const value = useMemo(
    () => ({ notifications, unreadCount, loading, error, refresh, markAllRead }),
    [notifications, unreadCount, loading, error, refresh, markAllRead],
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications(): NotificationsContextValue {
  const value = useContext(NotificationsContext);
  if (!value) {
    throw new Error('useNotifications must be used inside NotificationsProvider.');
  }

  return value;
}
