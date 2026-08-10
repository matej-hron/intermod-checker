import { describe, it, expect } from 'vitest';
import {
  DEFAULT_TUNE_HALF_WIDTH_KHZ,
  MAX_TUNE_CANDIDATES,
  generateCandidates,
  widenHalfWidth,
} from '../candidates';
import { DEFAULT_SETTINGS, type Settings } from '../types';

const settings: Settings = { ...DEFAULT_SETTINGS };

describe('generateCandidates', () => {
  it('starts at the current frequency and alternates below then above', () => {
    expect(generateCandidates(600000, settings).slice(0, 5)).toEqual([
      600000, 599975, 600025, 599950, 600050,
    ]);
  });

  it('produces 161 candidates for the default window and step', () => {
    // 2000 kHz either side at 25 kHz, plus the current frequency.
    expect(generateCandidates(600000, settings)).toHaveLength(161);
  });

  it('never exceeds the half-width', () => {
    for (const f of generateCandidates(600000, settings)) {
      expect(Math.abs(f - 600000)).toBeLessThanOrEqual(DEFAULT_TUNE_HALF_WIDTH_KHZ);
    }
  });

  it('clips to the band without losing the other side', () => {
    const candidates = generateCandidates(500500, settings);
    expect(candidates.every((f) => f >= settings.bandMinKHz)).toBe(true);
    // 500.500 has only 500 kHz of room below but the full 2 MHz above.
    expect(candidates).toContain(502500);
    expect(candidates).not.toContain(499975);
  });

  it('omits the current frequency when it is outside the band', () => {
    expect(generateCandidates(499000, settings)).not.toContain(499000);
  });

  it('respects the candidate cap', () => {
    const wide = generateCandidates(600000, settings, 100000);
    expect(wide).toHaveLength(MAX_TUNE_CANDIDATES);
  });

  it('returns nothing when the step is not positive', () => {
    expect(generateCandidates(600000, { ...settings, suggestionStepKHz: 0 })).toEqual([]);
  });
});

describe('widenHalfWidth', () => {
  it('doubles the window', () => {
    expect(widenHalfWidth(2000, settings)).toBe(4000);
  });

  it('stops at the band width', () => {
    expect(widenHalfWidth(150000, settings)).toBe(200000);
  });
});
