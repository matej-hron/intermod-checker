import { kHzToMHzText } from '../im';
import { useAnalysisStore } from '../state/analysisStore';
import { useProjectStore } from '../state/projectStore';

export function SuggestionPanel() {
  const suggestions = useAnalysisStore((s) => s.suggestions);
  const clear = useAnalysisStore((s) => s.clear);
  const status = useAnalysisStore((s) => s.status);
  const carriers = useProjectStore((s) => s.carriers);
  const applySuggestions = useProjectStore((s) => s.applySuggestions);

  if (status !== 'done' || suggestions.length === 0) return null;

  const labelFor = (id: string): string =>
    carriers.find((c) => c.id === id)?.label ?? id;

  const applicable = suggestions.filter((s) => s.toKHz !== null);

  return (
    <section className="panel">
      <h2>Suggested changes</h2>
      <p className="hint">
        Each suggestion is calculated with the previous ones already applied, so
        applying them all clears the conflicts listed here. Run the analysis
        again afterwards to confirm — and note that any carrier shown below
        without a replacement is left where it is.
      </p>
      <ul>
        {suggestions.map((suggestion) => (
          <li key={suggestion.carrierId}>
            <strong>{labelFor(suggestion.carrierId)}</strong>{' '}
            {kHzToMHzText(suggestion.fromKHz)} MHz →{' '}
            {suggestion.toKHz === null ? (
              <em>{suggestion.failureReason}</em>
            ) : (
              <>
                <strong>{kHzToMHzText(suggestion.toKHz)} MHz</strong> (
                {suggestion.distanceKHz} kHz away){' '}
                <button
                  type="button"
                  onClick={() => {
                    applySuggestions([suggestion]);
                    clear();
                  }}
                >
                  Apply
                </button>
              </>
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
