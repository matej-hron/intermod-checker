import { OfflineChip } from './OfflineChip';
import { ProjectSheet } from './ProjectSheet';

export function AppBar() {
  return (
    <header className="app-bar">
      <div className="app__bar app-bar__inner">
        <div className="app-brand">
          <h1 className="app-brand__title">Intermodulation Checker</h1>
          <p className="app-brand__descriptor">Frequency fieldbook</p>
        </div>
        <OfflineChip />
        <ProjectSheet />
      </div>
    </header>
  );
}
