import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AnuV3SummaryOffer } from '@anuva/shared';
import { VisitSummarySheet } from '../visitSummary/VisitSummarySheet';
import { declineSummaryOffer } from './api';

const FONT_BODY = '"Mulish", -apple-system, system-ui, sans-serif';

/**
 * Under ANU's booking confirmation: would she like a summary of her logs put together for this
 * doctor? The app adds it to every confirmed booking — ANU neither chooses nor writes it. "Yes"
 * opens the summary for her to read and edit; nothing is shared until she agrees in there.
 */
export function SummaryOfferCard({ offer, turnId }: { offer: AnuV3SummaryOffer; turnId: string | null }) {
  const { t } = useTranslation();
  const [state, setState] = useState(offer.state);
  const [open, setOpen] = useState(false);

  const decline = () => {
    setState('declined');
    // Only remembers the dismissal across reloads; the card is gone either way.
    if (turnId) void declineSummaryOffer({ turnId }).catch(() => undefined);
  };

  const sheet = open ? (
    <VisitSummarySheet
      consultationId={offer.consultationId}
      specialistName={offer.specialistName}
      onClose={() => setOpen(false)}
      onShared={(shared) => setState(shared ? 'shared' : 'open')}
    />
  ) : null;

  if (state === 'shared') {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="min-h-11 rounded-full border border-primary/30 bg-surface px-4 py-2 text-[13px] font-semibold text-primary"
          style={{ fontFamily: FONT_BODY }}
        >
          ✓ {t('visitSummary.offer.shared', { name: offer.specialistName })} →
        </button>
        {sheet}
      </>
    );
  }

  if (state === 'declined') {
    return (
      <p className="px-1 text-[12px] text-on-surface-variant" style={{ fontFamily: FONT_BODY }}>
        {t('visitSummary.offer.declined')}
      </p>
    );
  }

  return (
    <>
      <div
        className="flex w-full flex-col gap-2 rounded-[18px] border border-primary/25 bg-surface p-3.5"
        style={{ fontFamily: FONT_BODY }}
      >
        <p className="text-[13.5px] font-semibold text-on-surface">
          {t('visitSummary.offer.title', { name: offer.specialistName })}
        </p>
        <p className="text-[12.5px] leading-[1.5] text-on-surface-variant">
          {t('visitSummary.offer.body', { name: offer.specialistName })}
        </p>
        <div className="mt-1 flex gap-2">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="min-h-11 flex-1 rounded-full bg-secondary px-4 text-[13px] font-semibold text-on-secondary"
          >
            {t('visitSummary.offer.yes')}
          </button>
          <button
            type="button"
            onClick={decline}
            className="min-h-11 rounded-full border border-border-default px-4 text-[13px] text-on-surface"
          >
            {t('visitSummary.offer.no')}
          </button>
        </div>
      </div>
      {sheet}
    </>
  );
}
