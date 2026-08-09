import { FrequencyTable } from './ui/FrequencyTable';
import { SettingsPanel } from './ui/SettingsPanel';
import { ResultsSummary } from './ui/ResultsSummary';
import { ConflictList } from './ui/ConflictList';
import { SpectrumStrip } from './ui/SpectrumStrip';
import { SuggestionPanel } from './ui/SuggestionPanel';
import { ProjectBar } from './ui/ProjectBar';
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
      <ProjectBar />
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

      <ResultsSummary />
      <SuggestionPanel />
      <SpectrumStrip />
      <ConflictList />

      <footer className="panel hint">
        <p>
          This tool models intermodulation products arithmetically from the
          frequencies you enter. It does not know your transmitter power,
          antenna placement, receiver filtering, or any signal that is not in
          your list, and it does not check licensing or broadcast allocations.
          Treat its output as a planning aid, not a guarantee — always verify on
          site before a performance.
        </p>
      </footer>
    </main>
  );
}
