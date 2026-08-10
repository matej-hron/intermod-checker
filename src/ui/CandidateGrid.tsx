import {
  EXCLUSION_CRITERION,
  SPACING_CRITERION,
  criterionLabel,
  explanationText,
  kHzToMHzText,
  type Carrier,
} from '../im';
import { VerdictDot } from './VerdictDot';
import { useCandidateModel } from './useCandidateModel';

function deltaText(offsetKHz: number): string {
  if (offsetKHz === 0) return '0';
  return offsetKHz > 0 ? `+${offsetKHz}` : `${offsetKHz}`;
}

export function CandidateGrid({ carrier }: { carrier: Carrier }) {
  const { evaluations, criteria, currentKHz, showExclusion, nearestClear, locked, apply } = useCandidateModel(carrier);

  if (evaluations.length === 0) {
    return (
      <p className="hint">
        No frequency in this range is inside the band. Widen the band in Setup,
        or reduce the suggestion step.
      </p>
    );
  }


  return (
    <>
      {nearestClear === null && (
        <p className="hint">
          Nothing in this range is completely clear. Widen the search, remove an
          excluded range, or move one of the other transmitters.
        </p>
      )}

      <table className="candidate-grid">
        <caption className="visually-hidden">
          Candidate frequencies for {carrier.label}, each rated against every
          interference test.
        </caption>
        <thead>
          <tr>
            <th scope="col">Frequency (MHz)</th>
            <th scope="col">Δ kHz</th>
            <th scope="col" title={criterionLabel(SPACING_CRITERION)}>
              Spacing
            </th>
            {showExclusion && (
              <th scope="col" title={criterionLabel(EXCLUSION_CRITERION)}>
                Excl.
              </th>
            )}
            {criteria.map((key) => (
              <th key={key} scope="col" title={criterionLabel(key)}>
                {key.replace('O', '')}
              </th>
            ))}
            <th scope="col">Verdict</th>
          </tr>
        </thead>
        <tbody>
          {evaluations.map((evaluation) => {
            const isCurrent = evaluation.freqKHz === currentKHz;
            const isBest = evaluation.freqKHz === nearestClear;
            const classes = ['candidate-row'];
            if (isCurrent) classes.push('candidate-row--current');
            if (isBest) classes.push('candidate-row--best');

            return (
              <tr key={evaluation.freqKHz} className={classes.join(' ')}>
                <th scope="row">
                  <button
                    type="button"
                    className="candidate-pick"
                    disabled={locked || isCurrent}
                    onClick={() => apply(evaluation.freqKHz)}
                  >
                    {kHzToMHzText(evaluation.freqKHz)}
                  </button>
                  {isCurrent && <span className="badge">current</span>}
                  {isBest && <span className="badge badge--good">nearest clear</span>}
                </th>
                <td className="num">
                  {currentKHz === null ? '' : deltaText(evaluation.freqKHz - currentKHz)}
                </td>
                <td>
                  <VerdictDot
                    verdict={evaluation.verdicts[SPACING_CRITERION]}
                    criterion={SPACING_CRITERION}
                  />
                </td>
                {showExclusion && (
                  <td>
                    <VerdictDot
                      verdict={evaluation.verdicts[EXCLUSION_CRITERION]}
                      criterion={EXCLUSION_CRITERION}
                    />
                  </td>
                )}
                {criteria.map((key) => (
                  <td key={key}>
                    <VerdictDot verdict={evaluation.verdicts[key]} criterion={key} />
                  </td>
                ))}
                <td>{explanationText(evaluation.explanation)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}
