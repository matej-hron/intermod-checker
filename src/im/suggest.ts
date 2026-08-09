import { analyze, effectiveWindowKHz } from './analyze';
import { scanProducts } from './products';
import type { Carrier, Settings, Suggestion } from './types';

export const MAX_CANDIDATES = 2000;

/**
 * True when `candidateKHz` for `index` produces no qualifying hit against the
 * rest of the working set. Aborts on the first hit found.
 *
 * Self-involving products are ignored here for the same reason `analyze` keeps
 * them out of `conflictedIds`: a product a carrier contributes to is its own
 * self-mixing, not a reason to reject an otherwise clean frequency.
 */
function isCandidateClean(
  freqs: number[],
  index: number,
  candidateKHz: number,
  settings: Settings,
): boolean {
  const original = freqs[index];
  freqs[index] = candidateKHz;
  let clean = true;

  scanProducts(freqs, settings, (productKHz, coeffs, order) => {
    const window = effectiveWindowKHz(order, settings);
    for (let v = 0; v < freqs.length; v += 1) {
      if (coeffs[v] !== 0) continue;
      if (Math.abs(freqs[v] - productKHz) <= window) {
        clean = false;
        return false;
      }
    }
  });

  freqs[index] = original;
  return clean;
}

function respectsSpacing(
  freqs: readonly number[],
  index: number,
  candidateKHz: number,
  settings: Settings,
): boolean {
  for (let i = 0; i < freqs.length; i += 1) {
    if (i === index) continue;
    if (Math.abs(freqs[i] - candidateKHz) < settings.minSpacingKHz) return false;
  }
  return true;
}

export function suggest(
  carriers: readonly Carrier[],
  settings: Settings,
  onProgress?: (fraction: number) => void,
): Suggestion[] {
  const baseline = analyze(carriers, settings);
  if (baseline.conflictedIds.length === 0) {
    onProgress?.(1);
    return [];
  }

  const working = carriers.map((c) => c.freqKHz);
  const indexById = new Map(carriers.map((c, i) => [c.id, i]));
  const suggestions: Suggestion[] = [];
  const total = baseline.conflictedIds.length;

  baseline.conflictedIds.forEach((carrierId, position) => {
    const index = indexById.get(carrierId);
    if (index === undefined) return;

    const fromKHz = working[index];
    const step = settings.suggestionStepKHz;
    let found: number | null = null;
    let examined = 0;

    for (let k = 1; k <= MAX_CANDIDATES && found === null; k += 1) {
      const offset = Math.ceil(k / 2) * step;
      const candidate = k % 2 === 1 ? fromKHz - offset : fromKHz + offset;
      examined += 1;

      if (candidate < settings.bandMinKHz || candidate > settings.bandMaxKHz) {
        continue;
      }
      if (!respectsSpacing(working, index, candidate, settings)) continue;
      if (!isCandidateClean(working, index, candidate, settings)) continue;

      found = candidate;
    }

    if (found === null) {
      suggestions.push({
        carrierId,
        fromKHz,
        toKHz: null,
        distanceKHz: null,
        failureReason: `No interference-free frequency was found within ${examined} candidates. Widen the band, lower the highest order, or reduce the number of transmitters.`,
      });
    } else {
      working[index] = found;
      suggestions.push({
        carrierId,
        fromKHz,
        toKHz: found,
        distanceKHz: Math.abs(found - fromKHz),
      });
    }

    onProgress?.((position + 1) / total);
  });

  onProgress?.(1);
  return suggestions;
}
