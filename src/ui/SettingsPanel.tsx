import { DEFAULT_SETTINGS, kHzToMHzText } from '../im';
import { useProjectStore } from '../state/projectStore';
import { MHzInput } from './MHzInput';
import { ExclusionEditor } from './ExclusionEditor';

// A <select> whose value matches no option silently renders the first one, so
// an imported project could display an order the engine is not using. Fold any
// unlisted value into the list instead.
function orderOptions(preset: number[], current: number): number[] {
  return preset.includes(current)
    ? preset
    : [...preset, current].sort((a, b) => a - b);
}

export function SettingsPanel() {
  const settings = useProjectStore((s) => s.settings);
  const setSettings = useProjectStore((s) => s.setSettings);
  const resetSettings = useProjectStore((s) => s.resetSettings);

  return (
    <details className="panel settings">
      <summary className="settings__summary">
        <h2>Analysis settings</h2>
        <span className="hint">
          {kHzToMHzText(settings.bandMinKHz)}–{kHzToMHzText(settings.bandMaxKHz)} MHz
          {' · '}orders {settings.lowOrder}–{settings.highOrder}
          {' · '}{settings.minSpacingKHz} kHz spacing
        </span>
      </summary>
      <div className="settings__body">
        <div className="field-group field-group--band">
          <div className="field-group__field">
            <label htmlFor="band-start">Band start (MHz)</label>
            <MHzInput
              id="band-start"
              label="Band start in megahertz"
              valueKHz={settings.bandMinKHz}
              onCommit={(bandMinKHz) => setSettings({ bandMinKHz })}
            />
          </div>

          <div className="field-group__field">
            <label htmlFor="band-end">Band end (MHz)</label>
            <MHzInput
              id="band-end"
              label="Band end in megahertz"
              valueKHz={settings.bandMaxKHz}
              onCommit={(bandMaxKHz) => setSettings({ bandMaxKHz })}
            />
          </div>
        </div>

        <div className="field-group field-group--order">
          <label>
            Lowest order
            <select
              value={settings.lowOrder}
              onChange={(e) => setSettings({ lowOrder: Number(e.target.value) })}
            >
              {orderOptions([2, 3, 5, 7], settings.lowOrder).map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </label>

          <label>
            Highest order
            <select
              value={settings.highOrder}
              onChange={(e) => {
                const value = Number(e.target.value);
                if (
                  value >= 7 &&
                  !window.confirm(
                    'Orders of 7 and above enumerate millions of products and can take a long time. Continue?',
                  )
                ) {
                  return;
                }
                setSettings({ highOrder: value });
              }}
            >
              {orderOptions([3, 5, 7, 9], settings.highOrder).map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </label>

          <label>
            <input
              type="checkbox"
              checked={settings.oddOnly}
              onChange={(e) => setSettings({ oddOnly: e.target.checked })}
            />
            Odd orders only
          </label>
        </div>

        <label>
          Near-hit window (kHz)
          <input
            type="number"
            min={0}
            value={settings.nearHitWindowKHz}
            onChange={(e) =>
              setSettings({ nearHitWindowKHz: Number(e.target.value) })
            }
          />
        </label>

        <label>
          Peak deviation for carriers with no device (kHz)
          <input
            type="number"
            min={0}
            value={settings.deviationKHz}
            onChange={(e) => setSettings({ deviationKHz: Number(e.target.value) })}
          />
        </label>
        <p className="hint">
          Carriers that name a device take their deviation from it and ignore this
          setting.
        </p>

        <div className="field-group field-group--spacing">
          <label>
            Minimum spacing (kHz)
            <input
              type="number"
              min={0}
              value={settings.minSpacingKHz}
              onChange={(e) => setSettings({ minSpacingKHz: Number(e.target.value) })}
            />
          </label>

          <label>
            Suggestion step (kHz)
            <input
              type="number"
              min={1}
              value={settings.suggestionStepKHz}
              onChange={(e) =>
                setSettings({ suggestionStepKHz: Number(e.target.value) })
              }
            />
          </label>
        </div>

        <ExclusionEditor />

        <button type="button" onClick={resetSettings}>
          Reset to defaults ({DEFAULT_SETTINGS.lowOrder}–{DEFAULT_SETTINGS.highOrder}
          {' '}order, {DEFAULT_SETTINGS.nearHitWindowKHz} kHz window)
        </button>
      </div>
    </details>
  );
}
