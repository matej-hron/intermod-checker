import { describe, it, expect } from 'vitest';
import { suggest } from '../suggest';
import { analyze } from '../analyze';
import { DEFAULT_SETTINGS, type Carrier, type Settings } from '../types';

function carrier(id: string, mhz: number): Carrier {
  return { id, label: id, freqKHz: Math.round(mhz * 1000), locked: false };
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

  it('picks the nearest clean candidate, trying below before above', () => {
    // a=510, b=511, c=509 with 3rd order only, 25 kHz steps.
    // For b: 510.975 and 511.025 are both unclean, so the search widens to
    // 50 kHz and takes the BELOW candidate first -> 510.950, never 511.050.
    // For c: 508.975 is clean at the very first step -> never 509.025.
    const carriers = [carrier('a', 510), carrier('b', 511), carrier('c', 509)];
    const byId = new Map(suggest(carriers, settings).map((s) => [s.carrierId, s]));

    expect(byId.get('b')?.toKHz).toBe(510950);
    expect(byId.get('b')?.distanceKHz).toBe(50);
    expect(byId.get('c')?.toKHz).toBe(508975);
    expect(byId.get('c')?.distanceKHz).toBe(25);
  });

  it('solves two independent conflict clusters', () => {
    // Two clusters far apart: 2*510-511 = 509, and 2*610-611 = 609.
    // While cluster two is still unfixed its conflict is present in the set,
    // so a candidate for cluster one must not be rejected because of it.
    const carriers = [
      carrier('a', 510),
      carrier('b', 511),
      carrier('v1', 509),
      carrier('d', 610),
      carrier('e', 611),
      carrier('v2', 609),
    ];
    const suggestions = suggest(carriers, settings);
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.every((s) => s.toKHz !== null)).toBe(true);

    const byId = new Map(
      suggestions.filter((s) => s.toKHz !== null).map((s) => [s.carrierId, s.toKHz as number]),
    );
    const applied = carriers.map((c) =>
      byId.has(c.id) ? { ...c, freqKHz: byId.get(c.id) as number } : c,
    );
    expect(analyze(applied, settings).conflictedIds).toEqual([]);
  });

  it('finds replacements for a realistic twelve-carrier set', () => {
    const carriers = Array.from({ length: 12 }, (_, i) =>
      carrier(`m${i}`, 502 + i * 2.5),
    );
    const suggestions = suggest(carriers, DEFAULT_SETTINGS);
    expect(suggestions.some((s) => s.toKHz !== null)).toBe(true);
  });
});
