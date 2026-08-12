import { CarrierList } from './ui/CarrierList';
import { CarrierSheet } from './ui/CarrierSheet';
import { SettingsPanel } from './ui/SettingsPanel';
import { ResultsSummary } from './ui/ResultsSummary';
import { ConflictList } from './ui/ConflictList';
import { SpectrumStrip } from './ui/SpectrumStrip';
import { SuggestionPanel } from './ui/SuggestionPanel';
import { TuneView } from './ui/TuneView';
import { AppBar } from './ui/AppBar';
import { Nav } from './ui/Nav';
import { ActionBar } from './ui/ActionBar';
import { UpdatePrompt } from './ui/UpdatePrompt';
import { useViewStore, type ViewName } from './state/viewStore';
import { useTuneStore } from './state/tuneStore';

export default function App() {
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
    <div className="app">
      <AppBar />
      <Nav view={view} onNavigate={navigateTo} />
      <ActionBar onNavigate={navigateTo} />

      <main className="app__main">
        {view === 'setup' && (
          <>
            <CarrierList />
            <SettingsPanel />
            <CarrierSheet />
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
      </main>

      <footer className="disclaimer">
        <p>
          This tool models intermodulation products arithmetically from the
          frequencies you enter. It does not know your transmitter power,
          antenna placement, receiver filtering, or any signal that is not in
          your list, and it does not check licensing or broadcast allocations.
          Treat its output as a planning aid, not a guarantee — always verify on
          site before a performance.
        </p>
      </footer>

      <UpdatePrompt />
    </div>
  );
}
