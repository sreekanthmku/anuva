import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LANGUAGES, languageFor, type LanguageCode } from './languages';
import { TRANSLATED_LANGUAGES } from './index';

/** A globe, drawn rather than imported, so the toggle costs nothing beyond this file. */
function GlobeIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3c2.4 2.6 3.6 5.6 3.6 9s-1.2 6.4-3.6 9c-2.4-2.6-3.6-5.6-3.6-9s1.2-6.4 3.6-9Z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden
    >
      <path d="m5 12.5 4.5 4.5L19 7" />
    </svg>
  );
}

type LanguageToggleProps = {
  className?: string;
  /**
   * `pill` carries the current language's name — for headers with room. `compact` is the globe
   * alone, for a cramped top bar where the name would crowd the title next to it.
   */
  variant?: 'pill' | 'compact';
};

/**
 * The language switch. One control, always in the top bar, because someone who cannot read the
 * screen cannot be asked to navigate to a settings page to fix that.
 *
 * Languages without a bundle on disk are listed but not selectable: seeing your language named and
 * marked as coming is a different message from not finding it at all.
 */
export function LanguageToggle({ className = '', variant = 'pill' }: LanguageToggleProps) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const current = languageFor(i18n.resolvedLanguage ?? i18n.language);

  // A tap anywhere else closes the menu — on a phone there is no `Escape` key to lean on.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const choose = (code: LanguageCode) => {
    setOpen(false);
    if (code !== i18n.language) void i18n.changeLanguage(code);
  };

  return (
    <div ref={containerRef} className={`relative shrink-0 ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t('language.switchTo', { language: current.englishName })}
        className={`press flex min-h-[44px] items-center justify-center gap-1.5 rounded-full border border-primary/15 bg-surface-raised text-primary shadow-soft ${
          variant === 'compact' ? 'w-11' : 'px-3.5'
        }`}
      >
        <GlobeIcon className="h-[18px] w-[18px]" />
        {variant === 'pill' ? (
          <span className="max-w-[92px] truncate text-[13px] font-semibold leading-none">
            {current.nativeName}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="listbox"
          aria-label={t('language.label')}
          className="absolute right-0 top-[calc(100%+8px)] z-50 max-h-[min(70vh,26rem)] w-[15rem] overflow-y-auto overscroll-contain rounded-[20px] border border-border-default bg-surface-raised p-1.5 shadow-lift"
        >
          <p className="px-3 pb-1.5 pt-2 text-[10.5px] font-bold uppercase tracking-[0.16em] text-tertiary">
            {t('language.label')}
          </p>
          {LANGUAGES.map((language) => {
            const selected = language.code === current.code;
            const available = TRANSLATED_LANGUAGES.includes(language.code);
            return (
              <button
                key={language.code}
                type="button"
                role="option"
                aria-selected={selected}
                disabled={!available}
                onClick={() => choose(language.code)}
                className={`flex min-h-[44px] w-full items-center gap-2 rounded-[14px] px-3 text-left transition-colors ${
                  selected ? 'bg-primary-fixed text-primary' : 'text-on-surface'
                } ${available ? 'press hover:bg-surface-container' : 'cursor-not-allowed opacity-45'}`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14.5px] font-semibold leading-tight">
                    {language.nativeName}
                  </span>
                  {language.nativeName === language.englishName ? null : (
                    <span className="block truncate text-[11.5px] leading-tight text-on-surface-variant">
                      {language.englishName}
                    </span>
                  )}
                </span>
                {selected ? <CheckIcon /> : null}
                {!available && !selected ? (
                  <span className="shrink-0 rounded-full bg-surface-container px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-outline">
                    {t('language.comingSoon')}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
