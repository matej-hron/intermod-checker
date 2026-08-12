import { useEffect, useRef, useState } from 'react';
import { useProjectStore } from '../state/projectStore';
import { useViewStore } from '../state/viewStore';
import { kHzToMHzText, liveCheck, type LiveCheckResult } from '../im';
import { MHzInput } from './MHzInput';
import { DevicePicker } from './DevicePicker';

export function CarrierSheet() {
  const carriers = useProjectStore((s) => s.carriers);
  const updateCarrier = useProjectStore((s) => s.updateCarrier);
  const deleteCarrier = useProjectStore((s) => s.deleteCarrierWithUndo);
  const editingId = useViewStore((s) => s.editingCarrierId);
  const closeCarrier = useViewStore((s) => s.closeCarrier);
  const openTune = useViewStore((s) => s.openTune);

  const settings = useProjectStore((s) => s.settings);

  const dialog = useRef<HTMLDialogElement>(null);

  const carrier = carriers.find((c) => c.id === editingId) ?? null;

  useEffect(() => {
    const el = dialog.current;
    if (el === null) return;
    if (carrier !== null && !el.open) el.showModal();
    if (carrier === null && el.open) el.close();
  }, [carrier]);

  const [check, setCheck] = useState<LiveCheckResult | null>(null);

  const carrierId = carrier?.id ?? null;
  const freqKHz = carrier?.freqKHz ?? null;

  useEffect(() => {
    if (carrierId === null || freqKHz === null) {
      setCheck(null);
      return;
    }
    const timer = setTimeout(() => {
      setCheck(liveCheck(carriers, settings, carrierId, freqKHz));
    }, 200);
    return () => clearTimeout(timer);
  }, [carriers, settings, carrierId, freqKHz]);

  if (carrier === null) return null;

  return (
    <dialog
      ref={dialog}
      className="sheet sheet--tall"
      aria-label={`Edit ${carrier.label}`}
      onClose={closeCarrier}
    >
      <div className="sheet__body">
        <h2>Edit frequency</h2>

        <label className="field">
          Name
          <input
            value={carrier.label}
            onChange={(e) => updateCarrier(carrier.id, { label: e.target.value })}
          />
        </label>

        <label className="field">
          Frequency
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <MHzInput
              label={`Frequency for ${carrier.label} in megahertz`}
              valueKHz={carrier.freqKHz}
              onCommit={(khz) => updateCarrier(carrier.id, { freqKHz: khz })}
            />
            <span aria-hidden="true">MHz</span>
          </div>
        </label>

        {check !== null && (
          <div className="live-check">
            {check.verdict === 'clear' ? (
              <p className="live-check__line">
                <span className="dot dot--clear">
                  <span className="visually-hidden">Clear</span>
                </span>
                Clear — nothing lands here.
              </p>
            ) : (
              <>
                <p className="live-check__line">
                  <span className={`dot dot--${check.verdict}`}>
                    <span className="visually-hidden">
                      {check.verdict === 'exact' ? 'Direct hit' : 'Near miss'}
                    </span>
                  </span>
                  Conflicts: {check.explanation}
                </p>
                {check.alternatives.length > 0 ? (
                  <p className="live-check__alts">
                    <span className="live-check__alts-label">Nearest clear:</span>
                    {check.alternatives.map((khz) => (
                      <button
                        key={khz}
                        type="button"
                        className="live-check__chip"
                        aria-label={`Use ${kHzToMHzText(khz)} megahertz`}
                        onClick={() => updateCarrier(carrier.id, { freqKHz: khz })}
                      >
                        {kHzToMHzText(khz)}
                      </button>
                    ))}
                  </p>
                ) : (
                  <p className="live-check__none">
                    No clear frequency within 0.5 MHz — open Tune to search wider.
                  </p>
                )}
              </>
            )}
          </div>
        )}

        <DevicePicker carrier={carrier} />

        <label className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 'var(--space-3)' }}>
          <input
            type="checkbox"
            checked={carrier.locked}
            onChange={(e) => updateCarrier(carrier.id, { locked: e.target.checked })}
            aria-label={`Lock the frequency of ${carrier.label}`}
          />
          Lock frequency
        </label>

        <button
          type="button"
          onClick={() => openTune(carrier.id)}
        >
          Tune this frequency
        </button>

        <button
          type="button"
          className="btn--ghost"
          // The sheet closes on its own: the carrier it is bound to is gone,
          // which trips the existing `carrier === null` return.
          onClick={() => deleteCarrier(carrier.id)}
        >
          Delete
        </button>

        <button
          type="button"
          className="btn--primary"
          onClick={() => dialog.current?.close()}
        >
          Done
        </button>
      </div>
    </dialog>
  );
}
