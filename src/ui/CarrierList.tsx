import { MAX_CARRIERS } from '../im';
import { useProjectStore } from '../state/projectStore';
import { useAnalysisStore } from '../state/analysisStore';
import { useViewStore } from '../state/viewStore';
import { MHzInput } from './MHzInput';
import { DevicePicker } from './DevicePicker';

export function CarrierList() {
  const carriers = useProjectStore((s) => s.carriers);
  const addCarrier = useProjectStore((s) => s.addCarrier);
  const updateCarrier = useProjectStore((s) => s.updateCarrier);
  const removeCarrier = useProjectStore((s) => s.removeCarrier);
  const result = useAnalysisStore((s) => s.result);
  const issues = useAnalysisStore((s) => s.issues);
  const openTune = useViewStore((s) => s.openTune);

  const conflicted = new Set(result?.conflictedIds ?? []);
  const flagged = new Set(issues.flatMap((i) => i.carrierIds));

  return (
    <section className="panel">
      <h2>Frequencies</h2>

      <ul className="carrier-list">
        {carriers.map((carrier) => (
          <li
            key={carrier.id}
            className={
              flagged.has(carrier.id) ? 'carrier carrier--invalid' : 'carrier'
            }
          >
            <input
              type="text"
              className="carrier__name"
              aria-label={`Device name for ${carrier.label}`}
              value={carrier.label}
              onChange={(e) => updateCarrier(carrier.id, { label: e.target.value })}
            />

            <span className="carrier__status">
              {conflicted.has(carrier.id) ? (
                <span className="badge badge--bad">Conflict</span>
              ) : result ? (
                <span className="badge badge--good">Clear</span>
              ) : (
                <span className="badge">Not analysed</span>
              )}
            </span>

            <div className="carrier__freq">
              <MHzInput
                label={`Frequency for ${carrier.label} in megahertz`}
                valueKHz={carrier.freqKHz}
                onCommit={(khz) => updateCarrier(carrier.id, { freqKHz: khz })}
              />
              <span className="carrier__unit" aria-hidden="true">
                MHz
              </span>
            </div>

            <DevicePicker carrier={carrier} />

            <label className="carrier__lock">
              <input
                type="checkbox"
                checked={carrier.locked}
                onChange={(e) =>
                  updateCarrier(carrier.id, { locked: e.target.checked })
                }
                aria-label={`Lock the frequency of ${carrier.label}`}
              />
              <span aria-hidden="true">{carrier.locked ? '🔒' : '🔓'}</span>
            </label>

            <div className="carrier__actions">
              <button
                type="button"
                onClick={() => openTune(carrier.id)}
                aria-label={`Tune ${carrier.label}`}
              >
                Tune
              </button>
              <button
                type="button"
                className="btn--ghost"
                onClick={() => removeCarrier(carrier.id)}
                aria-label={`Remove ${carrier.label}`}
              >
                Remove
              </button>
            </div>
          </li>
        ))}
      </ul>

      <button
        type="button"
        className="carrier-list__add"
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
