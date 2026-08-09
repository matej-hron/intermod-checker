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
  const counts: Record<Severity, number> = { high: 0, medium: 0, low: 0 };
  for (const hit of external) counts[hit.severity] += 1;

  return (
    <section className="panel">
      <h2>Result</h2>
      {external.length === 0 ? (
        <p>
          <span className="badge badge--good">No conflicts</span> No
          intermodulation product falls on any of your frequencies with the
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
      <ul>
        {(['high', 'medium', 'low'] as const).map((severity) => (
          <li key={severity}>
            <span className={`badge badge--${severity}`}>
              {SEVERITY_LABEL[severity]}
            </span>{' '}
            {counts[severity]}
          </li>
        ))}
      </ul>
      <p className="hint">
        {result.vectorsExamined.toLocaleString('en-GB')} coefficient combinations
        examined.
      </p>
    </section>
  );
}
