import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// First, and before anything that can throw: an error during font loading or the install-prompt
// side effect below should still be reported.
import { initSentry } from './lib/sentry';
// Anuva brand fonts: Mulish (body), Fraunces (headings/serif), Dancing Script (accent)
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
import '@fontsource/space-mono/400.css';
import '@fontsource/space-mono/700.css';
// Before App: every screen reads from i18next at first render, and a component that mounts before
// init would render raw keys for a frame.
import './i18n';
import App from './App';
// Imported for its side effect: `beforeinstallprompt` can fire before React
// mounts, and the event is only usable if it was captured when it fired.
import './lib/pwa/installPrompt';
import './index.css';

initSentry();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
