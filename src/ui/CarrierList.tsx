import { MAX_CARRIERS, kHzToMHzText } from '../im';
import { useProjectStore } from '../state/projectStore';
import { useAnalysisStore } from '../state/analysisStore';
import { useViewStore } from '../state/viewStore';
import { describeCarrierDevice } from './carrierSummary';

export function CarrierList() {
  const carriers = useProjectStore((s) => s.carriers);
  const addCarrier = useProjectStore((s) => s.addCarrier);
  const updateCarrier = useProjectStore((s) => s.updateCarrier);
  const result = useAnalysisStore((s) => s.result);
  const issues = useAnalysisStore((s) => s.issues);
  const openCarrier = useViewStore((s) => s.openCarrier);

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
            <button
              type="button"
              className="carrier__open"
              aria-label={`Edit ${carrier.label}, ${kHzToMHzText(carrier.freqKHz)} megahertz`}
              onClick={() => openCarrier(carrier.id)}
            >
              <span className="carrier__line">
                <span className="carrier__label">{carrier.label}</span>
                <span className="carrier__freq">{kHzToMHzText(carrier.freqKHz)} MHz</span>
              </span>
              <span className="carrier__line">
                <span className="carrier__device">{describeCarrierDevice(carrier)}</span>
                {conflicted.has(carrier.id) ? (
                  <span className="badge badge--bad carrier__badge">Conflict</span>
                ) : result ? (
                  <span className="badge badge--good carrier__badge">Clear</span>
                ) : (
                  <span className="badge carrier__badge">Not analysed</span>
                )}
              </span>
            </button>
            <button
              type="button"
              className="carrier__lock"
              aria-label={carrier.locked ? `Unlock ${carrier.label}` : `Lock ${carrier.label}`}
              aria-pressed={carrier.locked}
              onClick={() => updateCarrier(carrier.id, { locked: !carrier.locked })}
            >
              <span aria-hidden="true">{carrier.locked ? '🔒' : '🔓'}</span>
            </button>
          </li>
        ))}
      </ul>

      <button
        type="button"
        className="carrier-list__add"
        onClick={() => {
          const id = addCarrier();
          openCarrier(id);
        }}
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
