import { describe, it, expect } from 'vitest';
import { validate } from '../validate';
import { DEFAULT_SETTINGS, type Carrier } from '../types';

function carrier(id: string, mhz: number): Carrier {
  return { id, label: id, freqKHz: Math.round(mhz * 1000), locked: false };
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

  it('rejects two carriers sharing an identifier', () => {
    const issues = validate(
      [carrier('same', 510), { id: 'same', label: 'b', freqKHz: 530000, locked: false }],
      DEFAULT_SETTINGS,
    );
    expect(issues.some((i) => /identifier/i.test(i.message))).toBe(true);
  });
});

describe('exclusions', () => {
  const base = { ...DEFAULT_SETTINGS };
  const carriers: Carrier[] = [
    { id: 'a', label: 'Mic 1', freqKHz: 510000, locked: false },
    { id: 'b', label: 'Mic 2', freqKHz: 570000, locked: false },
  ];

  it('flags a carrier sitting inside an exclusion range', () => {
    const settings = {
      ...base,
      exclusions: [{ id: 'x', label: 'Local DTV', startKHz: 566000, endKHz: 574000 }],
    };
    const issues = validate(carriers, settings);
    const issue = issues.find((i) => i.carrierIds.includes('b'));
    expect(issue).toBeDefined();
    expect(issue?.field).toBe('exclusions');
    expect(issue?.message).toContain('Local DTV');
  });

  it('treats the exclusion bounds as inclusive', () => {
    const settings = {
      ...base,
      exclusions: [{ id: 'x', label: 'Edge', startKHz: 570000, endKHz: 580000 }],
    };
    expect(validate(carriers, settings).some((i) => i.carrierIds.includes('b'))).toBe(true);
  });

  it('flags an exclusion that lies entirely outside the band', () => {
    const settings = {
      ...base,
      exclusions: [{ id: 'x', label: 'Elsewhere', startKHz: 800000, endKHz: 810000 }],
    };
    const issue = validate(carriers, settings).find((i) => i.message.includes('Elsewhere'));
    expect(issue?.message).toContain('no effect');
  });

  it('flags an exclusion that covers the whole band', () => {
    const settings = {
      ...base,
      exclusions: [{ id: 'x', label: 'Everything', startKHz: 400000, endKHz: 800000 }],
    };
    const issues = validate(carriers, settings);
    expect(issues.some((i) => i.message.includes('leaves no usable'))).toBe(true);
    // finding 1: no spurious per-carrier "inside the excluded range" issues for this exclusion
    expect(issues.some((i) => i.message.includes('inside the excluded range') && i.message.includes('Everything'))).toBe(false);
  });

  it('flags an exclusion outside the band with no per-carrier issues (finding 1)', () => {
    const settings = {
      ...base,
      exclusions: [{ id: 'x', label: 'Elsewhere', startKHz: 800000, endKHz: 810000 }],
    };
    const issues = validate(carriers, settings);
    expect(issues.some((i) => i.message.includes('no effect'))).toBe(true);
    // no per-carrier noise for an exclusion that already has its own issue
    expect(issues.some((i) => i.message.includes('inside the excluded range') && i.message.includes('Elsewhere'))).toBe(false);
  });

  it('flags a reversed exclusion range (finding 2)', () => {
    const settings = {
      ...base,
      exclusions: [{ id: 'x', label: 'Backwards', startKHz: 574000, endKHz: 566000 }],
    };
    const issues = validate(carriers, settings);
    const issue = issues.find((i) => i.field === 'exclusions' && i.message.includes('Backwards'));
    expect(issue).toBeDefined();
    expect(issue?.message).toMatch(/reversed/i);
  });

  it('accepts a single-frequency exclusion (startKHz === endKHz)', () => {
    const settings = {
      ...base,
      exclusions: [{ id: 'x', label: 'SingleFreq', startKHz: 570000, endKHz: 570000 }],
    };
    const issues = validate(carriers, settings);
    // should not produce a reversed-range issue
    expect(issues.some((i) => i.message.toLowerCase().includes('reversed'))).toBe(false);
  });

  it('accepts a clean set with a harmless exclusion', () => {
    const settings = {
      ...base,
      exclusions: [{ id: 'x', label: 'IEM rack', startKHz: 600000, endKHz: 604000 }],
    };
    expect(validate(carriers, settings)).toEqual([]);
  });
});
