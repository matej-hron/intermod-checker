import type { Severity } from '../im';
import { useAnalysisStore } from '../state/analysisStore';

const SEVERITY_LABEL: Record<Severity, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

export function ResultsSummary() {
  const result = useAnalysisStore((s) => s.result);
  const status = useAnalysisStore((s) => s.status);

  if (status !== 'done' || result === null) return null;

  const external = result.hits.filter((h) => !h.selfInvolving);
  const clear = external.length === 0;
  const counts: Record<Severity, number> = { high: 0, medium: 0, low: 0 };
  for (const hit of external) counts[hit.severity] += 1;

  return (
    <section className="panel">
      <div
        className={
          clear
            ? 'result-lead result-lead--clear'
            : 'result-lead result-lead--conflict'
        }
      >
        <span className="eyebrow">Analysis result</span>
        <h2>{clear ? 'Plan is clear' : `${result.conflictedIds.length} carriers need attention`}</h2>
        {clear ? (
          <p>
            No intermodulation product falls on any of your frequencies with the
            current settings.
          </p>
        ) : (
          <p>
            <span className="badge badge--bad">
              {result.conflictedIds.length} carrier
              {result.conflictedIds.length === 1 ? '' : 's'} affected
            </span>{' '}
            {external.length} product
            {external.length === 1 ? '' : 's'} land on your frequencies.
          </p>
        )}
      </div>
      <div className="summary-grid">
        {(['high', 'medium', 'low'] as const).map((severity) => (
          <div key={severity} className="summary-grid__cell">
            <div className="summary-grid__label">
              <span
                className={`summary-grid__dot summary-grid__dot--${severity}`}
                aria-hidden="true"
              />
              <span>{SEVERITY_LABEL[severity]}</span>
            </div>
            <strong className="summary-grid__count">{counts[severity]}</strong>
          </div>
        ))}
      </div>
      <p className="hint">
        {result.vectorsExamined.toLocaleString('en-GB')} coefficient combinations
        examined.
      </p>
    </section>
  );
}
