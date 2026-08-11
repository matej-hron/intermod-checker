import { DEVICES, findDevice, findMode, formatModeWidth, type Carrier } from '../im';
import { useProjectStore } from '../state/projectStore';

const NO_DEVICE = '';

export function DevicePicker({ carrier }: { carrier: Carrier }) {
  const updateCarrier = useProjectStore((s) => s.updateCarrier);
  const device = findDevice(carrier.deviceId);
  const mode = device === null ? null : findMode(device, carrier.modeId);

  const brands = [...new Set(DEVICES.map((d) => d.brand))];

  return (
    <div className="device">
      <label className="device__field">
        <span className="device__label">Device</span>
        <select
          value={carrier.deviceId ?? NO_DEVICE}
          onChange={(e) => {
            const next = findDevice(e.target.value || undefined);
            // The old power and mode belong to the old device, so they are
            // cleared rather than carried onto gear that may not offer them.
            updateCarrier(carrier.id, {
              deviceId: next?.id,
              modeId: undefined,
              powerMW: undefined,
            });
          }}
        >
          <option value={NO_DEVICE}>No device</option>
          {brands.map((brand) => (
            <optgroup key={brand} label={brand}>
              {DEVICES.filter((d) => d.brand === brand).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.model}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>

      {device !== null && device.powersMW.length > 1 && (
        <label className="device__field">
          <span className="device__label">Power</span>
          <select
            value={carrier.powerMW ?? NO_DEVICE}
            onChange={(e) =>
              updateCarrier(carrier.id, {
                powerMW: e.target.value === NO_DEVICE ? undefined : Number(e.target.value),
              })
            }
          >
            <option value={NO_DEVICE}>Not set</option>
            {device.powersMW.map((mw) => (
              <option key={mw} value={mw}>
                {mw} mW
              </option>
            ))}
          </select>
        </label>
      )}

      {device !== null && device.modes.length > 1 && (
        <label className="device__field">
          <span className="device__label">Mode</span>
          <select
            value={mode!.id}
            onChange={(e) => updateCarrier(carrier.id, { modeId: e.target.value })}
          >
            {device.modes.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
      )}

      {device !== null && mode !== null && (
        <p className="device__width">
          {formatModeWidth(mode)}
          {device.modulation === 'digital' && (
            <span className="device__note"> · digital, width not FM deviation</span>
          )}
        </p>
      )}
    </div>
  );
}
