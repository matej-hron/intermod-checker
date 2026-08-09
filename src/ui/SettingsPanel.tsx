import { DEFAULT_SETTINGS, kHzToMHzText, mhzToKHz, parseFrequencyMHz } from '../im';
import { useProjectStore } from '../state/projectStore';

export function SettingsPanel() {
  const settings = useProjectStore((s) => s.settings);
  const setSettings = useProjectStore((s) => s.setSettings);
  const resetSettings = useProjectStore((s) => s.resetSettings);

  const commitMHz = (text: string, key: 'bandMinKHz' | 'bandMaxKHz'): void => {
    const parsed = parseFrequencyMHz(text);
    if (parsed === null) return;
    const khz = mhzToKHz(parsed);
    setSettings(key === 'bandMinKHz' ? { bandMinKHz: khz } : { bandMaxKHz: khz });
  };

  return (
    <section className="panel">
      <h2>Analysis settings</h2>

      <label>
        Band start (MHz)
        <input
          defaultValue={kHzToMHzText(settings.bandMinKHz)}
          onBlur={(e) => commitMHz(e.target.value, 'bandMinKHz')}
        />
      </label>

      <label>
        Band end (MHz)
        <input
          defaultValue={kHzToMHzText(settings.bandMaxKHz)}
          onBlur={(e) => commitMHz(e.target.value, 'bandMaxKHz')}
        />
      </label>

      <label>
        Lowest order
        <select
          value={settings.lowOrder}
          onChange={(e) => setSettings({ lowOrder: Number(e.target.value) })}
        >
          {[2, 3, 5, 7].map((o) => (
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
          {[3, 5, 7, 9].map((o) => (
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
        Peak deviation (kHz)
        <input
          type="number"
          min={0}
          value={settings.deviationKHz}
          onChange={(e) => setSettings({ deviationKHz: Number(e.target.value) })}
        />
      </label>

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

      <button type="button" onClick={resetSettings}>
        Reset to defaults ({DEFAULT_SETTINGS.lowOrder}–{DEFAULT_SETTINGS.highOrder}
        {' '}order, {DEFAULT_SETTINGS.nearHitWindowKHz} kHz window)
      </button>
    </section>
  );
}
