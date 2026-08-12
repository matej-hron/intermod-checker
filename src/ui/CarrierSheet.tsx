import { useEffect, useRef } from 'react';
import { useProjectStore } from '../state/projectStore';
import { useViewStore } from '../state/viewStore';
import { MHzInput } from './MHzInput';
import { DevicePicker } from './DevicePicker';

export function CarrierSheet() {
  const carriers = useProjectStore((s) => s.carriers);
  const updateCarrier = useProjectStore((s) => s.updateCarrier);
  const deleteCarrier = useProjectStore((s) => s.deleteCarrierWithUndo);
  const editingId = useViewStore((s) => s.editingCarrierId);
  const closeCarrier = useViewStore((s) => s.closeCarrier);
  const openTune = useViewStore((s) => s.openTune);

  const dialog = useRef<HTMLDialogElement>(null);

  const carrier = carriers.find((c) => c.id === editingId) ?? null;

  useEffect(() => {
    const el = dialog.current;
    if (el === null) return;
    if (carrier !== null && !el.open) el.showModal();
    if (carrier === null && el.open) el.close();
  }, [carrier]);

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
