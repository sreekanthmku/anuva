import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { LanguageToggle } from '../../i18n/LanguageToggle';
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
    <main className="relative min-h-mobile flex flex-col items-center justify-center overflow-x-hidden bg-surface px-6 py-12 text-on-surface">
      {/* Above everything: someone who cannot read the install instructions cannot be asked to
          follow them before switching language. */}
      <div className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))]">
        <LanguageToggle />
      </div>
      <div className="flex w-full max-w-sm flex-col items-center text-center">{children}</div>
    </main>
  );
}

function Wordmark() {
  const { t } = useTranslation();

  return (
    <>
      <img
        src="/anuva-logo-icon.png"
        alt={t('common.logoAlt')}
        className="mb-5 h-20 w-20 object-contain"
      />
      <p className="text-[22px] tracking-[0.18em]" style={HEADING_FONT}>
        {t('common.brandName')}
      </p>
      <p
        className="mt-1.5 text-[18px] text-secondary"
        style={{ fontFamily: '"Dancing Script", cursive', fontWeight: 600 }}
      >
        {t('common.tagline')}
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
      {/* Through Trans: which words the emphasis falls on moves with the language. */}
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
    // 'accepted' re-renders as 'just-installed' via the appinstalled event, so
    // only the dismissed and unavailable paths need handling here.
    if (outcome !== 'accepted') setDismissed(true);
  }

  return (
    <>
      <Title>{t('install.promptTitle')}</Title>
      <Body>{t('install.promptBody')}</Body>
      <PrimaryButton onClick={() => void onInstall()} disabled={busy}>
        {busy ? t('install.promptOpening') : t('install.promptCta')}
      </PrimaryButton>
      {dismissed && (
        <p className="mt-5 text-[13px] text-on-surface-variant" style={BODY_FONT}>
          <Trans
            i18nKey="install.promptDismissed"
            components={{ 1: <strong className="text-on-surface" /> }}
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
      <p className="mt-6 text-[13px] text-on-surface-variant" style={BODY_FONT}>
        {t('install.iosNoShare')}
      </p>
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
      <p className="mt-6 text-[13px] text-on-surface-variant" style={BODY_FONT}>
        {t('install.manualFallback')}
      </p>
    </>
  );
}
