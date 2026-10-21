import { useEffect, useRef, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { PRIVACY_POLICY, TERMS_OF_USE, type LegalDocument } from './termsContent';

const FONT_BODY = '"Mulish", -apple-system, system-ui, sans-serif';

type DocKey = 'terms' | 'privacy';

const DOCUMENTS: Record<DocKey, LegalDocument> = { terms: TERMS_OF_USE, privacy: PRIVACY_POLICY };

/**
 * The Terms of Use and Privacy Policy, readable before she agrees. Two tabs in one dialog, because
 * she is agreeing to both at once. "I agree" ticks the box for her; closing leaves it as it was.
 */
function TermsDialog({
  initial,
  onClose,
  onAgree,
}: {
  initial: DocKey;
  onClose: () => void;
  onAgree: () => void;
}) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<DocKey>(initial);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const doc = DOCUMENTS[tab];

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  // Each document opens at its top.
  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 });
  }, [tab]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="terms-dialog-title"
      style={{ fontFamily: FONT_BODY }}
    >
      <button type="button" aria-label={t('login.terms.close')} className="absolute inset-0 bg-[#3E2542]/60" onClick={onClose} />
      <div className="relative flex max-h-[88dvh] w-full max-w-[440px] flex-col rounded-t-[28px] bg-surface-raised shadow-[0_18px_50px_rgba(94,53,102,0.28)] sm:rounded-[28px]">
        <div className="px-5 pb-3 pt-5">
          <div className="flex rounded-full bg-surface-container p-1">
            {(['terms', 'privacy'] as const).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                aria-pressed={tab === key}
                className={`min-h-10 flex-1 rounded-full text-[13px] font-semibold ${
                  tab === key ? 'bg-surface text-primary shadow-sm' : 'text-on-surface-variant'
                }`}
              >
                {DOCUMENTS[key].title}
              </button>
            ))}
          </div>
          <h2
            id="terms-dialog-title"
            className="mt-4 text-[22px] leading-tight text-on-surface"
            style={{ fontFamily: '"Fraunces", serif', fontWeight: 500 }}
          >
            {doc.title}
          </h2>
          <p className="mt-0.5 text-[11.5px] uppercase tracking-[0.12em] text-tertiary">{doc.updated}</p>
        </div>

        <div ref={bodyRef} className="flex-1 overflow-y-auto px-5 pb-4">
          {doc.sections.map((section) => (
            <section key={section.heading} className="mt-3">
              <h3 className="text-[14px] font-semibold text-on-surface">{section.heading}</h3>
              {section.body.map((paragraph) => (
                <p key={paragraph} className="mt-1.5 text-[13.5px] leading-[1.6] text-on-surface-variant">
                  {paragraph}
                </p>
              ))}
            </section>
          ))}
        </div>

        <div className="flex gap-2 border-t border-border-default px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-full border border-border-default px-5 text-[13.5px] font-semibold text-on-surface-variant"
          >
            {t('login.terms.close')}
          </button>
          <button
            type="button"
            onClick={() => {
              onAgree();
              onClose();
            }}
            className="min-h-11 flex-1 rounded-full bg-secondary px-5 text-[14px] font-semibold text-on-secondary"
          >
            {t('login.terms.agree')}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * The sign-up agreement: an unticked box, the documents one tap away. Nothing is pre-ticked — the
 * account is created only once she has ticked it, and the API refuses a sign-up without it.
 */
export function TermsConsent({ accepted, onChange }: { accepted: boolean; onChange: (accepted: boolean) => void }) {
  const [open, setOpen] = useState<DocKey | null>(null);
  const linkClass = 'font-semibold text-primary underline underline-offset-2';

  return (
    <>
      <label className="mb-4 flex cursor-pointer items-start gap-3" style={{ fontFamily: FONT_BODY }}>
        <input
          type="checkbox"
          checked={accepted}
          onChange={(event) => onChange(event.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0 accent-[#5E3566]"
        />
        <span className="text-[13px] leading-[1.5] text-on-surface-variant">
          <Trans
            i18nKey="login.terms.label"
            components={{
              // Buttons, not links: they open the dialog and must not toggle the checkbox.
              1: (
                <button
                  type="button"
                  className={linkClass}
                  onClick={(event) => {
                    event.preventDefault();
                    setOpen('terms');
                  }}
                />
              ),
              2: (
                <button
                  type="button"
                  className={linkClass}
                  onClick={(event) => {
                    event.preventDefault();
                    setOpen('privacy');
                  }}
                />
              ),
            }}
          />
        </span>
      </label>
      {open ? <TermsDialog initial={open} onClose={() => setOpen(null)} onAgree={() => onChange(true)} /> : null}
    </>
  );
}
