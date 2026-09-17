import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';
import { LanguageToggle } from '../../i18n/LanguageToggle';
import { DPDP_ACT_URL } from '../../shared/lib/dpdp';
import { useAuth } from '../auth/auth-context';
import { activateOneDaySubscription } from '../auth/session';
import { assessmentPath } from './config/assessmentView';

type PlanId = 'monthly' | 'annual' | 'family';

/** Order and identity only. Label, price, sublabel and footnote come from `subscription.plans.*`. */
const planIds: PlanId[] = ['monthly', 'annual', 'family'];

/** Order only; the copy is `subscription.included.*`. */
const includedKeys = [
  'chat',
  'tracking',
  'reports',
  'qa',
  'routing',
  'consult',
  'masterclass',
  'dpdp',
] as const;

export default function SubscriptionRoute() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const [selectedPlanId, setSelectedPlanId] = useState<PlanId>('annual');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isTrialAvailable = !!user?.trialAvailable;
  const trialDays = Number(import.meta.env.VITE_FREE_TRIAL_DAYS || '14');

  useEffect(() => {
    if (user && !user.onboardingCompleted) {
      navigate(assessmentPath(), { replace: true });
    }
  }, [navigate, user]);

  async function handlePrimaryAction() {
    if (user?.hasActiveAccess) {
      navigate('/home');
      return;
    }

    setIsSubmitting(true);
    try {
      await activateOneDaySubscription();
      await refreshUser();
      navigate('/home');
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-mobile overflow-auto bg-surface pt-[40px] text-on-surface">
      <section className="flex items-center justify-between px-3 pb-2.5 pt-0">
        <button
          type="button"
          onClick={() => navigate('/assessment-result')}
          className="bg-transparent p-0 text-[13px] text-on-surface-variant"
          style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' }}
        >
          {t('common.backArrow')}
        </button>
        <div className="flex items-center gap-2">
          <LanguageToggle variant="compact" />
          <img src="/anu.png" alt={t('subscription.logoAlt')} className="h-5 w-5 object-contain" />
        </div>
      </section>

      <section className="px-3 pb-[18px] pt-2">
        <div className="mb-3 flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-secondary">
          <span className="h-px w-3 bg-secondary/70" />
          <span style={{ fontFamily: '"Mulish", sans-serif' }}>
            {t('subscription.fullExperience')}
          </span>
        </div>

        <h1 className="font-display mb-2 text-[30px] leading-[1.1] tracking-[-0.03em] text-on-surface">
          <Trans
            i18nKey={isTrialAvailable ? 'subscription.titleTrial' : 'subscription.titleContinue'}
            components={{
              1: (
                <em
                  className="not-italic text-primary"
                  style={{ fontFamily: '"Fraunces", sans-serif' }}
                />
              ),
            }}
          />
        </h1>
        <p
          className="text-[13px] leading-[1.5] text-on-surface-variant"
          style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' }}
        >
          {isTrialAvailable
            ? t('subscription.trialSubline', { days: trialDays })
            : user?.requiresPayment
              ? t('subscription.trialEnded')
              : t('subscription.accessActive')}
        </p>
      </section>

      <section className="px-3 pb-4">
        <article className="rounded-[20px] border border-border-default bg-primary-container p-[18px]">
          <div className="mb-3.5 flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-primary">
            <span className="h-px w-3 bg-primary/60" />
            <span style={{ fontFamily: '"Mulish", sans-serif' }}>
              {t('subscription.everythingIncluded')}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-x-[14px] gap-y-[10px]">
            {includedKeys.map((item) => (
              <div key={item} className="flex items-start gap-1.5">
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  className="mt-0.5 shrink-0"
                  aria-hidden="true"
                >
                  <path
                    d="M5 12l5 5L20 7"
                    stroke="#5E3566"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span
                  className="text-[11.5px] leading-[1.35] text-on-surface"
                  style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' }}
                >
                  {/* Only the DPDP line carries a link, and where the linked words fall moves
                      with the language — so it goes through Trans rather than being split here. */}
                  {item === 'dpdp' ? (
                    <Trans
                      i18nKey="subscription.included.dpdp"
                      components={{
                        1: (
                          <a
                            href={DPDP_ACT_URL}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-inherit no-underline"
                          />
                        ),
                      }}
                    />
                  ) : (
                    t(`subscription.included.${item}`)
                  )}
                </span>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="flex flex-col gap-2.5 px-3">
        {planIds.map((planId) => {
          const isSelected = selectedPlanId === planId;
          const badge = t(`subscription.plans.${planId}.badge`, { defaultValue: '' });

          return (
            <button
              key={planId}
              type="button"
              onClick={() => setSelectedPlanId(planId)}
              className="relative flex items-center gap-3.5 rounded-[18px] px-4 py-3.5 text-left transition-colors"
              style={{
                backgroundColor: isSelected ? '#FFFFFF' : '#FBF6F0',
                border: isSelected ? '1.5px solid #5E3566' : '1px solid rgba(94, 53, 102, 0.2)',
              }}
            >
              {badge && (
                <span
                  className="absolute right-3.5 top-[-8px] rounded-full bg-secondary px-2.5 py-0.5 text-[9px] uppercase text-on-secondary"
                  style={{
                    fontFamily: '"Mulish", sans-serif',
                    letterSpacing: '0.1em',
                    fontWeight: 600,
                  }}
                >
                  {badge}
                </span>
              )}

              <span
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[1.5px]"
                style={{ borderColor: isSelected ? '#5E3566' : '#B49FB0' }}
              >
                {isSelected && <span className="h-2.5 w-2.5 rounded-full bg-primary" />}
              </span>

              <span className="flex-1">
                <span className="flex items-baseline gap-2">
                  <span
                    className="text-[18px] text-on-surface"
                    style={{ fontFamily: '"Fraunces", sans-serif', fontWeight: 500 }}
                  >
                    {t(`subscription.plans.${planId}.label`)}
                  </span>
                  <span
                    className="text-[10px] uppercase tracking-[0.08em] text-outline"
                    style={{ fontFamily: '"Mulish", sans-serif' }}
                  >
                    {t(`subscription.plans.${planId}.subLabel`)}
                  </span>
                </span>
                <span
                  className="mt-0.5 block text-[11px]"
                  style={{
                    color: isSelected ? '#5E3566' : '#6E5870',
                    fontFamily: '"Mulish", -apple-system, system-ui, sans-serif',
                  }}
                >
                  {t(`subscription.plans.${planId}.footnote`)}
                </span>
              </span>

              <span
                className="text-[22px]"
                style={{
                  color: isSelected ? '#5E3566' : '#3E2542',
                  fontFamily: '"Fraunces", sans-serif',
                  fontWeight: 500,
                }}
              >
                {t(`subscription.plans.${planId}.price`)}
              </span>
            </button>
          );
        })}
      </section>

      <section className="flex flex-wrap justify-center gap-1.5 px-3 pb-2 pt-4">
        {(
          [
            { key: 'dpdp', label: t('subscription.badges.dpdp'), href: DPDP_ACT_URL },
            { key: 'trial', label: t('subscription.badges.trial', { days: trialDays }) },
            { key: 'consult', label: t('subscription.badges.consult') },
          ] as const
        ).map((badge) => {
          const className =
            'rounded-full border border-border-default bg-surface-container-low px-2.5 py-1 text-[9.5px] uppercase tracking-[0.1em] text-on-surface';
          const style = { fontFamily: '"Mulish", sans-serif' };

          if ('href' in badge && badge.href) {
            return (
              <a
                key={badge.key}
                href={badge.href}
                target="_blank"
                rel="noopener noreferrer"
                className={`${className} no-underline`}
                style={style}
              >
                {badge.label}
              </a>
            );
          }

          return (
            <span key={badge.key} className={className} style={style}>
              {badge.label}
            </span>
          );
        })}
      </section>

      <section className="px-3 pb-[22px] pt-2.5">
        <button
          type="button"
          onClick={() => void handlePrimaryAction()}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-secondary px-2 py-[14px] text-[14px] font-semibold text-on-secondary disabled:opacity-60"
          disabled={isSubmitting}
          style={{
            fontFamily: '"Mulish", -apple-system, system-ui, sans-serif',
            letterSpacing: '-0.005em',
          }}
        >
          {user?.hasActiveAccess
            ? t('subscription.continueCta')
            : isSubmitting
              ? t('subscription.activating')
              : t('subscription.activateCta', { days: trialDays })}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M5 12h14M13 6l6 6-6 6"
              stroke="#3E2542"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <p
          className="mt-2.5 text-center text-[10.5px] leading-[1.5] text-outline"
          style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' }}
        >
          {user?.hasActiveAccess
            ? t('subscription.alreadyActive')
            : t('subscription.activateNote', { days: trialDays })}
        </p>
      </section>
    </main>
  );
}
