import { generateCandidates } from './candidates';
import { evaluateCandidate, explanationText } from './evaluate';
import type { Verdict } from './criteria';
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

const CLEAR: LiveCheckResult = {
  verdict: 'clear',
  explanation: '',
  alternatives: [],
  searched: false,
};

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
  if (index === -1) return CLEAR;

  const freqs = carriers.map((c) => c.freqKHz);
  const evaluation = evaluateCandidate(freqs, index, candidateKHz, settings, carriers, 'full');

  if (evaluation.worst === 'clear') return CLEAR;

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
    explanation: explanationText(evaluation.explanation),
    alternatives,
    searched: true,
  };
}
