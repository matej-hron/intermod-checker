import { generateCandidates } from './candidates';
import { evaluateCandidate, explanationText, type CandidateEvaluation } from './evaluate';
import {
  EXCLUSION_CRITERION,
  SPACING_CRITERION,
  criterionLabel,
  type Verdict,
} from './criteria';
import type { Carrier, Settings } from './types';

/** How far either side of the typed frequency the live check will look. */
export const LIVE_CHECK_HALF_WIDTH_KHZ = 500;

/** How many clear alternatives the sheet offers as chips. */
export const LIVE_CHECK_MAX_ALTERNATIVES = 3;

export interface LiveCheckResult {
  verdict: Verdict;
  /** `explanationText()` of the worst hit; empty when clear. */
  explanation: string;
  /** Clear frequencies in kHz, nearest first, at most `maxAlternatives`. */
  alternatives: number[];
  /** False when no search was run — either the frequency is clear or unknown. */
  searched: boolean;
}

const CLEAR_RESULT_FIELDS = {
  verdict: 'clear' as Verdict,
  explanation: '',
  alternatives: [] as number[],
  searched: false,
};

function clearResult(): LiveCheckResult {
  return { ...CLEAR_RESULT_FIELDS, alternatives: [] };
}

/**
 * Derives a non-empty explanation string for a non-clear verdict.
 *
 * A candidate can trip a product hit *and* a spacing or exclusion criterion at
 * once — `evaluate.ts` sets both unconditionally. So the spacing and exclusion
 * labels are appended whenever those criteria are non-clear, not only when the
 * product `explanation` is null; otherwise the stated cause would understate
 * what the user must fix.
 */
function buildExplanation(evaluation: CandidateEvaluation): string {
  const parts: string[] = [];
  if (evaluation.explanation !== null) parts.push(explanationText(evaluation.explanation));
  if (evaluation.verdicts[SPACING_CRITERION] !== 'clear') {
    parts.push(criterionLabel(SPACING_CRITERION));
  }
  if (evaluation.verdicts[EXCLUSION_CRITERION] !== 'clear') {
    parts.push(criterionLabel(EXCLUSION_CRITERION));
  }
  if (parts.length > 0) return parts.join(' · ');

  // Should not arise; guard against returning 'Clear' or ''.
  return `Conflict (${evaluation.worst})`;
}

/**
 * Answers "is this frequency usable, and if not, what is nearby?" for a single
 * carrier being edited.
 *
 * It delegates the verdict to `evaluateCandidate`, the same function the Tune
 * grid uses, so the edit sheet can never contradict Tune. The search is skipped
 * entirely when the frequency is already clear, which is the common case.
 *
 * Pure: no clock, no randomness, no storage. Every input is a parameter.
 */
export function liveCheck(
  carriers: readonly Carrier[],
  settings: Settings,
  carrierId: string,
  candidateKHz: number,
  maxAlternatives: number = LIVE_CHECK_MAX_ALTERNATIVES,
  halfWidthKHz: number = LIVE_CHECK_HALF_WIDTH_KHZ,
): LiveCheckResult {
  const index = carriers.findIndex((c) => c.id === carrierId);
  // A carrier can vanish between a debounce firing and this call — deleted, or
  // the project switched. Saying "clear" is wrong, but there is nothing to be
  // right about, and throwing would take the sheet down with it.
  if (index === -1) return clearResult();

  const freqs = carriers.map((c) => c.freqKHz);
  const evaluation = evaluateCandidate(freqs, index, candidateKHz, settings, carriers, 'full');

  if (evaluation.worst === 'clear') return clearResult();

  const alternatives: number[] = [];
  if (maxAlternatives > 0) {
    // Nearest-first by construction, so the first clear hits are the closest.
    for (const freq of generateCandidates(candidateKHz, settings, halfWidthKHz)) {
      if (freq === candidateKHz) continue;
      const alt = evaluateCandidate(freqs, index, freq, settings, carriers, 'first-hit');
      if (alt.worst !== 'clear') continue;
      alternatives.push(freq);
      if (alternatives.length >= maxAlternatives) break;
    }
  }

  return {
    verdict: evaluation.worst,
    explanation: buildExplanation(evaluation),
    alternatives,
    searched: true,
  };
}
