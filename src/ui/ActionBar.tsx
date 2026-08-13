import { useProjectStore } from '../state/projectStore';
import { useAnalysisStore } from '../state/analysisStore';
import type { ViewName } from '../state/viewStore';
import { Icon } from './Icon';

export function ActionBar({
  onNavigate,
}: {
  onNavigate: (target: ViewName) => void;
}) {
  const carriers = useProjectStore((s) => s.carriers);
  const settings = useProjectStore((s) => s.settings);
  const status = useAnalysisStore((s) => s.status);
  const progress = useAnalysisStore((s) => s.progress);
  const errorMessage = useAnalysisStore((s) => s.errorMessage);
  const issues = useAnalysisStore((s) => s.issues);
  const run = useAnalysisStore((s) => s.run);
  const cancel = useAnalysisStore((s) => s.cancel);

  const running = status === 'running';

  return (
    <div className="action-bar">
      <div className="app__bar action-bar__inner">
        <button
          type="button"
          className="btn--primary action-bar__go"
          onClick={() => {
            void run(carriers, settings);
            onNavigate('results');
          }}
          disabled={running}
        >
          <Icon name="analyse" size={20} className="action-bar__icon" />
          <span className="action-bar__label-long">Analyse frequencies</span>
          <span className="action-bar__label-short">Analyse</span>
        </button>

        {running && (
          <>
            <span className="action-bar__progress" aria-live="polite">
              {progress?.phase === 'suggest' ? 'Finding alternatives' : 'Analysing'}{' '}
              {Math.round((progress?.fraction ?? 0) * 100)}%
            </span>
            <button type="button" onClick={cancel}>
              Cancel
            </button>
          </>
        )}
      </div>

      {/* Always in the DOM and updated in place: a container that mounts with
          content already in it is announced in full every time it appears, so
          returning to this view would re-read every issue. */}
      <div className="app__bar action-bar__issues" aria-live="polite">
        {errorMessage !== null && <p className="error">{errorMessage}</p>}
        {issues.length > 0 && (
          <ul className="error">
            {issues.map((issue, i) => (
              <li key={i}>{issue.message}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
