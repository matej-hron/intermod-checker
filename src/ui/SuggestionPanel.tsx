import { kHzToMHzText } from '../im';
import { useAnalysisStore } from '../state/analysisStore';
import { useProjectStore } from '../state/projectStore';
import { useViewStore } from '../state/viewStore';

export function SuggestionPanel() {
  const suggestions = useAnalysisStore((s) => s.suggestions);
  const clear = useAnalysisStore((s) => s.clear);
  const status = useAnalysisStore((s) => s.status);
  const carriers = useProjectStore((s) => s.carriers);
  const applySuggestions = useProjectStore((s) => s.applySuggestions);
  const openTune = useViewStore((s) => s.openTune);

  if (status !== 'done' || suggestions.length === 0) return null;

  const labelFor = (id: string): string =>
    carriers.find((c) => c.id === id)?.label ?? id;

  const applicable = suggestions.filter((s) => s.toKHz !== null);

  return (
    <section className="panel">
      <h2>Suggested changes</h2>
      <p className="hint">
        Each suggestion is calculated with the previous ones already applied.
        Run the analysis again afterwards to confirm the result: in a congested
        band the later carriers can run out of room, and any carrier listed
        without a replacement is left where it is.
      </p>
      <ul>
        {suggestions.map((suggestion) => (
          <li key={suggestion.carrierId} className="suggestion">
            <strong>{labelFor(suggestion.carrierId)}</strong>{' '}
            {suggestion.toKHz === null ? (
              <div className="suggestion__values">
                {kHzToMHzText(suggestion.fromKHz)} MHz →{' '}
                <em>{suggestion.failureReason}</em>{' '}
                <button
                  type="button"
                  className="btn--ghost"
                  aria-label={`Choose a frequency for ${labelFor(suggestion.carrierId)}`}
                  onClick={() => openTune(suggestion.carrierId)}
                >
                  Choose myself
                </button>
              </div>
            ) : (
              <div className="suggestion__values">
                {kHzToMHzText(suggestion.fromKHz)} MHz →{' '}
                <strong>{kHzToMHzText(suggestion.toKHz)} MHz</strong> (
                {suggestion.distanceKHz} kHz away){' '}
                <button
                  type="button"
                  className="btn--primary"
                  onClick={() => {
                    applySuggestions([suggestion]);
                    clear();
                  }}
                >
                  Apply
                </button>{' '}
                <button
                  type="button"
                  className="btn--ghost"
                  aria-label={`Choose a frequency for ${labelFor(suggestion.carrierId)}`}
                  onClick={() => openTune(suggestion.carrierId)}
                >
                  Choose myself
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
      <button
        type="button"
        disabled={applicable.length === 0}
        onClick={() => {
          applySuggestions(applicable);
          clear();
        }}
      >
        Apply all ({applicable.length})
      </button>
    </section>
  );
}
