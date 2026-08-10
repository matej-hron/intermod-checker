import { criterionLabel, type CriterionKey, type Verdict } from '../im';

const VERDICT_TEXT: Record<Verdict, string> = {
  clear: 'clear',
  near: 'near miss',
  exact: 'direct hit',
};

/**
 * Colour is never the only signal: the three verdicts differ in shape (hollow,
 * ring, filled) and each dot carries a text label for assistive technology.
 */
export function VerdictDot({
  verdict,
  criterion,
}: {
  verdict: Verdict;
  criterion: CriterionKey;
}) {
  return (
    <span className={`dot dot--${verdict}`}>
      <span className="visually-hidden">
        {criterionLabel(criterion)}: {VERDICT_TEXT[verdict]}
      </span>
    </span>
  );
}
