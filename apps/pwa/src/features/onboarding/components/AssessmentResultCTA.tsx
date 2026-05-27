import { TrustStrip } from './TrustStrip';

type AssessmentResultCTAProps = {
  onPrimary: () => void;
  isSubmitting?: boolean;
};

export function AssessmentResultCTA({ onPrimary, isSubmitting = false }: AssessmentResultCTAProps) {
  return (
    <>
      <div className="mt-3.5 flex flex-col gap-2">
        <button
          type="button"
          onClick={onPrimary}
          disabled={isSubmitting}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-secondary px-[22px] py-[14px] text-[14px] font-medium text-inverse-on-surface disabled:opacity-60"
          style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif', letterSpacing: '-0.005em' }}
        >
          {isSubmitting ? 'Starting your trial...' : 'Start Your 14-Day Free Trial'}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M5 12h14M13 6l6 6-6 6" stroke="#322f37" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <div className="mt-2.5">
        <TrustStrip />
      </div>
    </>
  );
}
