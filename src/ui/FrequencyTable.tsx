import { MAX_CARRIERS } from '../im';
import { useProjectStore } from '../state/projectStore';
import { useAnalysisStore } from '../state/analysisStore';
import { MHzInput } from './MHzInput';

export function FrequencyTable() {
  const carriers = useProjectStore((s) => s.carriers);
  const addCarrier = useProjectStore((s) => s.addCarrier);
  const updateCarrier = useProjectStore((s) => s.updateCarrier);
  const removeCarrier = useProjectStore((s) => s.removeCarrier);
  const result = useAnalysisStore((s) => s.result);
  const issues = useAnalysisStore((s) => s.issues);

  const conflicted = new Set(result?.conflictedIds ?? []);
  const flagged = new Set(issues.flatMap((i) => i.carrierIds));

  return (
    <section className="panel">
      <h2>Frequencies</h2>
      <table className="freq-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Device</th>
            <th>Frequency (MHz)</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {carriers.map((carrier, index) => (
            <tr
              key={carrier.id}
              className={flagged.has(carrier.id) ? 'row--invalid' : undefined}
            >
              <td>{String.fromCharCode(65 + index)}</td>
              <td>
                <input
                  aria-label={`Device name for carrier ${index + 1}`}
                  value={carrier.label}
                  onChange={(e) =>
                    updateCarrier(carrier.id, { label: e.target.value })
                  }
                />
              </td>
              <td>
                <MHzInput
                  label={`Frequency for ${carrier.label} in megahertz`}
                  valueKHz={carrier.freqKHz}
                  onCommit={(khz) => updateCarrier(carrier.id, { freqKHz: khz })}
                />
              </td>
              <td>
                {conflicted.has(carrier.id) ? (
                  <span className="badge badge--bad">Conflict</span>
                ) : result ? (
                  <span className="badge badge--good">Clear</span>
                ) : (
                  <span className="badge">—</span>
                )}
              </td>
              <td>
                <button
                  type="button"
                  onClick={() => removeCarrier(carrier.id)}
                  aria-label={`Remove carrier ${index + 1}`}
                >
                  Remove
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button
        type="button"
        onClick={addCarrier}
        disabled={carriers.length >= MAX_CARRIERS}
      >
        Add frequency
      </button>
      {carriers.length >= MAX_CARRIERS && (
        <p className="hint">Maximum of {MAX_CARRIERS} frequencies reached.</p>
      )}
    </section>
  );
}
