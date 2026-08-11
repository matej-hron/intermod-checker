import { describe, expect, it } from 'vitest';
import { DEVICES, findDevice, findMode, formatModeWidth } from '../devices';

describe('the catalogue', () => {
  it('has a unique id for every device', () => {
    const ids = DEVICES.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every device at least one mode and at least one power option', () => {
    for (const device of DEVICES) {
      expect(device.modes.length).toBeGreaterThan(0);
      expect(device.powersMW.length).toBeGreaterThan(0);
    }
  });

  it('quotes a width that is exactly twice the peak deviation', () => {
    for (const device of DEVICES) {
      for (const mode of device.modes) {
        expect(mode.widthHz).toBe(mode.deviationHz * 2);
      }
    }
  });

  it('lists power options in ascending order', () => {
    for (const device of DEVICES) {
      const sorted = [...device.powersMW].sort((a, b) => a - b);
      expect(device.powersMW).toEqual(sorted);
    }
  });

  it('contains exactly 9 devices', () => {
    expect(DEVICES.length).toBe(9);
  });

  it('pins the deviation figure for every device not covered by an earlier spot-check', () => {
    // Expected values taken from the task-1-brief table, not from the code.
    const cases: [id: string, deviationHz: number][] = [
      ['wisycom-mtp41',     28000],
      ['wisycom-mtb40s',    28000],
      ['sennheiser-5212',   28000],
      ['sennheiser-evolution', 24000],
      ['lectrosonics-us',   70000],
    ];
    for (const [id, expected] of cases) {
      const device = findDevice(id);
      expect(device, `device ${id} should exist`).not.toBeNull();
      expect(device!.modes[0].deviationHz, `${id} deviationHz`).toBe(expected);
    }
  });

  it('carries the narrow Wisycom mode at a deviation kilohertz cannot express', () => {
    const mtp60 = findDevice('wisycom-mtp60');
    expect(mtp60).not.toBeNull();
    const narrow = mtp60!.modes.find((m) => m.id === 'narrow');
    expect(narrow?.deviationHz).toBe(17500);
  });
});

describe('findDevice', () => {
  it('returns null for an unknown or absent id', () => {
    expect(findDevice('nope')).toBeNull();
    expect(findDevice(undefined)).toBeNull();
  });

  it('finds a device by id', () => {
    expect(findDevice('sound-devices-a10')?.model).toBe('A10');
  });
});

describe('findMode', () => {
  it('falls back to the first mode when the id is unknown or absent', () => {
    const device = findDevice('wisycom-mtp60')!;
    expect(findMode(device, undefined).id).toBe('wide');
    expect(findMode(device, 'nonsense').id).toBe('wide');
  });

  it('finds the named mode', () => {
    const device = findDevice('wisycom-mtp60')!;
    expect(findMode(device, 'narrow').deviationHz).toBe(17500);
  });
});

describe('formatModeWidth', () => {
  it('renders a whole-kilohertz deviation without a decimal point', () => {
    const device = findDevice('wisycom-mtp40')!;
    expect(formatModeWidth(findMode(device, 'wide'))).toBe('±28 kHz · 56 kHz wide');
  });

  it('renders a half-kilohertz deviation with one decimal place', () => {
    const device = findDevice('wisycom-mtp60')!;
    expect(formatModeWidth(findMode(device, 'narrow'))).toBe(
      '±17.5 kHz · 35 kHz wide',
    );
  });
});

import { carrierDeviationsHz, resolveDeviationHz, resolveScanDeviationsHz } from '../devices';
import { DEFAULT_SETTINGS, type Carrier } from '../types';

function carrier(id: string, extra: Partial<Carrier> = {}): Carrier {
  return { id, label: id, freqKHz: 500000, locked: false, ...extra };
}

