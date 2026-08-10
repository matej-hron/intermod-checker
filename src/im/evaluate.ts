import { effectiveWindowKHz } from './analyze';
import { scanProducts } from './products';
import {
  EXCLUSION_CRITERION,
  SPACING_CRITERION,
  criterionKey,
  realizableCriteria,
  txBucket,
  verdictRank,
  worseVerdict,
  type CriterionKey,
  type Verdict,
} from './criteria';
import { isExcluded, type Carrier, type Settings } from './types';

export interface CandidateExplanation {
  order: number;
  verdict: Verdict;
  offsetKHz: number;
  /** Labels of carriers with a non-zero coefficient, excluding the mover. */
  contributors: string[];
}

export interface CandidateEvaluation {
  freqKHz: number;
  verdicts: Record<CriterionKey, Verdict>;
  /** The worst verdict across every criterion, spacing and exclusion included. */
  worst: Verdict;
  explanation: CandidateExplanation | null;
}

function ordinal(order: number): string {
  if (order === 1) return '1st';
  if (order === 2) return '2nd';
  if (order === 3) return '3rd';
  return `${order}th`;
}

export function explanationText(explanation: CandidateExplanation | null): string {
  if (explanation === null) return 'Clear';
  const parts = [`${ordinal(explanation.order)} order`];
  if (explanation.offsetKHz !== 0) parts.push(`${explanation.offsetKHz} kHz away`);
  if (explanation.contributors.length > 0) parts.push(explanation.contributors.join(' + '));
  return parts.join(' · ');
}

/**
 * Answers "what happens if carrier `index` moves to `candidateKHz`?".
 *
 * `full` resolves every criterion, which the Tune grid needs. `first-hit`
 * returns as soon as anything is non-clear, preserving the early abort
 * `suggest()` depends on; its unresolved criteria stay `clear`, so a
 * `first-hit` result must never be rendered as a grid row.
 *
 * Only products the moved carrier is party to count, and self-involving
 * products are ignored — see spec §4.3 and the note in `suggest.ts`. Judging a
 * candidate on the whole set's cleanliness rejects every candidate for every
 * carrier once two independent conflicts exist.
 */
export function evaluateCandidate(
  freqs: number[],
  index: number,
  candidateKHz: number,
  settings: Settings,
  carriers: readonly Carrier[],
  mode: 'full' | 'first-hit' = 'full',
): CandidateEvaluation {
  const interference = realizableCriteria(settings);
  const verdicts: Record<CriterionKey, Verdict> = {};
  for (const key of interference) verdicts[key] = 'clear';

  let spacing: Verdict = 'clear';
  for (let i = 0; i < freqs.length; i += 1) {
    if (i === index) continue;
    if (Math.abs(freqs[i] - candidateKHz) < settings.minSpacingKHz) {
      spacing = 'exact';
      break;
    }
  }
  verdicts[SPACING_CRITERION] = spacing;
  verdicts[EXCLUSION_CRITERION] = isExcluded(candidateKHz, settings.exclusions)
    ? 'exact'
    : 'clear';

  const settle = (explanation: CandidateExplanation | null): CandidateEvaluation => {
    let worst: Verdict = 'clear';
    for (const key of Object.keys(verdicts)) worst = worseVerdict(worst, verdicts[key]);
    return { freqKHz: candidateKHz, verdicts, worst, explanation };
  };

  // Nothing the product scan could find would change the answer `suggest()`
  // is asking for, and the scan is by far the expensive part.
  if (
    mode === 'first-hit' &&
    (verdicts[SPACING_CRITERION] === 'exact' || verdicts[EXCLUSION_CRITERION] === 'exact')
  ) {
    return settle(null);
  }

  let best: CandidateExplanation | null = null;
  let exactCount = 0;

  const original = freqs[index];
  freqs[index] = candidateKHz;

  scanProducts(freqs, settings, (productKHz, coeffs, order) => {
    const key = criterionKey(txBucket(coeffs), order);
    // Already at the worst verdict: nothing this product could add changes the
    // criterion, and it cannot improve `explanation` either, because order is
    // fixed within a criterion and the offset is already zero.
    if (verdicts[key] === 'exact') return;

    const window = effectiveWindowKHz(order, settings);
    const moverContributes = coeffs[index] !== 0;

    for (let v = 0; v < freqs.length; v += 1) {
      if (coeffs[v] !== 0) continue;
      if (v !== index && !moverContributes) continue;

      const offset = Math.abs(freqs[v] - productKHz);
      if (offset > window) continue;

      const verdict: Verdict = offset === 0 ? 'exact' : 'near';
      const previous = verdicts[key];
      verdicts[key] = worseVerdict(previous, verdict);
      if (previous !== 'exact' && verdicts[key] === 'exact') exactCount += 1;

      const current = best;
      const better =
        current === null ||
        verdictRank(verdict) > verdictRank(current.verdict) ||
        (verdict === current.verdict && order < current.order) ||
        (verdict === current.verdict &&
          order === current.order &&
          offset < current.offsetKHz);

      if (better) {
        // Derived here rather than retained: `coeffs` is the single mutable
        // array `enumerateVectors` reuses across visitor calls.
        const contributors: string[] = [];
        for (let i = 0; i < freqs.length; i += 1) {
          if (i !== index && coeffs[i] !== 0) contributors.push(carriers[i].label);
        }
        best = { order, verdict, offsetKHz: offset, contributors };
      }

      if (mode === 'first-hit') return false;
    }

    if (exactCount >= interference.length) return false;
  });

  freqs[index] = original;
  return settle(best);
}
