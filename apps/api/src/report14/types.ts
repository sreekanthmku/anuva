/** 14-Day Assessment Report — shared types. Local to the module by design. */

import type { LogBlendMode, WindowAnchorMode } from './config.js';

export type Stage = 1 | 2 | 3;
export type Domain = 'A' | 'B' | 'C' | 'D';
/** Domains that carry a symptom score. D is a selection outcome, not a scale. */
export type ScoredDomain = 'A' | 'B' | 'C';
export type OverlayId = 'GUT' | 'FAMILY';

export type ReportId =
  | '1A' | '1B' | '1C' | '1D'
  | '2A' | '2B' | '2C' | '2D'
  | '3A' | '3B' | '3C' | '3D';

/**
 * Non-fatal observations about a classification. Every one of these means the
 * user still got a report — they record *why* the classifier had to reach for a
 * fallback, so a systematic problem surfaces in our data rather than in someone's
 * document.
 */
export type ReportFlag =
  | 'surgicalMenopause'
  | 'cannotStageByBleeding'
  | 'beyondTemplateRange'
  | 'stageAmbiguous'
  | 'bleedVetoApplied'
  | 'regularSkipConflict'
  | 'contraceptionMayMaskCycle'
  | 'lowSymptomBurden'
  | 'noLogsAvailable'
  | 'trackingDataDisabled';

/** One `None | Mild | Moderate | Severe` answer, scored 0..3. */
export type SeverityScore = 0 | 1 | 2 | 3;

export interface StageResult {
  stage: Stage;
  /** Which rule in the decision table matched — S1..S7. */
  rule: string;
  reason: string;
  flags: ReportFlag[];
}

export interface DomainScores {
  /** Sum of severity answers for the domain. */
  raw: number;
  /** Number of items that were actually answered. */
  answered: number;
  /** Maximum possible raw score for the items that exist. */
  max: number;
  /** raw / max, 0..1. */
  burden: number;
  /** burden / severeFraction — comparable across domains. */
  index: number;
}

export interface LogDomainScores {
  index: number;
  daysCovered: number;
  signals: number;
}

export interface DomainResult {
  domain: Domain;
  reason: string;
  assessment: Record<ScoredDomain, DomainScores>;
  logs: Partial<Record<ScoredDomain, LogDomainScores>>;
  /** Post-blend indices — the numbers that actually decided the outcome. */
  final: Record<ScoredDomain, number>;
  qol: Record<ScoredDomain, number>;
  tieBreakUsed: 'none' | 'qol' | 'priority';
  blendApplied: boolean;
  degradedDomains: ScoredDomain[];
  flags: ReportFlag[];
}

export interface WindowResult {
  anchorMode: WindowAnchorMode | 'assessment';
  start: Date | null;
  end: Date | null;
  daysCovered: number;
  reason: string;
}

export interface OverlayResult {
  overlays: OverlayId[];
  reasons: Record<string, string>;
}

export interface Classification {
  reportId: ReportId;
  stage: Stage;
  domain: Domain;
  overlays: OverlayId[];
  window: WindowResult;
  stageDetail: StageResult;
  domainDetail: DomainResult;
  overlayDetail: OverlayResult;
  flags: ReportFlag[];
  config: {
    useTrackingData: boolean;
    logBlendMode: LogBlendMode;
    logBlendWeight: number;
    templateVersion: string;
  };
  generatedAt: Date;
}

/** Raised when we genuinely cannot classify. The only case is a missing assessment. */
export class Report14Error extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'Report14Error';
    this.status = status;
    this.code = code;
  }
}
