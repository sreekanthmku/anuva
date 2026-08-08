import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { DoctorNotification } from '@anuva/shared';
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

  const refresh = useCallback(async () => {
    try {
      const response = await fetchDoctorNotifications();
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
