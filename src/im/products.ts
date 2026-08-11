import { enumerateVectors } from './enumerate';
import type { Settings } from './types';

export type ProductVisitor = (
  freqKHz: number,
  coeffs: readonly number[],
  order: number,
  spreadHz: number,
) => boolean | void;

/**
 * Walks every canonical vector, evaluates it against `freqs`, and reports each
 * product that lands inside the band.
 *
 * `devHz` gives each carrier's deviation in hertz. Pass `null` when every
 * carrier shares one deviation: the spread is then `order × deviation` and the
 * per-carrier multiply-add never runs. This is the path every project saved
 * before device presets existed takes.
 *
 * The `coeffs` array is reused between calls — copy it to retain it. Returning
 * `false` from `visit` aborts the scan. Returns the vectors enumerated.
 */
export function scanProducts(
  freqs: readonly number[],
  settings: Settings,
  visit: ProductVisitor,
  onVector?: (enumerated: number) => void,
  devHz?: readonly number[] | null,
): number {
  const n = freqs.length;
  let enumerated = 0;
  const perCarrier = devHz ?? null;
  const uniformHz = settings.deviationKHz * 1000;

  return enumerateVectors(
    n,
    settings.lowOrder,
    settings.highOrder,
    settings.oddOnly,
    (coeffs, order) => {
      enumerated += 1;
      onVector?.(enumerated);

      let sum = 0;
      let spreadHz = 0;
      if (perCarrier === null) {
        for (let i = 0; i < n; i += 1) sum += coeffs[i] * freqs[i];
        spreadHz = order * uniformHz;
      } else {
        // Folded into the frequency loop rather than given a pass of its own.
        for (let i = 0; i < n; i += 1) {
          const c = coeffs[i];
          sum += c * freqs[i];
          spreadHz += (c < 0 ? -c : c) * perCarrier[i];
        }
      }
      if (sum === 0) return;

      const freqKHz = Math.abs(sum);
      if (freqKHz < settings.bandMinKHz || freqKHz > settings.bandMaxKHz) return;

      return visit(freqKHz, coeffs, order, spreadHz);
    },
  );
}
