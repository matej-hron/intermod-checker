import { useEffect } from 'react';
import { kHzToMHzText } from '../im';
import { useProjectStore } from '../state/projectStore';
import { useTuneStore } from '../state/tuneStore';
import { CandidateGrid } from './CandidateGrid';
import { ContextStrip } from './ContextStrip';

export function TuneView() {
  const carriers = useProjectStore((s) => s.carriers);
  const settings = useProjectStore((s) => s.settings);
  const updateCarrier = useProjectStore((s) => s.updateCarrier);

  const carrierId = useTuneStore((s) => s.carrierId);
  const halfWidthKHz = useTuneStore((s) => s.halfWidthKHz);
  const status = useTuneStore((s) => s.status);
  const fraction = useTuneStore((s) => s.fraction);
  const issues = useTuneStore((s) => s.issues);
  const errorMessage = useTuneStore((s) => s.errorMessage);
  const run = useTuneStore((s) => s.run);
  const widen = useTuneStore((s) => s.widen);

  const carrier = carriers.find((c) => c.id === carrierId) ?? null;

  // Re-evaluate whenever there is a selection but no results — which is the
  // state `select()` leaves behind, and the one `projectStore.update()` leaves
  // behind after a frequency is applied. One effect covers both.
  //
  // Guard on the resolved carrier, not just the id: `tuneStore.clear()` keeps
  // `carrierId` so the grid refreshes after applying a candidate, but a deleted
  // carrier leaves an id that no longer resolves. Firing a worker request for a
  // dead id would surface a spurious error while the view shows "Pick a
  // transmitter".
  useEffect(() => {
    if (carrier === null) return;
    if (status !== 'idle') return;
    void run(carriers, settings);
  }, [carrier, status, carriers, settings, run]);

  if (carriers.length === 0) {
    return (
      <section className="panel">
        <h2>Tune</h2>
        <p className="hint">Add some frequencies first.</p>
      </section>
    );
  }

  return (
    <section className="panel">
      <h2>Tune</h2>
      <ContextStrip />

      {carrier === null ? (
        <p className="hint">Pick a transmitter above to see the frequencies available to it.</p>
      ) : (
        <>
          <p>
            Tuning <strong>{carrier.label}</strong>, currently{' '}
            <strong>{kHzToMHzText(carrier.freqKHz)} MHz</strong>. Showing ±
            {kHzToMHzText(halfWidthKHz)} MHz.
          </p>

          {carrier.locked && (
            <p className="hint">
              This transmitter is locked, so choosing a frequency here will not
              change it.{' '}
              <button
                type="button"
                onClick={() => updateCarrier(carrier.id, { locked: false })}
              >
                Unlock
              </button>
            </p>
          )}

          <div aria-live="polite">
            {status === 'running' && (
              <p>Evaluating candidates… {Math.round(fraction * 100)}%</p>
            )}

            {errorMessage !== null && <p className="error">{errorMessage}</p>}
            {issues.length > 0 && (
              <ul className="error">
                {issues.map((issue, i) => (
                  <li key={i}>{issue.message}</li>
                ))}
              </ul>
            )}
          </div>

          {status === 'done' && (
            <>
              <CandidateGrid carrier={carrier} />
              <button
                type="button"
                onClick={() => void widen(carriers, settings)}
                disabled={halfWidthKHz >= settings.bandMaxKHz - settings.bandMinKHz}
              >
                Widen search
              </button>
            </>
          )}
        </>
      )}
    </section>
  );
}
