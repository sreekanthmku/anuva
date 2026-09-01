import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { AppShell } from './features/shell/AppShell';
import { TodayRoute } from './features/today/TodayRoute';
import { LearnRoute } from './features/learn/LearnRoute';
import { PrivacyRoute } from './features/privacy/PrivacyRoute';
import { FamilyAuthProvider } from './features/auth/FamilyAuthProvider';
import { FamilyProtectedRoute } from './features/auth/FamilyProtectedRoute';
import JoinRoute from './features/auth/JoinRoute';
import SignInRoute from './features/auth/SignInRoute';

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
            <Route path="/privacy" element={<PrivacyRoute />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </FamilyAuthProvider>
    </BrowserRouter>
  );
}
