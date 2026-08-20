import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eyebrow } from '../../shared/components/Eyebrow';
import { ApiError, apiFetch, apiUrl } from '../../shared/lib/api';
import { BottomNav } from './components/BottomNav';

/**
 * Your Assessment Report.
 *
 * Mirrors the server's `ReportDocument` shape. Every string below is fixed
 * clinical copy chosen by the backend classifier — this component renders what
 * it is given and never composes medical text of its own, so the copy has
 * exactly one home (`apps/api/src/report14/content/`).
 */
interface RecommendationBlock {
  title: string;
  bullets: string[];
}

interface DocumentOverlay {
  id: string;
  title: string;
  lens: string;
  intro: string;
  recommendations: RecommendationBlock[];
  anuNote: string;
}

interface ReportDocument {
  reportId: string;
  title: string;
  salutation: string;
  stageLabel: string;
  stageContext: string;
  menstrualStatus: string;
  dominantDomain: string;
  trackerFocus: string;
  introduction: string;
  medicalFlags: string[];
  recommendations: RecommendationBlock[];
  anuNote: string;
  overlays: DocumentOverlay[];
  disclaimer: string;
  templateVersion: string;
  generatedOn: string;
}

const MULISH = '"Mulish", -apple-system, system-ui, sans-serif';
const MONO = '"Space Mono", ui-monospace, monospace';

function Card({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-3 rounded-[20px] border border-border-default bg-surface-raised px-5 py-4">
      <p
        className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-tertiary"
        style={{ fontFamily: MULISH }}
      >
        {label}
      </p>
      <p className="text-[14px] leading-relaxed text-on-surface" style={{ fontFamily: MULISH }}>
        {children}
      </p>
    </div>
  );
}

