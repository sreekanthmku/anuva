import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { AppShell } from './features/shell/AppShell';
import { TodayRoute } from './features/today/TodayRoute';
import { LearnRoute } from './features/learn/LearnRoute';
import { PrivacyRoute } from './features/privacy/PrivacyRoute';

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
      <Routes>
        <Route element={<ShellLayout />}>
          <Route path="/" element={<TodayRoute />} />
          <Route path="/learn" element={<LearnRoute />} />
          <Route path="/privacy" element={<PrivacyRoute />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
