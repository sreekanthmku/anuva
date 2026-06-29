import { DPDP_ACT_URL } from '../../../shared/lib/dpdp';

export function TrustStrip() {
  return (
    <div
      className="flex items-center justify-center gap-2 px-5 text-[9.5px] uppercase tracking-[0.12em] text-outline"
      style={{ fontFamily: '"Mulish", sans-serif', fontWeight: 400 }}
    >
      <a
        href={DPDP_ACT_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-inherit no-underline"
      >
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="5" y="10" width="14" height="10" rx="2" stroke="#B49FB0" strokeWidth="2" />
          <path d="M8 10V7a4 4 0 018 0v3" stroke="#B49FB0" strokeWidth="2" />
        </svg>
        DPDP
      </a>
      <span className="opacity-40">·</span>
      <span>Anonymous</span>
      <span className="opacity-40">·</span>
      <span>Encrypted</span>
    </div>
  );
}
