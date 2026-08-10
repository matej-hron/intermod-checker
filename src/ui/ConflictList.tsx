import { useState } from 'react';
import { carrierLetter, formatProduct, kHzToMHzText, type Hit } from '../im';
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

function HitRow({ hit, labels }: { hit: Hit; labels: readonly string[] }) {
  return (
    <li className="conflict">
      <div className="conflict__head">
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

          return (
            <li key={carrier.id} className="conflict">
              <div className="conflict__head">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setExpanded(isOpen ? null : carrier.id)}
                >
                  {carrier.label} — {kHzToMHzText(carrier.freqKHz)} MHz —{' '}
                  {hits.length === 0 ? 'clear' : `${hits.length} product(s)`}
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
