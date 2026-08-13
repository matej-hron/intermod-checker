import { Icon } from './Icon';
import type { ViewName } from '../state/viewStore';

const VIEWS: { id: ViewName; label: string }[] = [
  { id: 'setup', label: 'Setup' },
  { id: 'results', label: 'Results' },
  { id: 'tune', label: 'Tune' },
];

export function Nav({
  view,
  onNavigate,
}: {
  view: ViewName;
  onNavigate: (target: ViewName) => void;
}) {
  return (
    <nav className="nav" aria-label="Sections">
      {VIEWS.map((v) => (
        <button
          key={v.id}
          type="button"
          className="nav__tab"
          aria-current={view === v.id ? 'page' : undefined}
          onClick={() => onNavigate(v.id)}
        >
          <Icon
            name={v.id === 'setup' ? 'project' : v.id === 'results' ? 'analyse' : 'tune'}
            size={18}
            className="nav__icon"
          />
          {v.label}
        </button>
      ))}
    </nav>
  );
}
