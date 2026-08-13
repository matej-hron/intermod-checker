import { MAX_CARRIERS, kHzToMHzText } from '../im';
import { useProjectStore } from '../state/projectStore';
import { useAnalysisStore } from '../state/analysisStore';
import { useViewStore } from '../state/viewStore';
import { Icon } from './Icon';
import { describeCarrierDevice } from './carrierSummary';

export function CarrierList() {
  const carriers = useProjectStore((s) => s.carriers);
  const addCarrier = useProjectStore((s) => s.addCarrier);
  const updateCarrier = useProjectStore((s) => s.updateCarrier);
  const deleteCarrier = useProjectStore((s) => s.deleteCarrierWithUndo);
  const result = useAnalysisStore((s) => s.result);
  const issues = useAnalysisStore((s) => s.issues);
  const openCarrier = useViewStore((s) => s.openCarrier);

  const conflicted = new Set(result?.conflictedIds ?? []);
  const flagged = new Set(issues.flatMap((i) => i.carrierIds));

  return (
    <section className="panel">
      <div className="panel__heading">
        <div>
          <span className="eyebrow">Setup</span>
          <h2>Frequency plan</h2>
          <p className="hint">{carriers.length} active frequencies</p>
        </div>
      </div>

      <ul className="carrier-list">
        {carriers.map((carrier) => {
          const classes = ['carrier'];
          if (flagged.has(carrier.id)) classes.push('carrier--invalid');
          if (conflicted.has(carrier.id)) classes.push('carrier--conflict');
          if (result && !conflicted.has(carrier.id)) classes.push('carrier--clear');

          return (
            <li key={carrier.id} className={classes.join(' ')}>
              <button
                type="button"
                className="carrier__open"
                aria-label={`Edit ${carrier.label}, ${kHzToMHzText(carrier.freqKHz)} megahertz`}
                onClick={() => openCarrier(carrier.id)}
              >
                <span className="carrier__state-mark" aria-hidden="true" />
                <span className="carrier__content">
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
                </span>
              </button>
              <button
                type="button"
                className="carrier__lock"
                aria-label={carrier.locked ? `Unlock ${carrier.label}` : `Lock ${carrier.label}`}
                aria-pressed={carrier.locked}
                onClick={() => updateCarrier(carrier.id, { locked: !carrier.locked })}
              >
                <Icon name={carrier.locked ? 'lock' : 'unlock'} />
              </button>
              <button
                type="button"
                className="carrier__delete"
                aria-label={`Delete ${carrier.label}`}
                onClick={() => deleteCarrier(carrier.id)}
              >
                <Icon name="delete" />
              </button>
            </li>
          );
        })}
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
        <Icon name="add" />
        Add frequency
      </button>
      {carriers.length >= MAX_CARRIERS && (
        <p className="hint">Maximum of {MAX_CARRIERS} frequencies reached.</p>
      )}
    </section>
  );
}
