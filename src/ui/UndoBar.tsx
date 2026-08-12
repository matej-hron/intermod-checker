import { useEffect } from 'react';
import { useProjectStore } from '../state/projectStore';
import { useViewStore } from '../state/viewStore';

/** How long the user has to change their mind, in milliseconds. */
const UNDO_WINDOW_MS = 5000;

/**
 * The way back from a deletion.
 *
 * A confirmation dialog would tax every deletion to protect against the rare
 * mistaken one; this taxes none and still covers the mistake. It is a
 * `role="status"` region so screen readers announce it without stealing focus
 * from wherever the user is.
 */
export function UndoBar() {
  const pending = useViewStore((s) => s.pendingDelete);
  const clearPendingDelete = useViewStore((s) => s.clearPendingDelete);
  const restoreCarrier = useProjectStore((s) => s.restoreCarrier);

  const token = pending?.token ?? null;

  useEffect(() => {
    if (token === null) return;
    // Keyed on `token`, not on `pending`: deleting a second mic restarts the
    // full window rather than inheriting what was left of the first.
    const timer = setTimeout(clearPendingDelete, UNDO_WINDOW_MS);
    return () => clearTimeout(timer);
  }, [token, clearPendingDelete]);

  if (pending === null) return null;

  return (
    <div className="undo-bar" role="status">
      <span className="undo-bar__text">Deleted {pending.carrier.label}</span>
      <button
        type="button"
        className="undo-bar__action"
        onClick={() => {
          restoreCarrier(pending.carrier, pending.index);
          clearPendingDelete();
        }}
      >
        Undo
      </button>
    </div>
  );
}
