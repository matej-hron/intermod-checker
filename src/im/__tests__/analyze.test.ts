import { describe, it, expect } from 'vitest';
import { analyze, severityForOrder, effectiveWindowKHz } from '../analyze';
import { DEFAULT_SETTINGS, type Carrier, type Settings } from '../types';

function carrier(id: string, mhz: number): Carrier {
  return { id, label: id, freqKHz: Math.round(mhz * 1000), locked: false };
}

// The band bounds are widened to 140-320 MHz so the worked examples from the
// source paper (which uses VHF frequencies) can be reproduced verbatim.
const vhf: Settings = {
  ...DEFAULT_SETTINGS,
  bandMinKHz: 140000,
  bandMaxKHz: 320000,
};

describe('severityForOrder', () => {
  it('ranks lower orders as more severe', () => {
    expect(severityForOrder(3)).toBe('high');
    expect(severityForOrder(5)).toBe('medium');
    expect(severityForOrder(7)).toBe('low');
    expect(severityForOrder(9)).toBe('low');
  });

  it('ranks an even order the same as its odd neighbours', () => {
    expect(severityForOrder(4)).toBe('medium');
  });
});

describe('effectiveWindowKHz', () => {
  it('uses the flat window when deviation is disabled', () => {
    expect(effectiveWindowKHz(3, { ...vhf, deviationKHz: 0 })).toBe(25);
  });

  it('scales the deviation term by the product order', () => {
    // Source-document fixture: the fifth-order product 2A + 3B built from two
    // signals each deviating +/-5 kHz swings +/-25 kHz.
    expect(effectiveWindowKHz(5, { ...vhf, deviationKHz: 5 })).toBe(25);
    expect(effectiveWindowKHz(5, { ...vhf, deviationKHz: 10 })).toBe(50);
  });
});

