import { describe, expect, it } from 'vitest';
import type { Carrier } from '../../im';
import { describeCarrierDevice } from '../carrierSummary';

function carrier(patch: Partial<Carrier> = {}): Carrier {
  return { id: 'c1', label: 'Mic 1', freqKHz: 510000, locked: false, ...patch };
}

describe('describeCarrierDevice', () => {
  it('says so when no device is chosen', () => {
    expect(describeCarrierDevice(carrier())).toBe('No device');
  });

  it('names brand and model', () => {
    expect(describeCarrierDevice(carrier({ deviceId: 'sound-devices-a10' }))).toBe(
      'Sound Devices A10',
    );
  });

  it('appends the mode only when the device offers a choice', () => {
    expect(describeCarrierDevice(carrier({ deviceId: 'wisycom-mtp60' }))).toContain('Wide band');
    expect(describeCarrierDevice(carrier({ deviceId: 'sound-devices-a10' }))).not.toContain('·');
  });

  it('follows the selected mode', () => {
    const narrow = carrier({ deviceId: 'wisycom-mtp60', modeId: 'narrow' });
    expect(describeCarrierDevice(narrow)).toContain('Narrow band');
  });

  it('appends power when it is set', () => {
    const c = carrier({ deviceId: 'wisycom-mtp60', powerMW: 50 });
    expect(describeCarrierDevice(c)).toBe('Wisycom MTP60 · Wide band · 50 mW');
  });

  it('ignores a device the catalogue does not know', () => {
    expect(describeCarrierDevice(carrier({ deviceId: 'nope' }))).toBe('No device');
  });
});
