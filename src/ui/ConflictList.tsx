import { useState } from 'react';
import { carrierLetter, formatProduct, kHzToMHzText, type Hit, type Severity } from '../im';
import { useAnalysisStore } from '../state/analysisStore';
import { useProjectStore } from '../state/projectStore';

/**
 * A formula reads "2A - B", so it is meaningless without knowing which device is
 * A. Only the carriers this product actually mixes are named, to keep the key
 * short on a phone.
 */
function contributors(coeffs: readonly number[], labels: readonly string[]): string {
  const parts: string[] = [];
  for (let i = 0; i < coeffs.length; i += 1) {
    if (coeffs[i] !== 0 && labels[i] !== undefined) {
      parts.push(`${carrierLetter(i)} = ${labels[i]}`);
    }
  }
  return parts.join(' · ');
}

const SEVERITY_WEIGHT: Record<Severity, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

const SEVERITY_TEXT: Record<Severity, string> = {
  high: 'High severity',
  medium: 'Medium severity',
  low: 'Low severity',
};

function worseHit(current: Hit | null, hit: Hit): Hit {
  if (current === null) return hit;
  return SEVERITY_WEIGHT[hit.severity] > SEVERITY_WEIGHT[current.severity]
    ? hit
    : current;
}

function HitRow({ hit, labels }: { hit: Hit; labels: readonly string[] }) {
  return (
    <li className={`conflict conflict--${hit.severity}`}>
      <div className="conflict__head">
        <span className={`badge badge--${hit.severity}`}>
          {SEVERITY_TEXT[hit.severity]}
        </span>
        <span className={`badge badge--${hit.severity}`}>
          order {hit.product.order}
        </span>
        {kHzToMHzText(hit.product.freqKHz)} MHz
        {hit.kind === 'exact' ? ' direct hit' : ` ${hit.offsetKHz} kHz away`}
        {hit.selfInvolving && <span className="badge"> self-mixing</span>}
      </div>
      <div className="conflict__detail">
        <code>{formatProduct(hit.product.coeffs)}</code>
        <span className="hint conflict__key">
          {contributors(hit.product.coeffs, labels)}
        </span>
      </div>
    </li>
  );
}

export function ConflictList() {
  const result = useAnalysisStore((s) => s.result);
  const carriers = useProjectStore((s) => s.carriers);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showSelf, setShowSelf] = useState(false);

  if (result === null) return null;

  const labels = carriers.map((c) => c.label);

  return (
    <section className="panel">
      <h2>Details</h2>
      <label>
        <input
          type="checkbox"
          checked={showSelf}
          onChange={(e) => setShowSelf(e.target.checked)}
        />
        Show products the carrier itself contributes to
      </label>

      <ul className="conflict-list">
        {carriers.map((carrier) => {
          const all = result.hitsByCarrierId[carrier.id] ?? [];
          const hits = showSelf ? all : all.filter((h) => !h.selfInvolving);
          const isOpen = expanded === carrier.id;
          const worst = hits.reduce<Hit | null>(worseHit, null);
          const classes = ['conflict'];
          if (worst !== null) classes.push(`conflict--${worst.severity}`);

          return (
            <li key={carrier.id} className={classes.join(' ')}>
              <div className="conflict__head">
                <button
                  type="button"
                  className="conflict__summary"
                  aria-expanded={isOpen}
                  onClick={() => setExpanded(isOpen ? null : carrier.id)}
                >
                  <span>
                    {carrier.label} — {kHzToMHzText(carrier.freqKHz)} MHz —{' '}
                    {hits.length === 0 ? 'clear' : `${hits.length} product(s)`}
                  </span>
                  {worst !== null && (
                    <span className={`badge badge--${worst.severity}`}>
                      {SEVERITY_TEXT[worst.severity]}
                    </span>
                  )}
                </button>
              </div>
              {isOpen && hits.length > 0 && (
                <ul className="conflict-list conflict__detail">
                  {hits
                    .slice()
                    .sort((a, b) => a.product.order - b.product.order)
                    .slice(0, 100)
                    .map((hit, i) => (
                      <HitRow key={i} hit={hit} labels={labels} />
                    ))}
                </ul>
              )}
              {isOpen && hits.length > 100 && (
                <p className="hint">Showing the 100 lowest-order products.</p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
