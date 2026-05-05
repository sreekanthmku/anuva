import { TrustStrip } from './TrustStrip';

type AssessmentResultCTAProps = {
  onPrimary: () => void;
};

export function AssessmentResultCTA({ onPrimary }: AssessmentResultCTAProps) {
  return (
    <>
      <div className="mt-3.5 flex flex-col gap-2">
        <button
          type="button"
          onClick={onPrimary}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-secondary px-[22px] py-[14px] text-[14px] font-medium text-inverse-on-surface"
          style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif', letterSpacing: '-0.005em' }}
        >
          See My Full Journey
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M5 12h14M13 6l6 6-6 6" stroke="#322f37" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button
          type="button"
          className="w-full bg-transparent px-[22px] py-3 text-[13px] font-medium text-on-surface-variant"
          style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}
        >
          Email me the result instead
        </button>
      </div>

      <div className="mt-2.5">
        <TrustStrip />
      </div>
    </>
  );
}
