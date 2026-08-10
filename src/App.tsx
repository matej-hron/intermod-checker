import { FrequencyTable } from './ui/FrequencyTable';
import { SettingsPanel } from './ui/SettingsPanel';
import { ResultsSummary } from './ui/ResultsSummary';
import { ConflictList } from './ui/ConflictList';
import { SpectrumStrip } from './ui/SpectrumStrip';
import { SuggestionPanel } from './ui/SuggestionPanel';
import { ProjectBar } from './ui/ProjectBar';
import { TuneView } from './ui/TuneView';
import { useProjectStore } from './state/projectStore';
import { useAnalysisStore } from './state/analysisStore';
import { useViewStore, type ViewName } from './state/viewStore';
import { useTuneStore } from './state/tuneStore';

const VIEWS: { id: ViewName; label: string }[] = [
  { id: 'setup', label: 'Setup' },
  { id: 'results', label: 'Results' },
  { id: 'tune', label: 'Tune' },
];

export default function App() {
  const carriers = useProjectStore((s) => s.carriers);
  const settings = useProjectStore((s) => s.settings);
  const status = useAnalysisStore((s) => s.status);
  const progress = useAnalysisStore((s) => s.progress);
  const errorMessage = useAnalysisStore((s) => s.errorMessage);
  const issues = useAnalysisStore((s) => s.issues);
  const run = useAnalysisStore((s) => s.run);
  const cancel = useAnalysisStore((s) => s.cancel);
  const view = useViewStore((s) => s.view);
  const goTo = useViewStore((s) => s.goTo);
  const resetTune = useTuneStore((s) => s.reset);

  const navigateTo = (target: ViewName) => {
    // Leaving the Tune view tears down tune state so it does not linger if the
    // user returns and picks a different carrier.
    if (view === 'tune' && target !== 'tune') {
      resetTune();
    }
    goTo(target);
  };

  return (
    <main className="app">
      <h1>Intermodulation Checker</h1>
      <ProjectBar />

      <nav className="views" aria-label="Sections">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            className={view === v.id ? 'view-tab view-tab--active' : 'view-tab'}
            aria-current={view === v.id ? 'page' : undefined}
            onClick={() => navigateTo(v.id)}
          >
            {v.label}
          </button>
        ))}
      </nav>

      <section className="panel">
        <button
          type="button"
          onClick={() => {
            void run(carriers, settings);
            navigateTo('results');
          }}
          disabled={status === 'running'}
        >
          Analyse
        </button>
        {status === 'running' && (
          <>
            <span>
              {progress?.phase === 'suggest' ? 'Finding alternatives' : 'Analysing'}{' '}
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

      {view === 'setup' && (
        <>
          <FrequencyTable />
          <SettingsPanel />
        </>
      )}

      {view === 'results' && (
        <>
          <ResultsSummary />
          <SuggestionPanel />
          <SpectrumStrip />
          <ConflictList />
        </>
      )}

      {view === 'tune' && <TuneView />}

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
