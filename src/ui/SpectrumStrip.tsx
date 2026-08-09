import { kHzToMHzText } from '../im';
import { useAnalysisStore } from '../state/analysisStore';
import { useProjectStore } from '../state/projectStore';

export function SpectrumStrip() {
  const carriers = useProjectStore((s) => s.carriers);
  const settings = useProjectStore((s) => s.settings);
  const result = useAnalysisStore((s) => s.result);

  const span = settings.bandMaxKHz - settings.bandMinKHz;
  if (span <= 0) return null;

  const position = (khz: number): number =>
    ((khz - settings.bandMinKHz) / span) * 100;

  const conflicted = new Set(result?.conflictedIds ?? []);
  const products = (result?.hits ?? [])
    .filter((h) => !h.selfInvolving)
    .slice(0, 400);

  // The chart is a visual summary only; ResultsSummary/ConflictList already
  // carry the same data as text. It still needs its own accessible name and
  // description so assistive tech users know what the markers represent.
  const chartLabel = `Spectrum from ${kHzToMHzText(settings.bandMinKHz)} to ${kHzToMHzText(settings.bandMaxKHz)} MHz showing ${carriers.length} carrier${carriers.length === 1 ? '' : 's'} and ${products.length} interference product${products.length === 1 ? '' : 's'}. See the Details section below for the full text listing.`;

  return (
    <section className="panel">
      <h2>Spectrum</h2>
      <div className="spectrum" role="img" aria-label={chartLabel}>
        <div className="spectrum__track">
        {products.map((hit, i) => (
          <span
            key={`p-${i}`}
            className={`spectrum__product spectrum__product--${hit.severity}`}
            style={{ left: `${position(hit.product.freqKHz)}%` }}
            title={`${kHzToMHzText(hit.product.freqKHz)} MHz, order ${hit.product.order}, ${hit.severity} severity`}
          />
        ))}
        {carriers.map((carrier) => (
          <span
            key={carrier.id}
            className={
              conflicted.has(carrier.id)
                ? 'spectrum__carrier spectrum__carrier--bad'
                : 'spectrum__carrier'
            }
            style={{ left: `${position(carrier.freqKHz)}%` }}
            title={`${carrier.label} — ${kHzToMHzText(carrier.freqKHz)} MHz${conflicted.has(carrier.id) ? ' (conflict)' : ''}`}
          />
        ))}
        </div>
      </div>
      <div className="spectrum__scale">
        <span>{kHzToMHzText(settings.bandMinKHz)} MHz</span>
        <span>{kHzToMHzText(settings.bandMaxKHz)} MHz</span>
      </div>
    </section>
  );
}
