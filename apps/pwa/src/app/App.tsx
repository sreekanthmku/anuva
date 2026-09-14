import { AppRouter } from './router';
import { AppProviders } from './providers';
import { AppErrorBoundary } from '../lib/AppErrorBoundary';
import { BetaReporter } from '../features/beta/BetaReporter';

export default function App() {
  // Outside the providers: a crash while a provider is initialising is exactly the kind this has to
  // catch, and a boundary nested inside them would go down with them.
  return (
    <AppErrorBoundary>
      <AppProviders>
        <AppRouter />
        {/* At the root, not in a shell: the patient app renders its nav per route, and a bug on the
            splash or login screen has to be reportable too. */}
        <BetaReporter app="patient-pwa" />
      </AppProviders>
    </AppErrorBoundary>
  );
}
