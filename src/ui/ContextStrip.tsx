import { kHzToMHzText } from '../im';
import { useAnalysisStore } from '../state/analysisStore';
import { useProjectStore } from '../state/projectStore';
import { useTuneStore } from '../state/tuneStore';

/**
 * Every carrier at a glance while one is being tuned. Without it the Tune view
 * would show a single frequency in isolation, which is exactly the whole-set
 * awareness the user needs while choosing.
 */
export function ContextStrip() {
  const carriers = useProjectStore((s) => s.carriers);
  const result = useAnalysisStore((s) => s.result);
  const selectedId = useTuneStore((s) => s.carrierId);
  const select = useTuneStore((s) => s.select);

  const conflicted = new Set(result?.conflictedIds ?? []);

  return (
    <ul className="context-strip">
      {carriers.map((carrier) => {
        const isSelected = carrier.id === selectedId;
        const state = conflicted.has(carrier.id)
          ? 'conflict'
          : result
            ? 'clear'
            : 'unknown';
        return (
          <li key={carrier.id}>
            <button
              type="button"
              className={`context-chip context-chip--${state}${
                isSelected ? ' context-chip--selected' : ''
              }`}
              aria-current={isSelected ? 'true' : undefined}
              onClick={() => select(carrier.id)}
            >
              <span className="context-chip__label">{carrier.label}</span>
              <span className="context-chip__freq">{kHzToMHzText(carrier.freqKHz)}</span>
              <span className="context-chip__state">
                {carrier.locked ? 'locked, ' : ''}
                {state === 'conflict' ? 'conflict' : state === 'clear' ? 'clear' : 'not analysed'}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
