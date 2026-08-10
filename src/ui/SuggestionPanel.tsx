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
            {/* The device name and its current frequency read as one phrase, so
                they stay in the same wrapper and wrap together. */}
            <div className="suggestion__values">
              <strong>{labelFor(suggestion.carrierId)}</strong>{' '}
              {kHzToMHzText(suggestion.fromKHz)} MHz →{' '}
              {suggestion.toKHz === null ? (
                <em>{suggestion.failureReason}</em>
              ) : (
                <>
                  <strong>{kHzToMHzText(suggestion.toKHz)} MHz</strong>{' '}
                  <span className="hint">({suggestion.distanceKHz} kHz away)</span>
                </>
              )}
            </div>
            {suggestion.toKHz !== null && (
              <button
                type="button"
                className="btn--primary"
                onClick={() => {
                  applySuggestions([suggestion]);
                  clear();
                }}
              >
                Apply
              </button>
            )}
            <button
              type="button"
              className="btn--ghost"
              aria-label={`Choose a frequency for ${labelFor(suggestion.carrierId)}`}
              onClick={() => openTune(suggestion.carrierId)}
            >
              Choose myself
            </button>
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
