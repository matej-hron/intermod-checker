import type { Settings } from './types';

/** Default distance either side of the current frequency, in kHz. */
export const DEFAULT_TUNE_HALF_WIDTH_KHZ = 2000;

/** Hard ceiling on rows the Tune view will evaluate and render. */
export const MAX_TUNE_CANDIDATES = 500;

/**
 * Frequencies to offer for a carrier, in *generation* order: the current
 * frequency first, then outward, alternating below and above.
 *
 * Generation order is nearest-first so that the cap keeps the closest options
 * rather than an arbitrary contiguous slice, and so `suggest()` — which wants
 * the nearest clear frequency, not a browsable list — can consume it directly.
 * The Tune grid sorts by ascending frequency for display (spec §4.5).
 */
export function generateCandidates(
  fromKHz: number,
  settings: Settings,
  halfWidthKHz: number = DEFAULT_TUNE_HALF_WIDTH_KHZ,
): number[] {
  const step = settings.suggestionStepKHz;
  const out: number[] = [];
  if (!Number.isFinite(step) || step <= 0) return out;

  const inBand = (f: number): boolean =>
    f >= settings.bandMinKHz && f <= settings.bandMaxKHz;

  if (inBand(fromKHz)) out.push(fromKHz);

  for (let k = 1; out.length < MAX_TUNE_CANDIDATES; k += 1) {
    const offset = Math.ceil(k / 2) * step;
    if (offset > halfWidthKHz) break;
    const candidate = k % 2 === 1 ? fromKHz - offset : fromKHz + offset;
    // `continue`, not `break`: one side can run out of band while the other
    // still has room.
    if (!inBand(candidate)) continue;
    out.push(candidate);
  }

  return out;
}

export function widenHalfWidth(halfWidthKHz: number, settings: Settings): number {
  const bandWidth = settings.bandMaxKHz - settings.bandMinKHz;
  return Math.min(halfWidthKHz * 2, bandWidth);
}
