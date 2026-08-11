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
