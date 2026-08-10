import { analyze } from './analyze';
import { evaluateCandidate } from './evaluate';
import type { Carrier, Settings, Suggestion } from './types';

export const MAX_CANDIDATES = 2000;

const LOCKED_REASON =
  'This frequency is locked, so it was left where it is. Unlock it to let the tool retune it, or move one of the other transmitters instead.';

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

    // A locked carrier still counts as context for everyone else, but nothing
    // may retune it. Reporting it explicitly matters: an empty result here
    // would read as "nothing to fix" for a set that is demonstrably broken.
    if (carriers[index].locked) {
      suggestions.push({
        carrierId,
        fromKHz,
        toKHz: null,
        distanceKHz: null,
        failureReason: LOCKED_REASON,
      });
      onProgress?.((position + 1) / total);
      return;
    }

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

      // `first-hit` keeps v1's early abort: this caller only asks "is it
      // completely clean?", so resolving every criterion would be wasted work.
      const evaluation = evaluateCandidate(
        working,
        index,
        candidate,
        settings,
        carriers,
        'first-hit',
      );
      if (evaluation.worst !== 'clear') continue;

      found = candidate;
    }

    if (found === null) {
      suggestions.push({
        carrierId,
        fromKHz,
        toKHz: null,
        distanceKHz: null,
        failureReason: `No interference-free frequency was found within ${examined} candidates. Widen the band, lower the highest order, reduce the number of transmitters, or remove an exclusion.`,
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
