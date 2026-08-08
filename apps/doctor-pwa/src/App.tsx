import { useEffect } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes, useNavigate } from 'react-router-dom';
import { DoctorLoginGate } from './features/auth/DoctorLoginGate';
import { DoctorBookingsRoute } from './features/bookings/DoctorBookingsRoute';
import { DoctorCallRoute } from './features/call/DoctorCallRoute';
import { NotificationsRoute } from './features/notifications/NotificationsRoute';
import { NotificationsProvider } from './features/notifications/store';
import { ProfileRoute } from './features/profile/ProfileRoute';
import { DoctorQuestionsRoute } from './features/questions/DoctorQuestionsRoute';
import { AppShell } from './features/shell/AppShell';

/**
 * A tapped push is handled by the shared FCM service worker. When the portal is already open it
 * cannot navigate the page itself — the tab is controlled by the workbox worker, not that one —
 * so it posts the deep link here and the router does the navigation in-app.
 */
function PushNavigationBridge() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      return;
    }

    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; url?: string } | null;
      if (data?.type === 'nudge-navigate' && typeof data.url === 'string' && data.url.startsWith('/')) {
        navigate(data.url);
      }
    };

    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, [navigate]);

  return null;
}

function ShellLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <DoctorLoginGate>
        <NotificationsProvider>
          <PushNavigationBridge />
          <Routes>
            {/* The call takes over the whole screen — no shell, nothing to tap away to mid-call. */}
            <Route path="/call/:consultationId" element={<DoctorCallRoute />} />
            <Route element={<ShellLayout />}>
              <Route path="/" element={<DoctorBookingsRoute />} />
              <Route path="/questions" element={<DoctorQuestionsRoute />} />
              <Route path="/notifications" element={<NotificationsRoute />} />
              <Route path="/profile" element={<ProfileRoute />} />
              {/* A stale deep link from an old push must not land on a blank screen. */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </NotificationsProvider>
      </DoctorLoginGate>
    </BrowserRouter>
  );
}
