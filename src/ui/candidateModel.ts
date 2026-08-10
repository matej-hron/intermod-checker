import type { CandidateEvaluation } from '../im';

export type CandidateFilter = 'all' | 'clear' | 'problem';

/**
 * The clear candidate closest to where the transmitter is now, which is the
 * one answer a user standing at a rack actually wants. The frequency already
 * in use is excluded — proposing it as a move would be nonsense.
 */
export function nearestClearKHz(
  evaluations: CandidateEvaluation[],
  currentKHz: number | null,
): number | null {
  let bestKHz: number | null = null;
  for (const evaluation of evaluations) {
    if (evaluation.worst !== 'clear') continue;
    if (currentKHz !== null && evaluation.freqKHz === currentKHz) continue;
    if (
      bestKHz === null ||
      (currentKHz !== null &&
        Math.abs(evaluation.freqKHz - currentKHz) < Math.abs(bestKHz - currentKHz))
    ) {
      bestKHz = evaluation.freqKHz;
    }
  }
  return bestKHz;
}

/**
 * Filtering never drops the current frequency: hiding where the transmitter
 * actually sits would leave the user without a reference point.
 */
export function filterEvaluations(
  evaluations: CandidateEvaluation[],
  filter: CandidateFilter,
  currentKHz: number | null,
): CandidateEvaluation[] {
  if (filter === 'all') return evaluations;
  return evaluations.filter((evaluation) => {
    if (currentKHz !== null && evaluation.freqKHz === currentKHz) return true;
    return filter === 'clear'
      ? evaluation.worst === 'clear'
      : evaluation.worst !== 'clear';
  });
}

export function countByVerdict(evaluations: CandidateEvaluation[]): {
  all: number;
  clear: number;
  problem: number;
} {
  let clear = 0;
  for (const evaluation of evaluations) {
    if (evaluation.worst === 'clear') clear += 1;
  }
  return { all: evaluations.length, clear, problem: evaluations.length - clear };
}
