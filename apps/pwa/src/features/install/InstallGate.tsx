import { useState } from 'react';
import { promptInstall } from '../../lib/pwa/installPrompt';
import { getInAppBrowserName } from '../../lib/pwa/platform';
import { useInstallGate } from './useInstallGate';

const HEADING_FONT = { fontFamily: '"Fraunces", serif', fontWeight: 500 } as const;
const BODY_FONT = { fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' } as const;

export default function InstallGate() {
  const { variant } = useInstallGate();

  if (variant === 'checking') {
    // One microtask on Chromium, immediate elsewhere. Rendering the brand mark
    // rather than a spinner keeps it from reading as a flash of broken layout.
    return (
      <Shell>
        <Wordmark />
      </Shell>
    );
  }

  return (
    <Shell>
      <Wordmark />
      {variant === 'prompt' && <PromptScreen />}
      {variant === 'just-installed' && <JustInstalledScreen />}
      {variant === 'already-installed' && <AlreadyInstalledScreen />}
      {variant === 'in-app-browser' && <InAppBrowserScreen />}
      {variant === 'ios' && <IosScreen />}
      {variant === 'manual' && <ManualScreen />}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-mobile flex flex-col items-center justify-center overflow-x-hidden bg-surface px-6 py-12 text-on-surface">
      <div className="flex w-full max-w-sm flex-col items-center text-center">{children}</div>
    </main>
  );
}

function Wordmark() {
  return (
    <>
      <img
        src="/anuva-logo-icon.png"
        alt="Anuva Wellness logo"
        className="mb-5 h-20 w-20 object-contain"
      />
      <p className="text-[22px] tracking-[0.18em]" style={HEADING_FONT}>
        ANUVA WELLNESS
      </p>
      <p
        className="mt-1.5 text-[18px] text-secondary"
        style={{ fontFamily: '"Dancing Script", cursive', fontWeight: 600 }}
      >
        a soft place to land.
      </p>
    </>
  );
}

function Title({ children }: { children: React.ReactNode }) {
  return (
    <h1 className="mt-9 text-[26px] leading-tight" style={HEADING_FONT}>
      {children}
    </h1>
  );
}

function Body({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-3 text-[15px] leading-relaxed text-on-surface-variant" style={BODY_FONT}>
      {children}
    </p>
  );
}

/** Pill CTA, 44px minimum tap target per the design system. */
function PrimaryButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="mt-8 min-h-[52px] w-full rounded-full bg-primary px-6 text-[15px] text-on-primary transition-opacity disabled:opacity-60"
      style={{ ...BODY_FONT, fontWeight: 700 }}
    >
      {children}
    </button>
  );
}

/** Numbered steps, used by every manual-instruction screen. */
function Steps({ items }: { items: React.ReactNode[] }) {
  return (
    <ol className="mt-8 w-full space-y-3 text-left">
      {items.map((item, index) => (
        // Index keys are safe here: the step lists are static, ordered copy.
        <li key={index} className="flex gap-3 rounded-2xl bg-surface-container-low p-4">
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-[13px] text-on-primary"
            style={{ ...BODY_FONT, fontWeight: 700 }}
          >
            {index + 1}
          </span>
          <span className="text-[14px] leading-relaxed text-on-surface" style={BODY_FONT}>
            {item}
          </span>
        </li>
      ))}
    </ol>
  );
}

function OpenFromHomeScreenNote() {
  return (
    <p className="mt-6 text-[13px] text-on-surface-variant" style={BODY_FONT}>
      Look for the <strong className="text-on-surface">Anuva Wellness</strong> icon on your home
      screen.
    </p>
  );
}

function PromptScreen() {
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  async function onInstall() {
    setBusy(true);
    const outcome = await promptInstall();
    setBusy(false);
    // 'accepted' re-renders as 'just-installed' via the appinstalled event, so
    // only the dismissed and unavailable paths need handling here.
    if (outcome !== 'accepted') setDismissed(true);
  }

  return (
    <>
      <Title>Install the app to continue</Title>
      <Body>
        Anuva lives on your home screen, so your daily check-ins and reminders are always one tap
        away.
      </Body>
      <PrimaryButton onClick={() => void onInstall()} disabled={busy}>
        {busy ? 'Opening installer...' : 'Install Anuva'}
      </PrimaryButton>
      {dismissed && (
        <p className="mt-5 text-[13px] text-on-surface-variant" style={BODY_FONT}>
          Installation was not completed. Tap Install Anuva to try again, or use your browser menu
          and choose <strong className="text-on-surface">Add to Home screen</strong>.
        </p>
      )}
    </>
  );
}

function JustInstalledScreen() {
  return (
    <>
      <Title>Anuva is installed</Title>
      <Body>
        Open Anuva from your home screen to sign in. Your browser cannot open it for you, so this
        last step is manual.
      </Body>
      <OpenFromHomeScreenNote />
    </>
  );
}

function AlreadyInstalledScreen() {
  return (
    <>
      <Title>You already have Anuva</Title>
      <Body>
        Anuva is installed on this device. Open it from your home screen to continue where you left
        off.
      </Body>
      <OpenFromHomeScreenNote />
    </>
  );
}

function InAppBrowserScreen() {
  const appName = getInAppBrowserName();

  return (
    <>
      <Title>Open this page in your browser</Title>
      <Body>
        {appName
          ? `${appName}'s built-in browser cannot install apps. Reopen this page in Safari or Chrome to continue.`
          : 'This in-app browser cannot install apps. Reopen this page in Safari or Chrome to continue.'}
      </Body>
      <Steps
        items={[
          'Tap the menu button in the corner of this screen.',
          <>
            Choose <strong>Open in browser</strong>, <strong>Open in Safari</strong>, or{' '}
            <strong>Open in Chrome</strong>.
          </>,
          'Come back to this page and install Anuva.',
        ]}
      />
    </>
  );
}

function IosScreen() {
  return (
    <>
      <Title>Add Anuva to your home screen</Title>
      <Body>
        On iPhone, Anuva installs from Safari&apos;s Share menu. It takes two taps and then you are
        done.
      </Body>
      <Steps
        items={[
          <>
            Tap the Share button{' '}
            <ShareIcon /> at the bottom of Safari.
          </>,
          <>
            Scroll down and tap <strong>Add to Home Screen</strong>.
          </>,
          <>
            Tap <strong>Add</strong>, then open Anuva from your home screen.
          </>,
        ]}
      />
      <p className="mt-6 text-[13px] text-on-surface-variant" style={BODY_FONT}>
        If you do not see the Share button, make sure this page is open in Safari rather than
        another app.
      </p>
    </>
  );
}

/** iOS Share glyph, inline so the step reads as one sentence. */
function ShareIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      role="img"
      aria-label="Share"
      className="mx-0.5 inline-block h-[1.05em] w-[1.05em] -translate-y-[0.1em] align-middle"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 15V3" />
      <path d="M8 7l4-4 4 4" />
      <path d="M5 13v6a2 2 0 002 2h10a2 2 0 002-2v-6" />
    </svg>
  );
}

function ManualScreen() {
  return (
    <>
      <Title>Install the app to continue</Title>
      <Body>
        Anuva runs from your home screen. Your browser has not offered an install button, so add it
        from the browser menu.
      </Body>
      <Steps
        items={[
          'Open your browser menu.',
          <>
            Choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.
          </>,
          'Open Anuva from your home screen to sign in.',
        ]}
      />
      <p className="mt-6 text-[13px] text-on-surface-variant" style={BODY_FONT}>
        If you cannot find that option, open this page in Chrome or Safari.
      </p>
    </>
  );
}
