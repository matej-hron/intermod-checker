import { describe, it, expect } from 'vitest';
import { suggest } from '../suggest';
import { analyze } from '../analyze';
import { DEFAULT_SETTINGS, type Carrier, type Settings } from '../types';

function carrier(id: string, mhz: number): Carrier {
  return { id, label: id, freqKHz: Math.round(mhz * 1000) };
}

const settings: Settings = { ...DEFAULT_SETTINGS, lowOrder: 3, highOrder: 3 };

describe('suggest', () => {
  it('returns nothing for a clean set', () => {
    const carriers = [
      carrier('a', 500.1),
      carrier('b', 530.3),
      carrier('c', 570.7),
    ];
    expect(suggest(carriers, settings)).toEqual([]);
  });

  it('proposes a replacement for a conflicted carrier', () => {
    // 2*510 - 511 = 509 MHz, which lands exactly on carrier c.
    const carriers = [
      carrier('a', 510),
      carrier('b', 511),
      carrier('c', 509),
    ];
    const suggestions = suggest(carriers, settings);
    expect(suggestions.length).toBeGreaterThan(0);
    const s = suggestions[0];
    expect(s.toKHz).not.toBeNull();
    expect(s.fromKHz).not.toBe(s.toKHz);
    expect(s.distanceKHz).toBe(Math.abs((s.toKHz as number) - s.fromKHz));
  });

  it('keeps the replacement inside the band', () => {
    const carriers = [
      carrier('a', 510),
      carrier('b', 511),
      carrier('c', 509),
    ];
    for (const s of suggest(carriers, settings)) {
      if (s.toKHz === null) continue;
      expect(s.toKHz).toBeGreaterThanOrEqual(settings.bandMinKHz);
      expect(s.toKHz).toBeLessThanOrEqual(settings.bandMaxKHz);
    }
  });

  it('snaps replacements to the suggestion step', () => {
    const carriers = [
      carrier('a', 510),
      carrier('b', 511),
      carrier('c', 509),
    ];
    for (const s of suggest(carriers, settings)) {
      if (s.toKHz === null) continue;
      expect(Math.abs(s.toKHz - s.fromKHz) % settings.suggestionStepKHz).toBe(0);
    }
  });

  it('respects the minimum spacing against other carriers', () => {
    const carriers = [
      carrier('a', 510),
      carrier('b', 511),
      carrier('c', 509),
    ];
    for (const s of suggest(carriers, settings)) {
      if (s.toKHz === null) continue;
      for (const other of carriers) {
        if (other.id === s.carrierId) continue;
        expect(Math.abs(other.freqKHz - s.toKHz)).toBeGreaterThanOrEqual(
          settings.minSpacingKHz,
        );
      }
    }
  });

  it('produces a set that is clean once every suggestion is applied', () => {
    const carriers = [
      carrier('a', 510),
      carrier('b', 511),
      carrier('c', 509),
      carrier('d', 512),
    ];
    const suggestions = suggest(carriers, settings);
    const applied = carriers.map((c) => {
      const s = suggestions.find((x) => x.carrierId === c.id);
      return s && s.toKHz !== null ? { ...c, freqKHz: s.toKHz } : c;
    });
    const after = analyze(applied, settings);
    expect(after.conflictedIds).toEqual([]);
  });

  it('reports a failure when no candidate fits', () => {
    // A suggestion step wider than the whole band puts every candidate outside
    // it, so the search must exhaust its budget and report why.
    const impossible: Settings = { ...settings, suggestionStepKHz: 300000 };
    const carriers = [
      carrier('a', 510),
      carrier('b', 511),
      carrier('c', 509),
    ];
    const suggestions = suggest(carriers, impossible);
    expect(suggestions.length).toBeGreaterThan(0);
    for (const s of suggestions) {
      expect(s.toKHz).toBeNull();
      expect(s.distanceKHz).toBeNull();
      expect(s.failureReason).toBeTruthy();
    }
  });

  it('reports progress ending at one', () => {
    const fractions: number[] = [];
    suggest(
      [carrier('a', 510), carrier('b', 511), carrier('c', 509)],
      settings,
      (f) => fractions.push(f),
    );
    expect(fractions[fractions.length - 1]).toBe(1);
  });
});
