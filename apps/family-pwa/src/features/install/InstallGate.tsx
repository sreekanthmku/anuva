import { useState } from 'react';
import { promptInstall } from '../../lib/pwa/installPrompt';
import { getInAppBrowserName } from '../../lib/pwa/platform';
import { AuthShell } from '../auth/AuthShell';
import { PrimaryButton } from '../shell/ui';
import { useInstallGate } from './useInstallGate';

/**
 * The install screen, shown to a signed-in family member who is still in a browser tab.
 *
 * Deliberately not the doorway: the invite arrives as a WhatsApp message and asking a stranger to
 * install something before they know what it is would lose most of them. They join first, and this
 * is the last step in.
 *
 * Every screen here says the same thing in a different way — get the icon onto the home screen —
 * because the mechanics differ per platform and a single generic instruction fits none of them.
 */
export default function InstallGate() {
  const { variant } = useInstallGate();

  // One microtask on Chromium, immediate elsewhere. The shell alone reads as the screen still
  // arriving rather than as something broken.
  if (variant === 'checking') return <AuthShell>{null}</AuthShell>;

  return (
    <AuthShell>
      {variant === 'prompt' && <PromptScreen />}
      {variant === 'just-installed' && <JustInstalledScreen />}
      {variant === 'already-installed' && <AlreadyInstalledScreen />}
      {variant === 'in-app-browser' && <InAppBrowserScreen />}
      {variant === 'ios' && <IosScreen />}
      {variant === 'manual' && <ManualScreen />}
    </AuthShell>
  );
}

function Title({ children }: { children: React.ReactNode }) {
  return (
    <h1 className="font-display text-[26px] font-medium leading-[1.18] text-primary">{children}</h1>
  );
}

function Body({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-3 text-[13.5px] leading-[1.6] text-on-surface-variant">{children}</p>
  );
}

/** Numbered steps, used by every manual-instruction screen. */
function Steps({ items }: { items: React.ReactNode[] }) {
  return (
    <ol className="mt-6 space-y-2.5">
      {items.map((item, index) => (
        // Index keys are safe here: the step lists are static, ordered copy.
        <li
          key={index}
          className="flex gap-3 rounded-[20px] border border-border-default bg-surface-raised px-4 py-3.5 shadow-soft"
        >
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-secondary text-[12px] font-bold text-on-secondary">
            {index + 1}
          </span>
          <span className="text-[13.5px] leading-[1.55] text-on-surface">{item}</span>
        </li>
      ))}
    </ol>
  );
}

/**
 * The handoff note. Said on every screen that ends with "open it from your home screen", because on
 * iPhone the installed app has its own cookie jar — the session she just opened in Safari does not
 * travel with it, and being asked for the code a second time looks like a fault unless it was
 * announced.
 */
function OpenFromHomeScreenNote() {
  return (
    <p className="mt-5 text-[12px] leading-[1.6] text-outline">
      Look for the <strong className="text-on-surface">Anuva Family</strong> icon on your home
      screen. If it asks for your number again, it is the same one-time code — your phone is what
      signs you in.
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
    // 'accepted' re-renders as 'just-installed' via the appinstalled event, so only the dismissed
    // and unavailable paths need handling here.
    if (outcome !== 'accepted') setDismissed(true);
  }

  return (
    <>
      <Title>One last step: add the app</Title>
      <Body>
        Anuva Family lives on your home screen. That is how we can tell you when she opens your note
        — a browser tab cannot.
      </Body>
      <PrimaryButton onClick={() => void onInstall()} disabled={busy} className="mt-6">
        {busy ? 'Opening…' : 'Add to home screen'}
      </PrimaryButton>
      {dismissed && (
        <p className="mt-4 text-[12px] leading-[1.6] text-outline">
          That did not finish. Tap the button again, or open your browser menu and choose{' '}
          <strong className="text-on-surface">Install app</strong> or{' '}
          <strong className="text-on-surface">Add to Home screen</strong>.
        </p>
      )}
    </>
  );
}

function JustInstalledScreen() {
  return (
    <>
      <Title>You are all set</Title>
      <Body>
        Open Anuva Family from your home screen to carry on. Your browser cannot open it for you, so
        this last tap is yours.
      </Body>
      <OpenFromHomeScreenNote />
    </>
  );
}

function AlreadyInstalledScreen() {
  return (
    <>
      <Title>You already have the app</Title>
      <Body>
        Anuva Family is on this device already. Open it from your home screen rather than this tab —
        notifications only reach you there.
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
          ? `${appName}'s built-in browser cannot add apps to your home screen. Reopen this page in Safari or Chrome and you are two taps from done.`
          : 'This in-app browser cannot add apps to your home screen. Reopen this page in Safari or Chrome and you are two taps from done.'}
      </Body>
      <Steps
        items={[
          'Tap the menu button in the corner of this screen.',
          <>
            Choose <strong>Open in browser</strong>, <strong>Open in Safari</strong>, or{' '}
            <strong>Open in Chrome</strong>.
          </>,
          'Come back to this page and add Anuva Family.',
        ]}
      />
    </>
  );
}

function IosScreen() {
  return (
    <>
      <Title>Add Anuva Family to your home screen</Title>
      <Body>
        On iPhone this is done from Safari&apos;s Share menu. Two taps, and the icon is on your home
        screen.
      </Body>
      <Steps
        items={[
          <>
            Tap the Share button <ShareIcon /> at the bottom of Safari.
          </>,
          <>
            Scroll down and tap <strong>Add to Home Screen</strong>.
          </>,
          <>
            Tap <strong>Add</strong>, then open Anuva Family from your home screen.
          </>,
        ]}
      />
      <p className="mt-5 text-[12px] leading-[1.6] text-outline">
        No Share button? You are probably still inside WhatsApp. Tap the ••• or compass icon in the
        corner and choose <strong className="text-on-surface">Open in Safari</strong> first.
      </p>
      <OpenFromHomeScreenNote />
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
      <Title>One last step: add the app</Title>
      <Body>
        Anuva Family runs from your home screen. Your browser has not offered a button for it, so
        add it from the browser menu.
      </Body>
      <Steps
        items={[
          'Open your browser menu.',
          <>
            Choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.
          </>,
          'Open Anuva Family from your home screen.',
        ]}
      />
      <p className="mt-5 text-[12px] leading-[1.6] text-outline">
        If that option is not there, open this page in Chrome or Safari.
      </p>
    </>
  );
}
