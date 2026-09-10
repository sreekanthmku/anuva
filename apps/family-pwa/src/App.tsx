import { useEffect } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes, useNavigate } from 'react-router-dom';
import { AppShell } from './features/shell/AppShell';
import { TodayRoute } from './features/today/TodayRoute';
import { LearnRoute } from './features/learn/LearnRoute';
import { ArticleRoute } from './features/learn/ArticleRoute';
import { PrivacyRoute } from './features/privacy/PrivacyRoute';
import { FamilyAuthProvider } from './features/auth/FamilyAuthProvider';
import { FamilyProtectedRoute } from './features/auth/FamilyProtectedRoute';
import JoinRoute from './features/auth/JoinRoute';
import SignInRoute from './features/auth/SignInRoute';

/**
 * A tap on a notification while the app is already open. The FCM worker cannot navigate a client it
 * does not control — the page belongs to the workbox worker — so it focuses the window and posts
 * the destination here instead.
 */
function ServiceWorkerNavListener() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const onMessage = (event: MessageEvent) => {
      const data = event.data;
      if (data && data.type === 'family-navigate' && typeof data.url === 'string') {
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
    <FamilyProtectedRoute>
      <AppShell>
        <Outlet />
      </AppShell>
    </FamilyProtectedRoute>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ServiceWorkerNavListener />
      <FamilyAuthProvider>
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
      </FamilyAuthProvider>
    </BrowserRouter>
  );
}
