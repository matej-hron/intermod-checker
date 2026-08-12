import { findDevice, findMode, type Carrier } from '../im';

const SEP = ' · ';

/**
 * The second line of a carrier row: what this microphone is, in the fewest
 * words that stay unambiguous. The mode appears only where the device offers a
 * choice, because "A10 · Digital" would suggest a setting the user could have
 * got wrong.
 */
export function describeCarrierDevice(carrier: Carrier): string {
  const device = findDevice(carrier.deviceId);
  if (device === null) return 'No device';

  const parts = [`${device.brand} ${device.model}`];

  if (device.modes.length > 1) {
    // findMode never returns null — it falls back to the device's first mode —
    // so the caller must not test for one.
    parts.push(findMode(device, carrier.modeId).label);
  }
  if (carrier.powerMW !== undefined) parts.push(`${carrier.powerMW} mW`);

  return parts.join(SEP);
}
