import { OfflineChip } from './OfflineChip';
import { ProjectSheet } from './ProjectSheet';

export function AppBar() {
  return (
    <header className="app-bar">
      <div className="app__bar app-bar__inner">
        <h1 className="app-bar__title">Intermodulation Checker</h1>
        <OfflineChip />
        <ProjectSheet />
      </div>
    </header>
  );
}
