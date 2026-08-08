import { useAtom } from 'jotai';
import { adminTokenAtom } from './atoms';
import { LoginForm } from './features/auth/LoginForm';
import { AdminShell } from './features/layout/AdminShell';

export default function App() {
  const [token] = useAtom(adminTokenAtom);
  return token ? <AdminShell /> : <LoginForm />;
}
