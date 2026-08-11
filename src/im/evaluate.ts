import { scanProducts } from './products';
import {
  EXCLUSION_CRITERION,
  SPACING_CRITERION,
  criterionKey,
  ordinal,
  realizableCriteria,
  txBucket,
  verdictRank,
  worseVerdict,
  type CriterionKey,
  type Verdict,
} from './criteria';
import { resolveScanDeviationsHz } from './devices';
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
 * products are ignored — see spec §4.3. Judging a candidate on the whole set's
 * cleanliness rejects every candidate for every carrier once two independent
 * conflicts exist. `suggest()` relies on this: while it solves carriers
 * sequentially the later ones are still unfixed, so their conflicts are present
 * in the set but must not disqualify the candidate under evaluation.
 */
export function evaluateCandidate(
  freqs: number[],
  index: number,
  candidateKHz: number,
  settings: Settings,
  carriers: readonly Carrier[],
  mode: 'full' | 'first-hit' = 'full',
): CandidateEvaluation {
  // `full` mode reports every criterion, so it seeds them all to `clear` up
  // front. `first-hit` only ever needs the criterion of the single hit it
  // returns on, so it skips rebuilding the realizable-criteria array and the
  // per-key seeding on every one of `suggest()`'s thousands of candidates.
  const interference = mode === 'full' ? realizableCriteria(settings) : null;
  const verdicts: Record<CriterionKey, Verdict> = {};
  if (interference !== null) for (const key of interference) verdicts[key] = 'clear';

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

  const full = mode === 'full';
  const nearWindowHz = settings.nearHitWindowKHz * 1000;
  const devHz = resolveScanDeviationsHz(carriers, settings);
  const uniformDevHz = settings.deviationKHz * 1000;

  scanProducts(freqs, settings, (productKHz, coeffs, order, spreadHz) => {
    // The criterion key is a per-product string (`criterionKey` templates one),
    // so building it on every product visit allocates in the scan's hottest
    // loop. `full` mode needs it up front for the early skip below; `first-hit`
    // returns on the first hit and never consults an already-`exact` criterion,
    // so it derives the key lazily — only when a hit actually lands.
    let key = full ? criterionKey(txBucket(coeffs), order) : '';
    // Already at the worst verdict: nothing this product could add changes the
    // criterion, and it cannot improve `explanation` either, because order is
    // fixed within a criterion and the offset is already zero.
    if (full && verdicts[key] === 'exact') return;

    // `windowHz` inlined — a function call in the scan's hottest loop. The
    // victim term is added per victim below, so this is only the floor check
    // the spread can already clear on its own.
    const moverContributes = coeffs[index] !== 0;

    // Only products the mover is party to can touch a carrier other than the
    // mover itself, so when it does not contribute the sole possible victim is
    // the mover — skip straight to it instead of scanning every carrier.
    const first = moverContributes ? 0 : index;
    const past = moverContributes ? freqs.length : index + 1;
    for (let v = first; v < past; v += 1) {
      if (coeffs[v] !== 0) continue;
      if (v !== index && !moverContributes) continue;

      const offset = Math.abs(freqs[v] - productKHz);
      const victimDevHz = devHz === null ? uniformDevHz : devHz[v];
      const combined = spreadHz + victimDevHz;
      const window = combined > nearWindowHz ? combined : nearWindowHz;
      if (offset * 1000 > window) continue;

      if (!full) key = criterionKey(txBucket(coeffs), order);

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

      if (!full) return false;
    }

    if (interference !== null && exactCount >= interference.length) return false;
  }, undefined, devHz);

  freqs[index] = original;
  return settle(best);
}
