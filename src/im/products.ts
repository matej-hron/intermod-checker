import { enumerateVectors } from './enumerate';
import type { Settings } from './types';

export type ProductVisitor = (
  freqKHz: number,
  coeffs: readonly number[],
  order: number,
) => boolean | void;

/**
 * Walks every canonical vector, evaluates it against `freqs`, and reports each
 * product that lands inside the band.
 *
 * The `coeffs` array is reused between calls — copy it to retain it. Returning
 * `false` from `visit` aborts the scan. Returns the vectors enumerated.
 */
export function scanProducts(
  freqs: readonly number[],
  settings: Settings,
  visit: ProductVisitor,
  onVector?: (enumerated: number) => void,
): number {
  const n = freqs.length;
  let enumerated = 0;

  return enumerateVectors(
    n,
    settings.lowOrder,
    settings.highOrder,
    settings.oddOnly,
    (coeffs, order) => {
      enumerated += 1;
      onVector?.(enumerated);

      let sum = 0;
      for (let i = 0; i < n; i += 1) sum += coeffs[i] * freqs[i];
      if (sum === 0) return;

      const freqKHz = Math.abs(sum);
      if (freqKHz < settings.bandMinKHz || freqKHz > settings.bandMaxKHz) return;

      return visit(freqKHz, coeffs, order);
    },
  );
}
