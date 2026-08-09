import { FrequencyTable } from './ui/FrequencyTable';
import { SettingsPanel } from './ui/SettingsPanel';
import { useProjectStore } from './state/projectStore';
import { useAnalysisStore } from './state/analysisStore';

export default function App() {
  const carriers = useProjectStore((s) => s.carriers);
  const settings = useProjectStore((s) => s.settings);
  const status = useAnalysisStore((s) => s.status);
  const progress = useAnalysisStore((s) => s.progress);
  const errorMessage = useAnalysisStore((s) => s.errorMessage);
  const issues = useAnalysisStore((s) => s.issues);
  const run = useAnalysisStore((s) => s.run);
  const cancel = useAnalysisStore((s) => s.cancel);

  return (
    <main className="app">
      <h1>Intermodulation Checker</h1>
      <FrequencyTable />
      <SettingsPanel />

      <section className="panel">
        <button
          type="button"
          onClick={() => void run(carriers, settings)}
          disabled={status === 'running'}
        >
          Analyse
        </button>
        {status === 'running' && (
          <>
            <span>
              {progress?.phase === 'suggest' ? 'Finding alternatives' : 'Analysing'}
              {' '}
              {Math.round((progress?.fraction ?? 0) * 100)}%
            </span>
            <button type="button" onClick={cancel}>
              Cancel
            </button>
          </>
        )}
        {errorMessage !== null && <p className="error">{errorMessage}</p>}
        {issues.length > 0 && (
          <ul className="error">
            {issues.map((issue, i) => (
              <li key={i}>{issue.message}</li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
