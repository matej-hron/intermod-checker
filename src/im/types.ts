export interface Carrier {
  id: string;
  label: string;
  freqKHz: number;
  /** A locked carrier is never retuned by any automated process. */
  locked: boolean;
  /** Catalogue id. Absent means the global deviation setting applies. */
  deviceId?: string;
  /** Which of the device's modes. Absent means its first. */
  modeId?: string;
  /** Recorded and displayed only; never used in the calculation. */
  powerMW?: number;
}

/** A span of the band that a carrier may not occupy. Both bounds inclusive. */
export interface Exclusion {
  id: string;
  label: string;
  startKHz: number;
  endKHz: number;
}

export interface Settings {
  bandMinKHz: number;
  bandMaxKHz: number;
  lowOrder: number;
  highOrder: number;
  oddOnly: boolean;
  nearHitWindowKHz: number;
  deviationKHz: number;
  minSpacingKHz: number;
  suggestionStepKHz: number;
  exclusions: Exclusion[];
}

export const DEFAULT_SETTINGS: Settings = {
  bandMinKHz: 500000,
  bandMaxKHz: 700000,
  lowOrder: 3,
  highOrder: 5,
  oddOnly: true,
  nearHitWindowKHz: 25,
  deviationKHz: 0,
  minSpacingKHz: 250,
  suggestionStepKHz: 25,
  exclusions: [],
};

export const MAX_ORDER = 9;

export const MIN_CARRIERS = 2;
export const MAX_CARRIERS = 24;

export interface Product {
  /** Coefficient per carrier, index-aligned with the carrier array. */
  coeffs: number[];
  /** Sum of absolute coefficients. */
  order: number;
  /** Always positive, in kHz. */
  freqKHz: number;
}

export type HitKind = 'exact' | 'near';
export type Severity = 'high' | 'medium' | 'low';

export interface Hit {
  victimId: string;
  product: Product;
  kind: HitKind;
  offsetKHz: number;
  severity: Severity;
  /** True when the victim carrier also contributes to the product. */
  selfInvolving: boolean;
}

export interface AnalysisResult {
  hits: Hit[];
  hitsByCarrierId: Record<string, Hit[]>;
  conflictedIds: string[];
  vectorsExamined: number;
}

export interface Suggestion {
  carrierId: string;
  fromKHz: number;
  /** Null when no clean replacement was found. */
  toKHz: number | null;
  /** Null when `toKHz` is null. */
  distanceKHz: number | null;
  /** Present only when `toKHz` is null. */
  failureReason?: string;
}

export type ValidationField = 'carriers' | 'frequency' | 'settings' | 'exclusions';

export interface ValidationIssue {
  field: ValidationField;
  message: string;
  /** Carrier ids the issue applies to; empty for whole-set issues. */
  carrierIds: string[];
}

export function normalizeExclusion(e: Exclusion): Exclusion {
  return e.startKHz <= e.endKHz
    ? e
    : { ...e, startKHz: e.endKHz, endKHz: e.startKHz };
}

/** Inclusive on both bounds, per spec §3.2. */
export function isExcluded(freqKHz: number, exclusions: readonly Exclusion[]): boolean {
  return exclusions.some((e) => freqKHz >= e.startKHz && freqKHz <= e.endKHz);
}
