import { subscribeToForegroundNotifications } from './lib/firebase';
import { useEffect } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes, useNavigate } from 'react-router-dom';
import { AppErrorBoundary } from './lib/AppErrorBoundary';
import { BetaReporter } from './features/beta/BetaReporter';
import { AppShell } from './features/shell/AppShell';
import { TodayRoute } from './features/today/TodayRoute';
import { LearnRoute } from './features/learn/LearnRoute';
import { ArticleRoute } from './features/learn/ArticleRoute';
import { PrivacyRoute } from './features/privacy/PrivacyRoute';
import { FamilyAuthProvider } from './features/auth/FamilyAuthProvider';
import { FamilyProtectedRoute } from './features/auth/FamilyProtectedRoute';
import { InstallGuard } from './features/install/InstallGuard';
import JoinRoute from './features/auth/JoinRoute';
import SignInRoute from './features/auth/SignInRoute';
import { LanguageKeyed } from './i18n/LanguageKeyed';
import {
  alreadyHandled,
  clearPendingNavigation,
  markNavigationHandled,
  takePendingNavigation,
} from './lib/pwa/pendingNavigation';

/**
 * A tap on a notification while the app is already open. The FCM worker cannot navigate a client it
 * does not control — the page belongs to the workbox worker — so it focuses the window and posts
 * the destination here instead.
 */
function ServiceWorkerNavListener() {
  const navigate = useNavigate();

  // The posted message: instant, but only for an app that is merely hidden and still running.
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const onMessage = (event: MessageEvent) => {
      const data = event.data;
      if (data && data.type === 'family-navigate' && typeof data.url === 'string') {
        // Claim the destination before navigating: the stored copy is being read concurrently, and
        // whichever route arrives second must not navigate to the same place again.
        if (alreadyHandled(data.url)) return;
        markNavigationHandled(data.url);
        void clearPendingNavigation();
        navigate(data.url);
      }
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, [navigate]);

  // The stored copy: what a frozen app reads when it wakes. iOS freezes a backgrounded web app and
  // drops the message above, which is why tapping a notification used to bring the app forward on
  // the screen it was left on, with the note or thank-you nowhere.
  useEffect(() => {
    let cancelled = false;
    const collect = () => {
      if (document.visibilityState !== 'visible') return;
      void takePendingNavigation().then((url) => {
        if (url && !cancelled) navigate(url);
      });
    };

    collect();
    document.addEventListener('visibilitychange', collect);
    window.addEventListener('pageshow', collect);
    window.addEventListener('focus', collect);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', collect);
      window.removeEventListener('pageshow', collect);
      window.removeEventListener('focus', collect);
    };
  }, [navigate]);

  return null;
}

function ForegroundNotificationListener() {
  useEffect(() => subscribeToForegroundNotifications(), []);
  return null;
}

/**
 * Auth first, then the install gate: someone who has not joined yet needs the sign-in screen, not
 * an instruction to install an app they have no account on. See InstallGuard for why the gate sits
 * here rather than above the router.
 */
function ShellLayout() {
  return (
    <FamilyProtectedRoute>
      <InstallGuard>
        <AppShell>
          <Outlet />
        </AppShell>
      </InstallGuard>
    </FamilyProtectedRoute>
  );
}

export default function App() {
  return (
    // Outside the router and the auth provider: a crash in either is what this exists to catch.
    <AppErrorBoundary>
      <BrowserRouter>
        <ForegroundNotificationListener />
        <ServiceWorkerNavListener />
        <FamilyAuthProvider>
          <LanguageKeyed>
            <Routes>
              {/* Public: the magic link lands here, token in the fragment. */}
              <Route path="/join" element={<JoinRoute />} />
              {/* Public: a returning member whose session lapsed. The phone they verified at join is
              the credential — the invite link was single-use and is long gone. */}
              <Route path="/signin" element={<SignInRoute />} />
              <Route element={<ShellLayout />}>
                <Route path="/" element={<TodayRoute />} />
                <Route path="/learn" element={<LearnRoute />} />
                <Route path="/learn/:slug" element={<ArticleRoute />} />
                <Route path="/privacy" element={<PrivacyRoute />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </LanguageKeyed>
        </FamilyAuthProvider>
        {/* Outside the auth provider: the join and sign-in screens need reporting too. */}
        <BetaReporter app="family-pwa" />
      </BrowserRouter>
    </AppErrorBoundary>
  );
}
