import { applyAppUpdate, dismissAppUpdate, useAppUpdateOffered } from './appUpdate';

/**
 * "A new version is ready" — shown only when a new deploy has downloaded while the person is in the
 * middle of something (see appUpdate.ts). Otherwise the app just reloads onto it.
 *
 * Small, at the top (clear of the bottom nav and the beta reporter tab), and dismissible: "not now"
 * hides it until the app next comes back on screen.
 */
export function AppUpdateBar() {
  const offered = useAppUpdateOffered();
  if (!offered) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[70] flex justify-center px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
      <div
        role="status"
        className="pointer-events-auto flex items-center gap-1 rounded-full border border-secondary/30 bg-surface-raised/95 py-1 pl-4 pr-1 text-[13px] text-on-surface shadow-[0_8px_20px_rgba(94,53,102,0.18)] backdrop-blur"
      >
        <span className="mr-1">A new version is ready.</span>
        <button
          type="button"
          onClick={applyAppUpdate}
          className="min-h-[44px] rounded-full bg-primary px-4 text-[13px] font-semibold text-on-primary"
        >
          Update
        </button>
        <button
          type="button"
          onClick={dismissAppUpdate}
          aria-label="Not now"
          className="flex h-11 w-11 items-center justify-center rounded-full text-[18px] leading-none text-on-surface/60"
        >
          ×
        </button>
      </div>
    </div>
  );
}
