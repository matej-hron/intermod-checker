import {
  EXCLUSION_CRITERION,
  SPACING_CRITERION,
  criterionLabel,
  explanationText,
  kHzToMHzText,
  type Carrier,
} from '../im';
import { useAnalysisStore } from '../state/analysisStore';
import { useProjectStore } from '../state/projectStore';
import { useTuneStore } from '../state/tuneStore';
import { VerdictDot } from './VerdictDot';

function deltaText(offsetKHz: number): string {
  if (offsetKHz === 0) return '0';
  return offsetKHz > 0 ? `+${offsetKHz}` : `${offsetKHz}`;
}

export function CandidateGrid({ carrier }: { carrier: Carrier }) {
  const settings = useProjectStore((s) => s.settings);
  const updateCarrier = useProjectStore((s) => s.updateCarrier);
  const evaluations = useTuneStore((s) => s.evaluations);
  const criteria = useTuneStore((s) => s.criteria);
  const currentKHz = useTuneStore((s) => s.currentKHz);

  const showExclusion = settings.exclusions.length > 0;

  if (evaluations.length === 0) {
    return (
      <p className="hint">
        No frequency in this range is inside the band. Widen the band in Setup,
        or reduce the suggestion step.
      </p>
    );
  }

  // Evaluations arrive sorted by ascending frequency, which is how a spectrum
  // reads; the Δ column carries the distance that nearest-first ordering would
  // otherwise convey.
  let bestKHz: number | null = null;
  for (const evaluation of evaluations) {
    if (evaluation.worst !== 'clear') continue;
    if (currentKHz !== null && evaluation.freqKHz === currentKHz) continue;
    if (
      bestKHz === null ||
      (currentKHz !== null &&
        Math.abs(evaluation.freqKHz - currentKHz) < Math.abs(bestKHz - currentKHz))
    ) {
      bestKHz = evaluation.freqKHz;
    }
  }

  const apply = (freqKHz: number): void => {
    if (carrier.locked) return;
    updateCarrier(carrier.id, { freqKHz });
    // A displayed verdict must always describe the real configuration, so the
    // analysis is re-run against the frequencies that are now actually set.
    const { carriers, settings: next } = useProjectStore.getState();
    void useAnalysisStore.getState().run(carriers, next);
  };

  return (
    <>
      {bestKHz === null && (
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
            const isBest = evaluation.freqKHz === bestKHz;
            const classes = ['candidate-row'];
            if (isCurrent) classes.push('candidate-row--current');
            if (isBest) classes.push('candidate-row--best');

            return (
              <tr key={evaluation.freqKHz} className={classes.join(' ')}>
                <th scope="row">
                  <button
                    type="button"
                    className="candidate-pick"
                    disabled={carrier.locked || isCurrent}
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
