import { carrierDeviationsHz, resolveDeviationHz } from './devices';
import { enumerateVectors } from './enumerate';
import { scanProducts } from './products';
import { windowHz } from './window';
import type {
  AnalysisResult,
  Carrier,
  Hit,
  Product,
  Settings,
  Severity,
} from './types';

const PROGRESS_INTERVAL = 20000;

export function severityForOrder(order: number): Severity {
  if (order <= 3) return 'high';
  if (order <= 5) return 'medium';
  return 'low';
}

export function effectiveWindowKHz(order: number, settings: Settings): number {
  return Math.max(settings.nearHitWindowKHz, order * settings.deviationKHz);
}

export function analyze(
  carriers: readonly Carrier[],
  settings: Settings,
  onProgress?: (fraction: number) => void,
): AnalysisResult {
  const n = carriers.length;
  const freqs = carriers.map((c) => c.freqKHz);
  const devHz = ((): readonly number[] | null => {
    const uniform = carrierDeviationsHz(carriers, settings);
    // carrierDeviationsHz returns null for a *uniform* fleet, which the scan
    // reads as "use the global deviation". A fleet of identical devices is
    // uniform too, but at a deviation that differs from the global setting, so
    // make that shared deviation explicit; legacy projects (no device) resolve
    // back to the global setting and keep the allocation-free fast path.
    if (uniform !== null || n === 0) return uniform;
    const sharedHz = resolveDeviationHz(carriers[0], settings);
    return sharedHz === settings.deviationKHz * 1000
      ? null
      : carriers.map(() => sharedHz);
  })();
  const uniformDevHz = settings.deviationKHz * 1000;
  const hits: Hit[] = [];
  const hitsByCarrierId: Record<string, Hit[]> = {};
  for (const c of carriers) hitsByCarrierId[c.id] = [];

  // A counting pass with an empty visitor is far cheaper than the evaluation
  // pass, and it gives an exact denominator for honest progress reporting.
  const total =
    onProgress === undefined
      ? 0
      : enumerateVectors(
          n,
          settings.lowOrder,
          settings.highOrder,
          settings.oddOnly,
          () => {},
        );

  const vectorsExamined = scanProducts(
    freqs,
    settings,
    (freqKHz, coeffs, order, spreadHz) => {
      let product: Product | null = null;

      for (let v = 0; v < n; v += 1) {
        const offset = Math.abs(freqs[v] - freqKHz);
        const victimDevHz = devHz === null ? uniformDevHz : devHz[v];
        if (offset * 1000 > windowHz(spreadHz, victimDevHz, settings.nearHitWindowKHz))
          continue;

        if (product === null) {
          // Normalise so the stored coefficients produce the positive frequency.
          let sum = 0;
          for (let i = 0; i < n; i += 1) sum += coeffs[i] * freqs[i];
          const stored = sum < 0 ? coeffs.map((c) => -c) : [...coeffs];
          product = { coeffs: stored, order, freqKHz };
        }

        const hit: Hit = {
          victimId: carriers[v].id,
          product,
          kind: offset === 0 ? 'exact' : 'near',
          offsetKHz: offset,
          severity: severityForOrder(order),
          selfInvolving: coeffs[v] !== 0,
        };
        hits.push(hit);
        hitsByCarrierId[carriers[v].id].push(hit);
      }
    },
    (enumerated) => {
      if (onProgress && total > 0 && enumerated % PROGRESS_INTERVAL === 0) {
        onProgress(enumerated / total);
      }
    },
    devHz,
  );

  const conflictedIds = carriers
    .filter((c) => (hitsByCarrierId[c.id] ?? []).some((h) => !h.selfInvolving))
    .map((c) => c.id);

  onProgress?.(1);

  return { hits, hitsByCarrierId, conflictedIds, vectorsExamined };
}
