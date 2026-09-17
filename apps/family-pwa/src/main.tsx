import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// First, and before anything that can throw.
import { initSentry } from './lib/sentry';
import '@fontsource/mulish/300.css';
import '@fontsource/mulish/400.css';
import '@fontsource/mulish/500.css';
import '@fontsource/mulish/600.css';
import '@fontsource/mulish/700.css';
import '@fontsource/fraunces/400.css';
import '@fontsource/fraunces/500.css';
import '@fontsource/fraunces/600.css';
import '@fontsource/fraunces/700.css';
import '@fontsource/fraunces/400-italic.css';
import '@fontsource/dancing-script/500.css';
import '@fontsource/dancing-script/600.css';
import '@fontsource/dancing-script/700.css';
import App from './App';
// Registers the beforeinstallprompt listener at import time: the event can fire before React mounts
// and is only usable if it was captured when it fired.
import './lib/pwa/installPrompt';
import './index.css';

initSentry();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
