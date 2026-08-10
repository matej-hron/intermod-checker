import { useState } from 'react';
import { formatProduct, kHzToMHzText, type Hit } from '../im';
import { useAnalysisStore } from '../state/analysisStore';
import { useProjectStore } from '../state/projectStore';

function HitRow({ hit }: { hit: Hit }) {
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
                      <HitRow key={i} hit={hit} />
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