function Recommendations({ blocks }: { blocks: RecommendationBlock[] }) {
  return (
    <>
      {blocks.map((block) => (
        <section key={block.title} className="mb-5">
          <h3
            className="mb-2 text-[14px] font-bold leading-snug text-on-surface"
            style={{ fontFamily: MULISH }}
          >
            {block.title}
          </h3>
          <ul className="space-y-2">
            {block.bullets.map((bullet) => (
              <li key={bullet} className="flex gap-2.5">
                <span
                  className="mt-[0.5em] h-[6px] w-[6px] shrink-0 rounded-full bg-secondary"
                  aria-hidden
                />
                <span
                  className="text-[13.5px] leading-relaxed text-on-surface-variant"
                  style={{ fontFamily: MULISH }}
                >
                  {bullet}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}

export default function AssessmentReportRoute() {
  const navigate = useNavigate();
  const [doc, setDoc] = useState<ReportDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** 409 means she has work to finish, not that something broke. */
  const [needsAssessment, setNeedsAssessment] = useState(false);
  const [opening, setOpening] = useState(false);

  // Blob URLs stay alive until the page unmounts, so the opened tab keeps working.
  const blobUrls = useRef<string[]>([]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const payload = await apiFetch<{ document: ReportDocument }>('/api/report14');
        if (!active) return;
        setDoc(payload.document);
      } catch (err) {
        if (!active) return;
        if (err instanceof ApiError && err.status === 409) {
          setNeedsAssessment(true);
          setError(err.message);
        } else {
          setError(
            err instanceof Error ? err.message : 'Your report could not be loaded right now.',
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(
    () => () => {
      blobUrls.current.forEach((url) => URL.revokeObjectURL(url));
      blobUrls.current = [];
    },
    [],
  );

  /**
   * The PDF is built server-side and lives behind an authenticated route, so it
   * is fetched as a blob and opened from memory rather than linked to directly —
   * a plain link would not carry the session on a cross-origin API host.
   *
   * The server caches by content hash, so a second tap is served from disk.
   */
  const openPdf = useCallback(async () => {
    setOpening(true);
    setError(null);
    try {
      const response = await fetch(apiUrl('/api/report14/pdf'), {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Could not prepare your report for download.');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      blobUrls.current.push(url);
      const opened = window.open(url, '_blank', 'noopener');
      if (!opened) {
        // Pop-up blocked, so hand the browser a download instead of losing the
        // PDF we already fetched.
        const link = document.createElement('a');
        link.href = url;
        link.download = 'anuva-assessment-report.pdf';
        link.click();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open your report.');
    } finally {
      setOpening(false);
    }
  }, []);

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
        <Eyebrow>Your assessment report</Eyebrow>

        {loading && (
          <p className="py-8 text-[14px] text-on-surface-variant" style={{ fontFamily: MULISH }}>
            Preparing your report…
          </p>
        )}

        {!loading && needsAssessment && (
          <div className="rounded-[20px] border border-border-default bg-surface-raised px-5 py-6">
            <h1
              className="mb-2 font-display text-[21px] leading-tight text-on-surface"
            >
              Almost there
            </h1>
            <p
              className="mb-5 text-[14px] leading-relaxed text-on-surface-variant"
              style={{ fontFamily: MULISH }}
            >
              {error}
            </p>
            <button
              type="button"
              onClick={() => navigate('/detailed-assessment')}
              className="w-full rounded-full bg-primary px-4 py-3.5 text-[14px] font-semibold text-on-primary"
              style={{ fontFamily: MULISH, minHeight: 44 }}
            >
              Continue my assessment
            </button>
          </div>
        )}

        {!loading && !needsAssessment && !doc && (
          <div className="rounded-[20px] border border-border-default bg-surface-raised px-5 py-6">
            <p
              className="text-[14px] leading-relaxed text-on-surface-variant"
              style={{ fontFamily: MULISH }}
            >
              {error ?? 'Your report could not be loaded right now.'}
            </p>
          </div>
        )}

        {doc && (
          <>
            <h1 className="font-display text-[26px] leading-tight text-on-surface">{doc.title}</h1>
            <p
              className="mt-1 text-[12.5px] uppercase tracking-[0.08em] text-outline"
              style={{ fontFamily: MONO }}
            >
              {doc.generatedOn}
            </p>

            <button
              type="button"
              onClick={() => void openPdf()}
              disabled={opening}
              className="mt-5 w-full rounded-full bg-primary px-4 py-3.5 text-[14px] font-semibold text-on-primary disabled:opacity-60"
              style={{ fontFamily: MULISH, minHeight: 44 }}
            >
              {opening ? 'Preparing your PDF…' : 'Download as PDF'}
            </button>
            <p
              className="mt-2 text-center text-[11.5px] text-on-surface-variant"
              style={{ fontFamily: MULISH }}
            >
              A print-ready PDF you can save or share with your doctor.
            </p>

            {error && (
              <p
                className="mt-3 rounded-2xl border border-border-default bg-surface-raised px-4 py-3 text-[13px] text-on-surface-variant"
                style={{ fontFamily: MULISH }}
              >
                {error}
              </p>
            )}

            <p
              className="mt-7 font-display text-[18px] text-primary"
            >
              {doc.salutation}
            </p>
            <p
              className="mt-2 text-[14px] leading-relaxed text-on-surface"
              style={{ fontFamily: MULISH }}
            >
              {doc.introduction}
            </p>

            <div className="mt-6">
              <Card label="Your menstrual status">{doc.menstrualStatus}</Card>
              <Card label="Dominant symptom domain">{doc.dominantDomain}</Card>
            </div>

            <h2 className="mb-3 mt-7 font-display text-[19px] leading-snug text-primary">
              Medical flags to raise with your doctor
            </h2>
            <ul className="space-y-2">
              {doc.medicalFlags.map((flag) => (
                <li key={flag} className="flex gap-2.5">
                  <span
                    className="mt-[0.5em] h-[6px] w-[6px] shrink-0 rounded-full bg-secondary"
                    aria-hidden
                  />
                  <span
                    className="text-[13.5px] leading-relaxed text-on-surface-variant"
                    style={{ fontFamily: MULISH }}
                  >
                    {flag}
                  </span>
                </li>
              ))}
            </ul>

            <h2 className="mb-4 mt-7 font-display text-[19px] leading-snug text-primary">
              Your recommendations
            </h2>
            <Recommendations blocks={doc.recommendations} />

            <Card label="What ANU will track with you">{doc.trackerFocus}</Card>

            <aside
              className="mt-5 rounded-[20px] px-5 py-4"
              style={{
                background: 'rgba(201, 126, 146, 0.10)',
                border: '1px solid rgba(201, 126, 146, 0.32)',
              }}
            >
              <p
                className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-primary"
                style={{ fontFamily: MULISH }}
              >
                From ANU
              </p>
              <p
                className="text-[13.5px] leading-relaxed text-on-surface"
                style={{ fontFamily: MULISH }}
              >
                {doc.anuNote}
              </p>
            </aside>

            {doc.overlays.map((overlay) => (
              <section
                key={overlay.id}
                className="mt-8 border-t border-border-default pt-6"
              >
                <Eyebrow tone="gold">Additional focus</Eyebrow>
                <h2 className="mb-3 font-display text-[19px] leading-snug text-primary">
                  {overlay.title}
                </h2>
                <div className="mb-4 rounded-[20px] border border-border-default bg-surface-raised px-5 py-4">
                  <p
                    className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-tertiary"
                    style={{ fontFamily: MULISH }}
                  >
                    {overlay.lens}
                  </p>
                  <p
                    className="text-[13.5px] leading-relaxed text-on-surface"
                    style={{ fontFamily: MULISH }}
                  >
                    {overlay.intro}
                  </p>
                </div>
                <Recommendations blocks={overlay.recommendations} />
                <aside
                  className="rounded-[20px] px-5 py-4"
                  style={{
                    background: 'rgba(201, 126, 146, 0.10)',
                    border: '1px solid rgba(201, 126, 146, 0.32)',
                  }}
                >
                  <p
                    className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-primary"
                    style={{ fontFamily: MULISH }}
                  >
                    From ANU
                  </p>
                  <p
                    className="text-[13.5px] leading-relaxed text-on-surface"
                    style={{ fontFamily: MULISH }}
                  >
                    {overlay.anuNote}
                  </p>
                </aside>
              </section>
            ))}

            <p
              className="mt-8 border-t border-border-default pt-4 text-[11.5px] leading-relaxed text-on-surface-variant"
              style={{ fontFamily: MULISH }}
            >
              {doc.disclaimer}
            </p>
          </>
        )}
      </section>

      <BottomNav />
    </main>
  );
}
