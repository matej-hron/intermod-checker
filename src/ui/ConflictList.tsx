import { useState } from 'react';
import { formatProduct, kHzToMHzText, type Hit } from '../im';
import { useAnalysisStore } from '../state/analysisStore';
import { useProjectStore } from '../state/projectStore';

function HitRow({ hit }: { hit: Hit }) {
  return (
    <li>
      <code>{formatProduct(hit.product.coeffs)}</code>{' '}
      = {kHzToMHzText(hit.product.freqKHz)} MHz{' '}
      <span className={`badge badge--${hit.severity}`}>
        order {hit.product.order}
      </span>{' '}
      {hit.kind === 'exact'
        ? 'direct hit'
        : `${hit.offsetKHz} kHz away`}
      {hit.selfInvolving && <span className="badge"> self-mixing</span>}
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

      {carriers.map((carrier) => {
        const all = result.hitsByCarrierId[carrier.id] ?? [];
        const hits = showSelf ? all : all.filter((h) => !h.selfInvolving);
        const isOpen = expanded === carrier.id;

        return (
          <div key={carrier.id} className="conflict">
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() => setExpanded(isOpen ? null : carrier.id)}
            >
              {carrier.label} — {kHzToMHzText(carrier.freqKHz)} MHz —{' '}
              {hits.length === 0 ? 'clear' : `${hits.length} product(s)`}
            </button>
            {isOpen && hits.length > 0 && (
              <ul>
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
          </div>
        );
      })}
    </section>
  );
}
