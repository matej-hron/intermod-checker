import { kHzToMHzText } from '../im';
import { useProjectStore } from '../state/projectStore';
import { MHzInput } from './MHzInput';

export function ExclusionEditor() {
  const settings = useProjectStore((s) => s.settings);
  const addExclusion = useProjectStore((s) => s.addExclusion);
  const updateExclusion = useProjectStore((s) => s.updateExclusion);
  const removeExclusion = useProjectStore((s) => s.removeExclusion);

  return (
    <div className="exclusions">
      <h3>Excluded ranges</h3>
      <p className="hint">
        Frequencies inside these ranges are never offered — use them for local
        TV broadcast, in-ear monitors, intercom, or any block you must keep
        clear. Interference products landing inside an excluded range are
        ignored, because nothing of yours is listening there.
      </p>

      {settings.exclusions.length === 0 ? (
        <p className="hint">No excluded ranges. The whole band is available.</p>
      ) : (
        <table className="freq-table">
          <thead>
            <tr>
              <th>Label</th>
              <th>From (MHz)</th>
              <th>To (MHz)</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {settings.exclusions.map((exclusion, index) => (
              <tr key={exclusion.id}>
                <td>
                  <input
                    aria-label={`Label for excluded range ${index + 1}`}
                    value={exclusion.label}
                    onChange={(e) =>
                      updateExclusion(exclusion.id, { label: e.target.value })
                    }
                  />
                </td>
                <td>
                  <MHzInput
                    label={`Start of excluded range ${index + 1} in megahertz`}
                    valueKHz={exclusion.startKHz}
                    onCommit={(startKHz) => updateExclusion(exclusion.id, { startKHz })}
                  />
                </td>
                <td>
                  <MHzInput
                    label={`End of excluded range ${index + 1} in megahertz`}
                    valueKHz={exclusion.endKHz}
                    onCommit={(endKHz) => updateExclusion(exclusion.id, { endKHz })}
                  />
                </td>
                <td>
                  <button
                    type="button"
                    onClick={() => removeExclusion(exclusion.id)}
                    aria-label={`Remove excluded range ${index + 1}`}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <button type="button" onClick={addExclusion}>
        Add excluded range
      </button>
      <p className="hint">
        Band: {kHzToMHzText(settings.bandMinKHz)}–{kHzToMHzText(settings.bandMaxKHz)} MHz.
      </p>
    </div>
  );
}