describe('resolveDeviationHz', () => {
  // This is the definitive kHz→Hz conversion proof: 12 kHz must become 12 000 Hz.
  it('converts the global deviationKHz setting to Hz when falling back', () => {
    const settings = { ...DEFAULT_SETTINGS, deviationKHz: 12 };
    expect(resolveDeviationHz(carrier('a'), settings)).toBe(12000);
  });

  // Backward-compatibility guarantee: DEFAULT_SETTINGS.deviationKHz is 0, so
  // every project saved before this feature existed still produces 0 Hz here.
  // (Unit-conversion correctness is covered by the non-zero case above.)
  it('resolves to zero with default settings, preserving pre-existing project results', () => {
    expect(resolveDeviationHz(carrier('a'), DEFAULT_SETTINGS)).toBe(0);
  });

  it('takes the deviation from the device and mode', () => {
    const c = carrier('a', { deviceId: 'wisycom-mtp60', modeId: 'narrow' });
    expect(resolveDeviationHz(c, DEFAULT_SETTINGS)).toBe(17500);
  });

  it('uses the first mode when none is named', () => {
    const c = carrier('a', { deviceId: 'wisycom-mtp60' });
    expect(resolveDeviationHz(c, DEFAULT_SETTINGS)).toBe(28000);
  });

  it('falls back to the global setting for an unknown device', () => {
    const settings = { ...DEFAULT_SETTINGS, deviationKHz: 9 };
    const c = carrier('a', { deviceId: 'not-a-device' });
    expect(resolveDeviationHz(c, settings)).toBe(9000);
  });

  it('ignores the power option entirely', () => {
    const a = carrier('a', { deviceId: 'wisycom-mtp41', powerMW: 10 });
    const b = carrier('b', { deviceId: 'wisycom-mtp41', powerMW: 100 });
    expect(resolveDeviationHz(a, DEFAULT_SETTINGS)).toBe(
      resolveDeviationHz(b, DEFAULT_SETTINGS),
    );
  });
});

describe('carrierDeviationsHz', () => {
  it('returns null when every carrier shares one deviation', () => {
    const carriers = [carrier('a'), carrier('b')];
    expect(carrierDeviationsHz(carriers, DEFAULT_SETTINGS)).toBeNull();
  });

  it('returns null when every carrier names the same device and mode', () => {
    const carriers = [
      carrier('a', { deviceId: 'wisycom-mtp40' }),
      carrier('b', { deviceId: 'wisycom-mtp40', modeId: 'wide' }),
    ];
    expect(carrierDeviationsHz(carriers, DEFAULT_SETTINGS)).toBeNull();
  });

  it('returns one entry per carrier when the fleet is mixed', () => {
    const carriers = [
      carrier('a', { deviceId: 'wisycom-mtp40' }),
      carrier('b', { deviceId: 'sound-devices-a10' }),
    ];
    expect(carrierDeviationsHz(carriers, DEFAULT_SETTINGS)).toEqual([
      28000, 100000,
    ]);
  });

  it('returns null for an empty fleet', () => {
    expect(carrierDeviationsHz([], DEFAULT_SETTINGS)).toBeNull();
  });
});

describe('resolveScanDeviationsHz', () => {
  it('returns null for an empty fleet', () => {
    expect(resolveScanDeviationsHz([], DEFAULT_SETTINGS)).toBeNull();
  });

  it('returns null for a single device-less carrier (legacy fast path)', () => {
    expect(resolveScanDeviationsHz([carrier('a')], DEFAULT_SETTINGS)).toBeNull();
  });

  it('returns the device deviation for a single carrier with a device', () => {
    const c = carrier('a', { deviceId: 'sound-devices-a10' });
    expect(resolveScanDeviationsHz([c], DEFAULT_SETTINGS)).toEqual([100000]);
  });

  it('does NOT return null for a uniform fleet of real devices', () => {
    // carrierDeviationsHz collapses this to null, but the shared 28 kHz device
    // deviation differs from the 0 Hz global setting, so the scan must widen its
    // window by 28 kHz rather than fall back to the floor.
    const carriers = [
      carrier('a', { deviceId: 'wisycom-mtp40' }),
      carrier('b', { deviceId: 'wisycom-mtp40' }),
    ];
    expect(resolveScanDeviationsHz(carriers, DEFAULT_SETTINGS)).toEqual([
      28000, 28000,
    ]);
  });

  it('returns null for a legacy fleet with a non-zero global deviation', () => {
    // No devices: the shared deviation IS the global setting, so the fast path
    // survives and every product uses order × deviation.
    const settings = { ...DEFAULT_SETTINGS, deviationKHz: 12 };
    const carriers = [carrier('a'), carrier('b'), carrier('c')];
    expect(resolveScanDeviationsHz(carriers, settings)).toBeNull();
  });

  it('returns one entry per carrier when the fleet is mixed', () => {
    const carriers = [
      carrier('a', { deviceId: 'wisycom-mtp40' }),
      carrier('b', { deviceId: 'sound-devices-a10' }),
    ];
    expect(resolveScanDeviationsHz(carriers, DEFAULT_SETTINGS)).toEqual([
      28000, 100000,
    ]);
  });
});
