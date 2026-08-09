import { describe, it, expect } from 'vitest';
import { validate } from '../validate';
import { DEFAULT_SETTINGS, type Carrier } from '../types';

function carrier(id: string, mhz: number): Carrier {
  return { id, label: id, freqKHz: Math.round(mhz * 1000) };
}

const good = [carrier('a', 510), carrier('b', 530), carrier('c', 560)];

describe('validate', () => {
  it('accepts a well-formed set', () => {
    expect(validate(good, DEFAULT_SETTINGS)).toEqual([]);
  });

  it('rejects fewer than two carriers', () => {
    const issues = validate([carrier('a', 510)], DEFAULT_SETTINGS);
    expect(issues.some((i) => i.field === 'carriers')).toBe(true);
  });

  it('rejects more than twenty-four carriers', () => {
    const many = Array.from({ length: 25 }, (_, i) =>
      carrier(`c${i}`, 510 + i * 2),
    );
    const issues = validate(many, DEFAULT_SETTINGS);
    expect(issues.some((i) => i.field === 'carriers')).toBe(true);
  });

  it('rejects a frequency below the band', () => {
    const issues = validate([...good, carrier('low', 490)], DEFAULT_SETTINGS);
    const issue = issues.find((i) => i.carrierIds.includes('low'));
    expect(issue?.field).toBe('frequency');
  });

  it('rejects a frequency above the band', () => {
    const issues = validate([...good, carrier('high', 710)], DEFAULT_SETTINGS);
    expect(issues.some((i) => i.carrierIds.includes('high'))).toBe(true);
  });

  it('rejects duplicate frequencies', () => {
    const issues = validate([...good, carrier('dup', 510)], DEFAULT_SETTINGS);
    const issue = issues.find((i) => i.message.toLowerCase().includes('duplicate'));
    expect(issue?.carrierIds).toEqual(expect.arrayContaining(['a', 'dup']));
  });

  it('rejects carriers closer than the minimum spacing', () => {
    const issues = validate(
      [carrier('a', 510), carrier('b', 510.1)],
      DEFAULT_SETTINGS,
    );
    expect(
      issues.some((i) => i.message.toLowerCase().includes('spacing')),
    ).toBe(true);
  });

  it('rejects an inverted band', () => {
    const issues = validate(good, {
      ...DEFAULT_SETTINGS,
      bandMinKHz: 700000,
      bandMaxKHz: 500000,
    });
    expect(issues.some((i) => i.field === 'settings')).toBe(true);
  });

  it('rejects a low order above the high order', () => {
    const issues = validate(good, {
      ...DEFAULT_SETTINGS,
      lowOrder: 7,
      highOrder: 5,
    });
    expect(issues.some((i) => i.field === 'settings')).toBe(true);
  });

  it('rejects an order below two', () => {
    const issues = validate(good, { ...DEFAULT_SETTINGS, lowOrder: 1 });
    expect(issues.some((i) => i.field === 'settings')).toBe(true);
  });

  it('rejects a non-positive suggestion step', () => {
    const issues = validate(good, {
      ...DEFAULT_SETTINGS,
      suggestionStepKHz: 0,
    });
    expect(issues.some((i) => i.field === 'settings')).toBe(true);
  });

  it('accepts exactly two carriers', () => {
    expect(
      validate([carrier('a', 510), carrier('b', 530)], DEFAULT_SETTINGS),
    ).toEqual([]);
  });

  it('accepts exactly twenty-four carriers', () => {
    const twentyFour = Array.from({ length: 24 }, (_, i) =>
      carrier(`c${i}`, 510 + i * 2),
    );
    expect(validate(twentyFour, DEFAULT_SETTINGS)).toEqual([]);
  });

  it('accepts a frequency exactly at the band minimum', () => {
    const carriers = [
      carrier('a', DEFAULT_SETTINGS.bandMinKHz / 1000),
      carrier('b', 530),
      carrier('c', 560),
    ];
    expect(validate(carriers, DEFAULT_SETTINGS)).toEqual([]);
  });

  it('accepts a frequency exactly at the band maximum', () => {
    const carriers = [
      carrier('a', 510),
      carrier('b', 530),
      carrier('c', DEFAULT_SETTINGS.bandMaxKHz / 1000),
    ];
    expect(validate(carriers, DEFAULT_SETTINGS)).toEqual([]);
  });

  it('accepts a gap exactly equal to the minimum spacing', () => {
    const gapMHz = DEFAULT_SETTINGS.minSpacingKHz / 1000;
    const carriers = [carrier('a', 510), carrier('b', 510 + gapMHz)];
    expect(validate(carriers, DEFAULT_SETTINGS)).toEqual([]);
  });
});
