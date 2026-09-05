import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ERASURE_SCOPES,
  erasureScopeLabel,
  type DataErasureScope,
  type PrivacySummaryResponse,
} from '@anuva/shared';
import { DPDP_ACT_URL, GRIEVANCE_OFFICER_EMAIL } from '../../shared/lib/dpdp';
import { Eyebrow } from '../../shared/components/Eyebrow';
import { ApiError } from '../../shared/lib/api';
import { BottomNav } from './components/BottomNav';
import { ConfirmSheet, type ConfirmResult } from './privacy/ConfirmSheet';
import {
  cancelDeletionRequest,
  createDataExport,
  createDeletionRequest,
  downloadDataExport,
  fetchPrivacySummary,
} from './privacy/api';

const MULISH = '"Mulish", -apple-system, system-ui, sans-serif';

/** Which category count belongs on which delete row. */
const SCOPE_CATEGORY: Record<Exclude<DataErasureScope, 'account'>, string> = {
  recordings: 'recordings',
  chat: 'chat',
  tracker: 'tracker',
};

type Sheet =
  | { kind: 'scope'; scope: DataErasureScope }
  | { kind: 'export' }
  | { kind: 'cancel'; id: string }
  | null;

function formatDate(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '';
  return at.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function totalDeleted(counts: Record<string, number> | null): number {
  if (!counts) return 0;
  return Object.values(counts).reduce((sum, value) => sum + value, 0);
}

function SectionCard({ children }: { children: ReactNode }) {
  return (
    <article className="overflow-hidden rounded-[20px] border border-border-default bg-surface-raised">
      {children}
    </article>
  );
}

/**
 * Privacy & data — the DPDP rights screen.
 *
 * Two rules shape the layout. Counts come before controls: a delete button with no number beside it
 * asks her to guess what she is about to lose. And the options run least to most destructive, with
 * "Delete my account" last but never hidden — under DPDP the full right has to be as easy to
 * exercise as the partial ones, so it is a plain row on the same screen, not something to hunt for.
 */
export default function PrivacyRoute() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<PrivacySummaryResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setSummary(await fetchPrivacySummary());
      setLoadError(null);
    } catch (e) {
      setLoadError(
        e instanceof ApiError ? e.message : 'Could not load your data. Please try again.',
      );
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const countFor = useMemo(() => {
    const byKey = new Map((summary?.categories ?? []).map((entry) => [entry.key, entry.count]));
    return (key: string) => byKey.get(key) ?? 0;
  }, [summary]);

  const pending = summary?.pendingDeletion ?? null;
  const exportBlockedUntil = summary?.exportAvailableAt ?? null;

  async function confirmScope(scope: DataErasureScope, result: ConfirmResult) {
    const response = await createDeletionRequest({
      scope,
      ...(result ? { challengeId: result.challengeId, otp: result.otp } : {}),
    });

    setSheet(null);
    await load();

    if (response.accountScheduled) {
      setNotice(
        `Your account is scheduled for deletion on ${formatDate(response.request.scheduledFor)}. You can cancel any time before then.`,
      );
      return;
    }

    const deleted = totalDeleted(response.request.itemCounts);
    setNotice(
      deleted > 0
        ? `Deleted ${deleted} ${deleted === 1 ? 'item' : 'items'}. ${erasureScopeLabel(scope)}: done.`
        : 'There was nothing left to delete in that category.',
    );
  }

  async function confirmExport(result: ConfirmResult) {
    if (!result) return;

    const response = await createDataExport({
      challengeId: result.challengeId,
      otp: result.otp,
    });

    setSheet(null);

    // Downloaded straight away rather than parked behind a link: it is a single-use URL with a
    // 24-hour life, and the moment she has authorised it is the moment she wants the file.
    await downloadDataExport(
      response.downloadUrl,
      `anuva-data-export-${new Date().toISOString().slice(0, 10)}.json`,
    );

    await load();
    setNotice('Your data has been downloaded. The link has now been used and cannot be reopened.');
  }

  async function confirmCancel(id: string) {
    await cancelDeletionRequest(id);
    setSheet(null);
    await load();
    setNotice('Your account will not be deleted. Nothing has been removed.');
  }

  const activeScope = sheet?.kind === 'scope' ? sheet.scope : null;
  const activeScopeCopy = activeScope
    ? ERASURE_SCOPES.find((entry) => entry.id === activeScope)
    : null;

  return (
    <main className="h-[100dvh] min-h-mobile overflow-x-hidden overflow-y-auto bg-surface pb-28 text-on-surface">
      <header className="sticky top-0 z-30 bg-surface px-3 pb-4 pt-[max(0.875rem,env(safe-area-inset-top))]">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate('/profile')}
            className="bg-transparent p-0 text-[13px] text-on-surface-variant"
            style={{ fontFamily: MULISH }}
          >
            ← Profile
          </button>
          <img src="/anu.png" alt="Anuva" className="h-5 w-5 object-contain opacity-80" />
        </div>
      </header>

      <section className="px-3 pb-6 pt-2">
        <Eyebrow>Privacy &amp; data</Eyebrow>
        <h1 className="mb-2 font-display text-[24px] leading-tight text-on-surface">
          Your data is yours
        </h1>
        <p
          className="mb-6 text-[13px] leading-[1.6] text-on-surface-variant"
          style={{ fontFamily: MULISH }}
        >
          Under the{' '}
          <a href={DPDP_ACT_URL} target="_blank" rel="noopener noreferrer" className="text-primary">
            Digital Personal Data Protection Act
          </a>
          , you can see what we hold, take a copy of it, and have it deleted. Everything below acts
          on your account right away — we do not need to be asked twice.
        </p>

        {notice ? (
          <div
            className="mb-5 rounded-[18px] border border-primary/25 bg-primary-container/50 px-4 py-3.5"
            role="status"
          >
            <p className="text-[13px] leading-[1.55] text-on-surface" style={{ fontFamily: MULISH }}>
              {notice}
            </p>
            <button
              type="button"
              onClick={() => setNotice(null)}
              className="mt-1.5 bg-transparent p-0 text-[11.5px] text-primary"
              style={{ fontFamily: MULISH }}
            >
              Dismiss
            </button>
          </div>
        ) : null}

        {loadError ? (
          <div className="mb-5 rounded-[18px] border border-border-default bg-surface-raised px-4 py-3.5">
            <p className="text-[13px] text-on-surface" style={{ fontFamily: MULISH }}>
              {loadError}
            </p>
            <button
              type="button"
              onClick={() => void load()}
              className="mt-1.5 bg-transparent p-0 text-[12px] text-primary"
              style={{ fontFamily: MULISH }}
            >
              Try again
            </button>
          </div>
        ) : null}

        {pending ? (
          <div
            className="mb-6 rounded-[20px] px-4 py-4"
            style={{ backgroundColor: 'rgba(201, 126, 146, 0.16)', border: '1px solid rgba(201, 126, 146, 0.4)' }}
          >
            <p
              className="text-[14px] leading-[1.5] text-on-surface"
              style={{ fontFamily: '"Fraunces", sans-serif', fontWeight: 500 }}
            >
              Your account is scheduled for deletion
            </p>
            <p
              className="mt-1 text-[12.5px] leading-[1.55] text-on-surface-variant"
              style={{ fontFamily: MULISH }}
            >
              It will be deleted on {formatDate(pending.scheduledFor)}. Until then nothing has been
              removed, and you can stop it.
            </p>
            <button
              type="button"
              onClick={() => setSheet({ kind: 'cancel', id: pending.id })}
              className="mt-3 min-h-[44px] w-full rounded-full px-4 text-[14px] text-white"
              style={{ fontFamily: MULISH, fontWeight: 600, backgroundColor: '#5E3566' }}
            >
              Cancel deletion
            </button>
          </div>
        ) : null}

        {/* ── What we hold ─────────────────────────── */}
        <Eyebrow>What Anuva holds</Eyebrow>
        <SectionCard>
          <ul className="divide-y divide-border-default">
            {(summary?.categories ?? []).map((category) => (
              <li key={category.key} className="px-5 py-3.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[14.5px] text-on-surface" style={{ fontFamily: MULISH }}>
                    {category.label}
                  </span>
                  <span
                    className="shrink-0 text-[14px] text-primary"
                    style={{ fontFamily: '"Space Mono", monospace' }}
                  >
                    {category.count}
                  </span>
                </div>
                <p
                  className="mt-0.5 text-[11.5px] leading-[1.5] text-on-surface-variant"
                  style={{ fontFamily: MULISH }}
                >
                  {category.purpose}
                </p>
                {category.retention ? (
                  <p className="mt-1 text-[11px] leading-[1.45] text-outline" style={{ fontFamily: MULISH }}>
                    {category.retention}
                  </p>
                ) : null}
              </li>
            ))}
            {!summary && !loadError ? (
              <li className="px-5 py-4 text-[13px] text-on-surface-variant" style={{ fontFamily: MULISH }}>
                Counting…
              </li>
            ) : null}
          </ul>
        </SectionCard>
        <p className="mt-2 px-1 text-[11px] leading-[1.5] text-outline" style={{ fontFamily: MULISH }}>
          We do not sell your data and there are no advertising trackers in this app. The full list of
          services that process it is included in your data download.
        </p>

        {/* ── Export ───────────────────────────────── */}
        <div className="mt-7">
          <Eyebrow>Take a copy</Eyebrow>
          <SectionCard>
            <div className="px-5 py-4">
              <p
                className="text-[15px] text-on-surface"
                style={{ fontFamily: '"Fraunces", sans-serif', fontWeight: 500 }}
              >
                Download your data
              </p>
              <p
                className="mt-1 text-[12.5px] leading-[1.55] text-on-surface-variant"
                style={{ fontFamily: MULISH }}
              >
                One file with everything above — useful if you want to show your own doctor what you
                have been tracking. Recordings and prescription files are not in it; download those
                from Your consultations.
              </p>

              {summary?.latestExport ? (
                <p className="mt-2 text-[11px] text-outline" style={{ fontFamily: MULISH }}>
                  Last requested {formatDate(summary.latestExport.createdAt)}
                  {summary.latestExport.sizeBytes
                    ? ` · ${formatBytes(summary.latestExport.sizeBytes)}`
                    : ''}
                </p>
              ) : null}

              <button
                type="button"
                onClick={() => setSheet({ kind: 'export' })}
                disabled={Boolean(exportBlockedUntil)}
                className="mt-3 min-h-[48px] w-full rounded-full px-5 text-[15px] text-white disabled:opacity-40"
                style={{ fontFamily: MULISH, fontWeight: 600, backgroundColor: '#5E3566' }}
              >
                Download my data
              </button>

              {exportBlockedUntil ? (
                <p className="mt-2 text-[11px] text-outline" style={{ fontFamily: MULISH }}>
                  You can ask for another copy after {formatDate(exportBlockedUntil)}.
                </p>
              ) : null}
            </div>
          </SectionCard>
        </div>

        {/* ── Delete ───────────────────────────────── */}
        <div className="mt-7">
          <Eyebrow>Delete your data</Eyebrow>
          <SectionCard>
            <ul className="divide-y divide-border-default">
              {ERASURE_SCOPES.map((scope) => {
                const count =
                  scope.id === 'account'
                    ? null
                    : countFor(SCOPE_CATEGORY[scope.id as keyof typeof SCOPE_CATEGORY]);
                const isAccount = scope.id === 'account';
                const disabled = Boolean(pending) || (count !== null && count === 0);

                return (
                  <li key={scope.id}>
                    <button
                      type="button"
                      onClick={() => setSheet({ kind: 'scope', scope: scope.id })}
                      disabled={disabled}
                      className="flex w-full flex-col items-start gap-1 px-5 py-4 text-left transition-colors hover:bg-primary-container/40 disabled:opacity-45"
                    >
                      <span className="flex w-full items-baseline justify-between gap-3">
                        <span
                          className="text-[15px]"
                          style={{ fontFamily: MULISH, color: isAccount ? '#B0566F' : undefined }}
                        >
                          {scope.label}
                        </span>
                        {count !== null ? (
                          <span
                            className="shrink-0 text-[13px] text-outline"
                            style={{ fontFamily: '"Space Mono", monospace' }}
                          >
                            {count}
                          </span>
                        ) : null}
                      </span>
                      <span
                        className="text-[12px] leading-[1.5] text-on-surface-variant"
                        style={{ fontFamily: MULISH }}
                      >
                        {scope.description}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </SectionCard>
          <p className="mt-2 px-1 text-[11px] leading-[1.5] text-outline" style={{ fontFamily: MULISH }}>
            Account deletion waits {summary?.graceDays ?? 7} days so you can change your mind, and
            finishes within {summary?.slaDays ?? 30} days of your request.
          </p>
        </div>

        {/* ── History ──────────────────────────────── */}
        {summary?.history.length ? (
          <div className="mt-7">
            <Eyebrow>Your requests</Eyebrow>
            <SectionCard>
              <ul className="divide-y divide-border-default">
                {summary.history.map((request) => (
                  <li key={request.id} className="flex items-baseline justify-between gap-3 px-5 py-3">
                    <span className="text-[13.5px] text-on-surface" style={{ fontFamily: MULISH }}>
                      {erasureScopeLabel(request.scope)}
                      {request.itemCounts
                        ? ` · ${totalDeleted(request.itemCounts)} items`
                        : ''}
                    </span>
                    <span className="shrink-0 text-[11px] text-outline" style={{ fontFamily: MULISH }}>
                      {request.status === 'cancelled' ? 'Cancelled' : 'Done'} ·{' '}
                      {formatDate(request.completedAt ?? request.requestedAt)}
                    </span>
                  </li>
                ))}
              </ul>
            </SectionCard>
          </div>
        ) : null}

        {/* ── Grievance ────────────────────────────── */}
        <div className="mt-7">
          <Eyebrow>If something is wrong</Eyebrow>
          <SectionCard>
            <div className="px-5 py-4">
              <p
                className="text-[12.5px] leading-[1.6] text-on-surface-variant"
                style={{ fontFamily: MULISH }}
              >
                Write to our Grievance Officer at{' '}
                <a href={`mailto:${GRIEVANCE_OFFICER_EMAIL}`} className="text-primary">
                  {GRIEVANCE_OFFICER_EMAIL}
                </a>
                . If we do not resolve it, you can escalate to the Data Protection Board of India.
              </p>
              <button
                type="button"
                onClick={() => navigate('/help')}
                className="mt-3 min-h-[44px] w-full rounded-full border border-border-default bg-transparent px-4 text-[14px] text-on-surface-variant"
                style={{ fontFamily: MULISH }}
              >
                Ask us in the app instead
              </button>
            </div>
          </SectionCard>
        </div>
      </section>

      {/* ── Confirmations ──────────────────────────── */}
      <ConfirmSheet
        open={Boolean(activeScopeCopy)}
        title={activeScopeCopy?.label ?? ''}
        confirmLabel={activeScope === 'account' ? 'Delete my account' : 'Delete permanently'}
        destructive
        otpIntent={activeScopeCopy?.requiresOtp ? 'account_deletion' : undefined}
        onClose={() => setSheet(null)}
        onConfirm={(result) => confirmScope(activeScope as DataErasureScope, result)}
      >
        <p>{activeScopeCopy?.description}</p>
        <p className="rounded-[14px] bg-surface px-3.5 py-2.5 text-[12.5px] leading-[1.55]">
          <strong className="font-semibold text-on-surface">What is kept: </strong>
          {activeScopeCopy?.collateral}
        </p>
        {activeScope === 'account' ? (
          <p>
            This cannot be undone once it runs. You have {summary?.graceDays ?? 7} days to change
            your mind, and you will stay signed in until then.
          </p>
        ) : (
          <p>This cannot be undone.</p>
        )}
      </ConfirmSheet>

      <ConfirmSheet
        open={sheet?.kind === 'export'}
        title="Download your data"
        confirmLabel="Download"
        otpIntent="data_export"
        onClose={() => setSheet(null)}
        onConfirm={confirmExport}
      >
        <p>
          We will build one file containing everything Anuva holds about you and download it to this
          device.
        </p>
        <p className="rounded-[14px] bg-surface px-3.5 py-2.5 text-[12.5px] leading-[1.55]">
          The link works once and expires in 24 hours. Keep the file somewhere safe — it is your full
          health history, and once it is on your device it is out of our hands.
        </p>
      </ConfirmSheet>

      <ConfirmSheet
        open={sheet?.kind === 'cancel'}
        title="Cancel deletion"
        confirmLabel="Keep my account"
        dismissLabel="Go back"
        onClose={() => setSheet(null)}
        onConfirm={() => confirmCancel(sheet?.kind === 'cancel' ? sheet.id : '')}
      >
        <p>
          Your account stays exactly as it is and nothing will be deleted. You can ask again at any
          time.
        </p>
      </ConfirmSheet>

      <BottomNav />
    </main>
  );
}
