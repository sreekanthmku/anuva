import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
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
 *
 * The step copy carries `<strong>` runs mid-sentence, so those lines go through `<Trans>`: the
 * emphasis falls on a different word in every language, and splitting the sentence into fragments
 * would fix it in English word order.
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
      <Trans
        i18nKey="install.homeScreenNote"
        components={{ 1: <strong className="text-on-surface" /> }}
      />
    </p>
  );
}

function PromptScreen() {
  const { t } = useTranslation();
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
      <Title>{t('install.promptTitle')}</Title>
      <Body>{t('install.promptBody')}</Body>
      <PrimaryButton onClick={() => void onInstall()} disabled={busy} className="mt-6">
        {busy ? t('install.promptOpening') : t('install.promptCta')}
      </PrimaryButton>
      {dismissed && (
        <p className="mt-4 text-[12px] leading-[1.6] text-outline">
          <Trans
            i18nKey="install.promptDismissed"
            components={{
              1: <strong className="text-on-surface" />,
              3: <strong className="text-on-surface" />,
            }}
          />
        </p>
      )}
    </>
  );
}

function JustInstalledScreen() {
  const { t } = useTranslation();

  return (
    <>
      <Title>{t('install.justInstalledTitle')}</Title>
      <Body>{t('install.justInstalledBody')}</Body>
      <OpenFromHomeScreenNote />
    </>
  );
}

function AlreadyInstalledScreen() {
  const { t } = useTranslation();

  return (
    <>
      <Title>{t('install.alreadyInstalledTitle')}</Title>
      <Body>{t('install.alreadyInstalledBody')}</Body>
      <OpenFromHomeScreenNote />
    </>
  );
}

function InAppBrowserScreen() {
  const { t } = useTranslation();
  const appName = getInAppBrowserName();

  return (
    <>
      <Title>{t('install.inAppTitle')}</Title>
      <Body>
        {appName ? t('install.inAppBodyNamed', { app: appName }) : t('install.inAppBody')}
      </Body>
      <Steps
        items={[
          t('install.inAppStep1'),
          <Trans
            key="in-app-2"
            i18nKey="install.inAppStep2"
            components={{ 1: <strong />, 3: <strong />, 5: <strong /> }}
          />,
          t('install.inAppStep3'),
        ]}
      />
    </>
  );
}

function IosScreen() {
  const { t } = useTranslation();

  return (
    <>
      <Title>{t('install.iosTitle')}</Title>
      <Body>{t('install.iosBody')}</Body>
      <Steps
        items={[
          <Trans key="ios-1" i18nKey="install.iosStep1" components={{ 1: <ShareIcon /> }} />,
          <Trans key="ios-2" i18nKey="install.iosStep2" components={{ 1: <strong /> }} />,
          <Trans key="ios-3" i18nKey="install.iosStep3" components={{ 1: <strong /> }} />,
        ]}
      />
      <p className="mt-5 text-[12px] leading-[1.6] text-outline">
        <Trans
          i18nKey="install.iosNoShare"
          components={{ 1: <strong className="text-on-surface" /> }}
        />
      </p>
      <OpenFromHomeScreenNote />
    </>
  );
}

/** iOS Share glyph, inline so the step reads as one sentence. */
function ShareIcon() {
  const { t } = useTranslation();

  return (
    <svg
      viewBox="0 0 24 24"
      role="img"
      aria-label={t('install.shareLabel')}
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
  const { t } = useTranslation();

  return (
    <>
      <Title>{t('install.manualTitle')}</Title>
      <Body>{t('install.manualBody')}</Body>
      <Steps
        items={[
          t('install.manualStep1'),
          <Trans
            key="manual-2"
            i18nKey="install.manualStep2"
            components={{ 1: <strong />, 3: <strong /> }}
          />,
          t('install.manualStep3'),
        ]}
      />
      <p className="mt-5 text-[12px] leading-[1.6] text-outline">{t('install.manualFallback')}</p>
    </>
  );
}
