import { useState } from 'react';
import { useTranslation } from 'react-i18next';

const mulish = { fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' };

function SharedList({ items }: { items: string[] }) {
  return (
    <ul className="mt-1.5 flex list-disc flex-col gap-1 pl-4">
      {items.map((item) => (
        <li key={item} className="text-[12px] leading-[1.5] text-on-surface-variant" style={mulish}>
          {item}
        </li>
      ))}
    </ul>
  );
}

/**
 * The minimum every family member sees, as a required agreement on her pending link. The list is
 * the server's (`sharedByDefault`), so what she ticks is exactly what the family app shows and the
 * digest is held to. The box ticks only once the server has saved it, like `ConsentSwitch`, and the
 * caller keeps the link's share buttons disabled until it is ticked.
 */
export function CoreSharingConsent({
  items,
  agreed,
  onChange,
}: {
  items: string[];
  agreed: boolean;
  onChange: (agreed: boolean) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = async () => {
    setBusy(true);
    setError(null);
    try {
      await onChange(!agreed);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('family.core.failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-4 rounded-[16px] border border-border-default bg-surface px-3.5 py-3">
      <p className="text-[13px] font-semibold text-on-surface" style={mulish}>
        {t('family.core.title')}
      </p>
      <SharedList items={items} />
      <label className="mt-2.5 flex min-h-11 cursor-pointer items-center gap-3">
        <input
          type="checkbox"
          checked={agreed}
          disabled={busy}
          onChange={() => void toggle()}
          aria-describedby="family-core-required"
          className="h-5 w-5 shrink-0 accent-[#5E3566]"
        />
        <span className="text-[12.5px] font-semibold leading-[1.45] text-on-surface" style={mulish}>
          {t('family.core.agree')}
        </span>
      </label>
      <p id="family-core-required" className="mt-0.5 text-[11.5px] leading-[1.5] text-outline" style={mulish}>
        {t('family.core.required')}
      </p>
      {error ? (
        <p className="mt-1.5 text-[11.5px] text-error" style={mulish} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** The same list for people already connected: always shared, ended only by disconnecting them. */
export function CoreSharingSummary({ items }: { items: string[] }) {
  const { t } = useTranslation();
  return (
    <div className="mt-2 rounded-[14px] bg-surface px-3.5 py-3">
      <p className="text-[12.5px] font-semibold text-on-surface" style={mulish}>
        {t('family.core.alwaysTitle')}
      </p>
      <SharedList items={items} />
      <p className="mt-1.5 text-[11.5px] leading-[1.5] text-outline" style={mulish}>
        {t('family.core.minimumNote')}
      </p>
    </div>
  );
}
