import { useState } from 'react';
import { explanationText, kHzToMHzText, type Carrier, type Verdict } from '../im';
import {
  countByVerdict,
  filterEvaluations,
  type CandidateFilter,
} from './candidateModel';
import { useCandidateModel } from './useCandidateModel';

// The worst verdict is a summary across every criterion, so it is rendered
// directly rather than through VerdictDot, whose label is per-criterion.
const VERDICT_TEXT: Record<Verdict, string> = {
  clear: 'clear',
  near: 'near miss',
  exact: 'direct hit',
};

const FILTERS: { id: CandidateFilter; label: string }[] = [
  { id: 'clear', label: 'Clear' },
  { id: 'problem', label: 'Problems' },
  { id: 'all', label: 'All' },
];

function deltaText(offsetKHz: number): string {
  if (offsetKHz === 0) return '0';
  return offsetKHz > 0 ? `+${offsetKHz}` : `${offsetKHz}`;
}

export function CandidateList({ carrier }: { carrier: Carrier }) {
  // Clear-only by default: on a phone the useful question is where the
  // transmitter can go, not how badly every other slot scores.
  const [filter, setFilter] = useState<CandidateFilter>('clear');
  const { evaluations, currentKHz, nearestClear, locked, apply } =
    useCandidateModel(carrier);

  if (evaluations.length === 0) {
    return (
      <p className="hint">
        No frequency in this range is inside the band. Widen the band in Setup,
        or reduce the suggestion step.
      </p>
    );
  }

  const counts = countByVerdict(evaluations);
  const shown = filterEvaluations(evaluations, filter, currentKHz);

  return (
    <>
      {nearestClear !== null && (
        <div className="pinned">
          <div>
            <span className="hint">Nearest clear</span>
            <strong className="pinned__freq">{kHzToMHzText(nearestClear)} MHz</strong>
            {currentKHz !== null && (
              <span className="hint"> ({deltaText(nearestClear - currentKHz)} kHz)</span>
            )}
          </div>
          <button
            type="button"
            className="btn--primary"
            disabled={locked}
            onClick={() => apply(nearestClear)}
          >
            Use it
          </button>
        </div>
      )}

      {nearestClear === null && (
        <p className="hint">
          Nothing in this range is completely clear. Widen the search, remove an
          excluded range, or move one of the other transmitters.
        </p>
      )}

      <div className="segmented" role="group" aria-label="Filter candidates">
        {FILTERS.map((option) => (
          <button
            key={option.id}
            type="button"
            className="segmented__option"
            aria-pressed={filter === option.id}
            onClick={() => setFilter(option.id)}
          >
            {option.label} <span className="hint">{counts[option.id]}</span>
          </button>
        ))}
      </div>

      {shown.length === 0 && (
        <p className="hint">No candidate matches this filter.</p>
      )}

      <ul className="candidate-list">
        {shown.map((evaluation) => {
          const isCurrent = evaluation.freqKHz === currentKHz;
          const isBest = evaluation.freqKHz === nearestClear;
          const classes = ['candidate'];
          if (isCurrent) classes.push('candidate--current');
          if (isBest) classes.push('candidate--best');

          return (
            <li key={evaluation.freqKHz} className={classes.join(' ')}>
              <button
                type="button"
                className="candidate__pick"
                disabled={locked || isCurrent}
                onClick={() => apply(evaluation.freqKHz)}
              >
                <span className="candidate__freq">
                  {kHzToMHzText(evaluation.freqKHz)}
                  <span className="candidate__unit"> MHz</span>
                </span>
                <span className="candidate__delta">
                  {currentKHz === null
                    ? ''
                    : `${deltaText(evaluation.freqKHz - currentKHz)} kHz`}
                </span>
                <span className="candidate__verdict">
                  <span className={`dot dot--${evaluation.worst}`} aria-hidden="true" />
                  <span className="visually-hidden">
                    {VERDICT_TEXT[evaluation.worst]}:{' '}
                  </span>
                  {explanationText(evaluation.explanation)}
                </span>
              </button>
              <span className="candidate__tags">
                {isCurrent && <span className="badge">current</span>}
                {isBest && <span className="badge badge--good">nearest clear</span>}
              </span>
            </li>
          );
        })}
      </ul>
    </>
  );
}
