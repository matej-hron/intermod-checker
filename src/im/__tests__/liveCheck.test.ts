import { describe, it, expect } from 'vitest';
import { liveCheck, LIVE_CHECK_HALF_WIDTH_KHZ } from '../liveCheck';
import { evaluateCandidate } from '../evaluate';
import { DEFAULT_SETTINGS, type Carrier, type Settings } from '../types';

const settings: Settings = { ...DEFAULT_SETTINGS };

function carrier(id: string, freqKHz: number, locked = false): Carrier {
  return { id, label: id, freqKHz, locked };
}

// 600.000 and 601.000 make a 3rd-order product at 2*601000 - 600000 = 602000.
const THIRD_ORDER = [carrier('a', 600000), carrier('b', 601000), carrier('c', 602000)];

describe('liveCheck', () => {
  it('reports clear and does not search when nothing lands on the frequency', () => {
    const spread = [carrier('a', 510000), carrier('b', 530000), carrier('c', 551000)];
    const r = liveCheck(spread, settings, 'c', 551000);
    expect(r.verdict).toBe('clear');
    expect(r.alternatives).toEqual([]);
    expect(r.searched).toBe(false);
  });

  it('catches a carrier sitting on a 3rd-order product', () => {
    const r = liveCheck(THIRD_ORDER, settings, 'c', 602000);
    expect(r.verdict).toBe('exact');
    expect(r.explanation).not.toBe('');
    expect(r.explanation).not.toBe('Clear');
    expect(r.searched).toBe(true);
  });

  it('returns alternatives nearest first, and every one really is clear', () => {
    const r = liveCheck(THIRD_ORDER, settings, 'c', 602000);
    expect(r.alternatives.length).toBeGreaterThan(0);

    const distances = r.alternatives.map((f) => Math.abs(f - 602000));
    expect([...distances].sort((x, y) => x - y)).toEqual(distances);

    const freqs = THIRD_ORDER.map((c) => c.freqKHz);
    for (const alt of r.alternatives) {
      expect(Math.abs(alt - 602000)).toBeLessThanOrEqual(LIVE_CHECK_HALF_WIDTH_KHZ);
      expect(evaluateCandidate(freqs, 2, alt, settings, THIRD_ORDER, 'full').worst).toBe('clear');
    }
  });

  it('never offers the conflicting frequency itself as an alternative', () => {
    const r = liveCheck(THIRD_ORDER, settings, 'c', 602000);
    expect(r.alternatives).not.toContain(602000);
  });

  it('respects maxAlternatives', () => {
    expect(liveCheck(THIRD_ORDER, settings, 'c', 602000, 1).alternatives).toHaveLength(1);
    expect(liveCheck(THIRD_ORDER, settings, 'c', 602000, 3).alternatives.length).toBeLessThanOrEqual(3);
  });

  it('catches a minimum-spacing violation', () => {
    const tight = [carrier('a', 600000), carrier('b', 600100)];
    // 100 kHz apart, under the 250 kHz minimum.
    const r = liveCheck(tight, settings, 'b', 600100);
    expect(r.verdict).toBe('exact');
    expect(r.searched).toBe(true);
    expect(r.explanation).not.toBe('Clear');
    expect(r.explanation).not.toBe('');
    expect(r.explanation.toLowerCase()).toContain('spacing');
  });

  it('catches an excluded range', () => {
    const excluded: Settings = {
      ...settings,
      exclusions: [{ id: 'x', startKHz: 599000, endKHz: 601000, label: 'DTV' }],
    };
    const r = liveCheck([carrier('a', 600000)], excluded, 'a', 600000);
    expect(r.verdict).toBe('exact');
    expect(r.explanation).not.toBe('Clear');
    expect(r.explanation).not.toBe('');
    expect(r.explanation.toLowerCase()).toContain('excluded');
  });

  it('mentions both criteria when spacing and exclusion both fire', () => {
    const tight = [carrier('a', 600000), carrier('b', 600100)];
    const excluded: Settings = {
      ...settings,
      exclusions: [{ id: 'x', startKHz: 599000, endKHz: 601000, label: 'DTV' }],
    };
    const r = liveCheck(tight, excluded, 'b', 600100);
    expect(r.verdict).toBe('exact');
    expect(r.explanation.toLowerCase()).toContain('spacing');
    expect(r.explanation.toLowerCase()).toContain('excluded');
  });

  it('mentions both the order and spacing when a product hit and a spacing violation coincide', () => {
    // c sits on the 2b-a = 602000 product and d is 100 kHz away, under the minimum.
    const both = [
      carrier('a', 600000),
      carrier('b', 601000),
      carrier('c', 602000),
      carrier('d', 602100),
    ];
    const r = liveCheck(both, settings, 'c', 602000);
    expect(r.verdict).toBe('exact');
    expect(r.explanation.toLowerCase()).toContain('order');
    expect(r.explanation.toLowerCase()).toContain('spacing');
  });

  it('mentions both the order and exclusion when a product hit lands in an excluded range', () => {
    // c sits on the 2b-a = 602000 product, which also falls inside the excluded range.
    const excluded: Settings = {
      ...settings,
      exclusions: [{ id: 'x', startKHz: 601500, endKHz: 602500, label: 'DTV' }],
    };
    const r = liveCheck(THIRD_ORDER, excluded, 'c', 602000);
    expect(r.verdict).toBe('exact');
    expect(r.explanation.toLowerCase()).toContain('order');
    expect(r.explanation.toLowerCase()).toContain('excluded');
  });

  it('returns fewer than the maximum rather than padding when the window is exhausted', () => {
    // A 25 kHz window at a 25 kHz step offers one alternative either side at most.
    const r = liveCheck(THIRD_ORDER, settings, 'c', 602000, 3, 25);
    expect(r.alternatives.length).toBeLessThanOrEqual(2);
    expect(r.searched).toBe(true);
  });

  it('returns a cleared result without throwing for an unknown carrier id', () => {
    const r = liveCheck(THIRD_ORDER, settings, 'nope', 602000);
    expect(r.verdict).toBe('clear');
    expect(r.alternatives).toEqual([]);
    expect(r.searched).toBe(false);
  });

  it('judges a locked carrier normally', () => {
    const locked = [carrier('a', 600000), carrier('b', 601000), carrier('c', 602000, true)];
    expect(liveCheck(locked, settings, 'c', 602000).verdict).toBe('exact');
  });

  it('returns independent objects so mutating one clear result does not affect another', () => {
    const spread = [carrier('a', 510000), carrier('b', 530000), carrier('c', 551000)];
    const r1 = liveCheck(spread, settings, 'c', 551000);
    r1.alternatives.push(999999);
    const r2 = liveCheck(spread, settings, 'c', 551000);
    expect(r2.alternatives).toEqual([]);
    expect(r1).not.toBe(r2);
  });
});
