import { useState } from 'react';

const mulish = { fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' };

/**
 * One thing she may choose to share with one person, with its notice right under the switch,
 * always visible, so turning it on is agreeing to exactly what it says. The caller sends that
 * notice's consent version with it. Turning it off needs no wording.
 *
 * The switch moves only once the server has saved the choice, so it never shows a state that is
 * not in force.
 */
export function ConsentSwitch({
  enabled,
  onChange,
  label,
  notice,
  failedText,
}: {
  enabled: boolean;
  onChange: (enabled: boolean) => Promise<void>;
  label: string;
  notice: string;
  failedText: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = async () => {
    setBusy(true);
    setError(null);
    try {
      await onChange(!enabled);
    } catch (e) {
      setError(e instanceof Error ? e.message : failedText);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 rounded-[16px] border border-border-default bg-surface px-3.5 py-3">
      <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3">
        <span className="text-[13px] font-semibold text-on-surface" style={mulish}>
          {label}
        </span>
        <span className="relative inline-flex shrink-0 items-center">
          <input
            type="checkbox"
            role="switch"
            checked={enabled}
            disabled={busy}
            onChange={() => void toggle()}
            className="peer sr-only"
          />
          <span className="h-7 w-12 rounded-full bg-outline/40 transition-colors peer-checked:bg-primary peer-disabled:opacity-60" />
          <span className="pointer-events-none absolute left-1 h-5 w-5 rounded-full bg-surface shadow transition-transform peer-checked:translate-x-5" />
        </span>
      </label>
      <p className="mt-1 text-[12px] leading-[1.5] text-on-surface-variant" style={mulish}>
        {notice}
      </p>
      {error ? (
        <p className="mt-1.5 text-[11.5px] text-error" style={mulish} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