describe('analyze', () => {
  it('finds the third-order products of a two-carrier pair', () => {
    // 150.000 and 151.000 MHz produce 149.000 (2A - B) and 152.000 (2B - A).
    const carriers = [
      carrier('a', 150),
      carrier('b', 151),
      carrier('victim', 149),
    ];
    const result = analyze(carriers, { ...vhf, lowOrder: 3, highOrder: 3 });

    const victimHits = result.hitsByCarrierId['victim'] ?? [];
    const exact = victimHits.filter((h) => h.kind === 'exact' && !h.selfInvolving);
    expect(exact.length).toBeGreaterThan(0);
    expect(exact[0]?.product.freqKHz).toBe(149000);
    expect(exact[0]?.product.order).toBe(3);
    expect(exact[0]?.severity).toBe('high');
  });

  it('finds the upper third-order product', () => {
    const carriers = [
      carrier('a', 150),
      carrier('b', 151),
      carrier('victim', 152),
    ];
    const result = analyze(carriers, { ...vhf, lowOrder: 3, highOrder: 3 });
    const hits = (result.hitsByCarrierId['victim'] ?? []).filter(
      (h) => !h.selfInvolving,
    );
    expect(hits.some((h) => h.product.freqKHz === 152000)).toBe(true);
  });

  it('finds the fifth-order products of the same pair', () => {
    // 148.000 (3A - 2B) and 153.000 (3B - 2A).
    const carriers = [
      carrier('a', 150),
      carrier('b', 151),
      carrier('low', 148),
      carrier('high', 153),
    ];
    const result = analyze(carriers, { ...vhf, lowOrder: 5, highOrder: 5 });
    expect(
      (result.hitsByCarrierId['low'] ?? []).some(
        (h) => !h.selfInvolving && h.product.order === 5,
      ),
    ).toBe(true);
    expect(
      (result.hitsByCarrierId['high'] ?? []).some(
        (h) => !h.selfInvolving && h.product.order === 5,
      ),
    ).toBe(true);
  });

  it('reproduces the 3A - 2B example at 157.000 MHz', () => {
    const carriers = [
      carrier('a', 155),
      carrier('b', 154),
      carrier('victim', 157),
    ];
    const result = analyze(carriers, { ...vhf, lowOrder: 5, highOrder: 5 });
    const hits = (result.hitsByCarrierId['victim'] ?? []).filter(
      (h) => !h.selfInvolving,
    );
    expect(hits.some((h) => h.product.freqKHz === 157000)).toBe(true);
  });

  it('excludes second-order products that fall outside the band', () => {
    // 155 and 154 MHz give 1.000 and 309.000 MHz; neither is in 140-160.
    const carriers = [carrier('a', 155), carrier('b', 154)];
    const result = analyze(carriers, {
      ...vhf,
      bandMinKHz: 140000,
      bandMaxKHz: 160000,
      lowOrder: 2,
      highOrder: 2,
      oddOnly: false,
    });
    expect(result.hits).toHaveLength(0);
  });

  it('classifies an offset inside the window as a near hit', () => {
    const carriers = [
      carrier('a', 150),
      carrier('b', 151),
      carrier('victim', 149.02),
    ];
    const result = analyze(carriers, {
      ...vhf,
      lowOrder: 3,
      highOrder: 3,
      nearHitWindowKHz: 25,
    });
    const hits = (result.hitsByCarrierId['victim'] ?? []).filter(
      (h) => !h.selfInvolving,
    );
    expect(hits[0]?.kind).toBe('near');
    expect(hits[0]?.offsetKHz).toBe(20);
  });

  it('treats an offset exactly at the window edge as a near hit', () => {
    // The third-order product lands at 149.000 MHz; 149.025 is exactly
    // nearHitWindowKHz (25 kHz) away, which must still count as a near hit.
    const carriers = [
      carrier('a', 150),
      carrier('b', 151),
      carrier('victim', 149.025),
    ];
    const result = analyze(carriers, {
      ...vhf,
      lowOrder: 3,
      highOrder: 3,
      nearHitWindowKHz: 25,
    });
    const hits = (result.hitsByCarrierId['victim'] ?? []).filter(
      (h) => !h.selfInvolving,
    );
    expect(hits[0]?.kind).toBe('near');
    expect(hits[0]?.offsetKHz).toBe(25);
  });

  it('ignores an offset one kHz beyond the window edge', () => {
    // 149.026 is window + 1 kHz away from the 149.000 MHz product, so it must
    // not be reported at all.
    const carriers = [
      carrier('a', 150),
      carrier('b', 151),
      carrier('victim', 149.026),
    ];
    const result = analyze(carriers, {
      ...vhf,
      lowOrder: 3,
      highOrder: 3,
      nearHitWindowKHz: 25,
    });
    const hits = (result.hitsByCarrierId['victim'] ?? []).filter(
      (h) => !h.selfInvolving,
    );
    expect(hits).toHaveLength(0);
  });

  it('ignores an offset outside the window', () => {
    const carriers = [
      carrier('a', 150),
      carrier('b', 151),
      carrier('victim', 149.2),
    ];
    const result = analyze(carriers, {
      ...vhf,
      lowOrder: 3,
      highOrder: 3,
      nearHitWindowKHz: 25,
    });
    const hits = (result.hitsByCarrierId['victim'] ?? []).filter(
      (h) => !h.selfInvolving,
    );
    expect(hits).toHaveLength(0);
  });

  it('flags products the victim itself contributes to', () => {
    // With A + B = 2C, the fifth-order product 2A + B - 2C lands exactly on A,
    // and A contributes to it, so it is self-mixing rather than a conflict.
    const carriers = [
      carrier('a', 500),
      carrier('b', 520),
      carrier('c', 510),
    ];
    const result = analyze(carriers, {
      ...DEFAULT_SETTINGS,
      lowOrder: 5,
      highOrder: 5,
    });
    const onA = result.hitsByCarrierId['a'] ?? [];
    expect(onA).toHaveLength(1);
    expect(onA[0]?.product.freqKHz).toBe(500000);
    expect(onA[0]?.product.coeffs).toEqual([2, 1, -2]);
    expect(onA[0]?.selfInvolving).toBe(true);
    expect(result.conflictedIds).toEqual([]);
  });

  it('lists conflicted carriers and reports how many vectors it examined', () => {
    const carriers = [
      carrier('a', 150),
      carrier('b', 151),
      carrier('victim', 149),
    ];
    const result = analyze(carriers, { ...vhf, lowOrder: 3, highOrder: 3 });
    expect(result.conflictedIds).toContain('victim');
    expect(result.vectorsExamined).toBeGreaterThan(0);
  });

  it('reports a clean set as having no hits', () => {
    const carriers = [
      carrier('a', 500.1),
      carrier('b', 530.3),
      carrier('c', 570.7),
    ];
    const result = analyze(carriers, DEFAULT_SETTINGS);
    expect(result.hits.filter((h) => !h.selfInvolving)).toHaveLength(0);
  });

  it('produces identical output on repeated runs', () => {
    const carriers = [
      carrier('a', 150),
      carrier('b', 151),
      carrier('victim', 149),
    ];
    const settings = { ...vhf, lowOrder: 3, highOrder: 5 };
    const first = analyze(carriers, settings);
    const second = analyze(carriers, settings);
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });

  it('reports progress between 0 and 1', () => {
    const fractions: number[] = [];
    analyze(
      [carrier('a', 150), carrier('b', 151), carrier('c', 152)],
      { ...vhf, lowOrder: 3, highOrder: 5 },
      (f) => fractions.push(f),
    );
    expect(fractions.length).toBeGreaterThan(0);
    expect(fractions[fractions.length - 1]).toBe(1);
    for (const f of fractions) {
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThanOrEqual(1);
    }
  });
});
