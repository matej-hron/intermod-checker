import { describe, it, expect } from 'vitest';
import { evaluateCandidate, explanationText } from '../evaluate';
import { DEFAULT_SETTINGS, type Carrier, type Settings } from '../types';

function carrier(id: string, mhz: number, locked = false): Carrier {
  return { id, label: id, freqKHz: Math.round(mhz * 1000), locked };
}

const third: Settings = { ...DEFAULT_SETTINGS, lowOrder: 3, highOrder: 3 };

function evaluate(
  carriers: Carrier[],
  index: number,
  candidateMHz: number,
  settings: Settings = third,
  mode: 'full' | 'first-hit' = 'full',
) {
  const freqs = carriers.map((c) => c.freqKHz);
  return evaluateCandidate(
    freqs,
    index,
    Math.round(candidateMHz * 1000),
    settings,
    carriers,
    mode,
  );
}

describe('evaluateCandidate', () => {
  it('reports an exact two-transmitter third-order hit under 2T3O', () => {
    // 2*510 - 511 = 509, so 509.000 is an exact hit for the third carrier.
    const carriers = [carrier('a', 510), carrier('b', 511), carrier('c', 509)];
    const evaluation = evaluate(carriers, 2, 509);
    expect(evaluation.verdicts['2T3O']).toBe('exact');
    expect(evaluation.worst).toBe('exact');
  });

  it('reports a three-transmitter product under 3T3O', () => {
    // 510 + 520 - 505 = 525.
    const carriers = [
      carrier('a', 510),
      carrier('b', 520),
      carrier('c', 505),
      carrier('d', 525),
    ];
    const evaluation = evaluate(carriers, 3, 525);
    expect(evaluation.verdicts['3T3O']).toBe('exact');
  });

  it('reports a near miss as near, not exact', () => {
    // 2*510 - 511 = 509; 509.018 is 18 kHz away, inside the 25 kHz window.
    const carriers = [carrier('a', 510), carrier('b', 511), carrier('c', 509)];
    const evaluation = evaluate(carriers, 2, 509.018);
    expect(evaluation.verdicts['2T3O']).toBe('near');
    expect(evaluation.worst).toBe('near');
    expect(evaluation.explanation?.offsetKHz).toBe(18);
  });

  it('keeps the worst verdict when a criterion has both a near and an exact hit', () => {
    // 2*510-511 = 509 exact, and 2*511-513.02 = 508.98 is 20 kHz away.
    const carriers = [
      carrier('a', 510),
      carrier('b', 511),
      carrier('c', 509),
      carrier('d', 513.02),
    ];
    const evaluation = evaluate(carriers, 2, 509);
    expect(evaluation.verdicts['2T3O']).toBe('exact');
  });

  it('reports clear when nothing lands nearby', () => {
    const carriers = [carrier('a', 500.1), carrier('b', 530.3), carrier('c', 570.7)];
    const evaluation = evaluate(carriers, 2, 570.7);
    expect(evaluation.worst).toBe('clear');
    expect(evaluation.explanation).toBeNull();
  });

  it('counts only products the moved carrier is party to', () => {
    // Two independent clusters. While cluster two is still broken, a candidate
    // for cluster one must not be blamed for it. This pins the v1 Critical fix
    // at the primitive level.
    const carriers = [
      carrier('a', 510),
      carrier('b', 511),
      carrier('v1', 509),
      carrier('d', 610),
      carrier('e', 611),
      carrier('v2', 609),
    ];
    // 508.950, not 508.975: 2*510 - 511 = 509.000 and the near-hit window is
    // 25 kHz *inclusive*, so 508.975 is a near miss against the untouched set.
    // (v1's suggest() reaches 508.975 only because carrier b has already been
    // moved by the time c is solved.)
    expect(evaluate(carriers, 2, 508.95).worst).toBe('clear');
  });

  it('names the contributing carriers, excluding the mover', () => {
    const carriers = [carrier('a', 510), carrier('b', 511), carrier('c', 509)];
    const evaluation = evaluate(carriers, 2, 509);
    expect(evaluation.explanation?.contributors).toEqual(['a', 'b']);
    expect(evaluation.explanation?.order).toBe(3);
  });

  it('builds contributors from a copy, not the shared coefficient array', () => {
    // Twelve carriers produce thousands of vectors after the winning one, so a
    // retained reference to the reused array would report a later vector's
    // contributors instead. The winning product is 3rd order, so it can name at
    // most three carriers; a 5th-order vector leaking in would name more.
    const carriers = Array.from({ length: 12 }, (_, i) => carrier(`m${i}`, 502 + i * 2.5));
    const evaluation = evaluate(carriers, 0, 502, DEFAULT_SETTINGS);
    expect(evaluation.explanation?.order).toBe(3);
    expect(evaluation.explanation?.contributors.length).toBeLessThanOrEqual(3);
    expect(evaluation.explanation?.contributors).not.toContain('m0');
  });

  it('prefers the lowest order among products sharing the worst verdict', () => {
    const carriers = [carrier('a', 510), carrier('b', 511), carrier('c', 509)];
    const evaluation = evaluate(carriers, 2, 509, { ...DEFAULT_SETTINGS, lowOrder: 3, highOrder: 5 });
    expect(evaluation.explanation?.order).toBe(3);
  });

  it('fails the spacing criterion inside the minimum spacing', () => {
    const carriers = [carrier('a', 510), carrier('b', 530), carrier('c', 570)];
    // 510.100 is 100 kHz from a, below the 250 kHz minimum.
    expect(evaluate(carriers, 2, 510.1).verdicts.spacing).toBe('exact');
    // Exactly 250 kHz away is allowed.
    expect(evaluate(carriers, 2, 510.25).verdicts.spacing).toBe('clear');
  });

  it('fails the exclusion criterion inclusively at both edges', () => {
    const settings: Settings = {
      ...third,
      exclusions: [{ id: 'x', label: 'DTV', startKHz: 566000, endKHz: 574000 }],
    };
    const carriers = [carrier('a', 510), carrier('b', 530), carrier('c', 590)];
    expect(evaluate(carriers, 2, 566, settings).verdicts.exclusion).toBe('exact');
    expect(evaluate(carriers, 2, 574, settings).verdicts.exclusion).toBe('exact');
    expect(evaluate(carriers, 2, 574.025, settings).verdicts.exclusion).toBe('clear');
  });

  it('short-circuits in first-hit mode without scanning products', () => {
    const carriers = [carrier('a', 510), carrier('b', 530), carrier('c', 570)];
    const evaluation = evaluate(carriers, 2, 510.1, third, 'first-hit');
    expect(evaluation.worst).toBe('exact');
    expect(evaluation.verdicts.spacing).toBe('exact');
  });

  it('agrees with full mode on whether a candidate is clear', () => {
    const carriers = [carrier('a', 510), carrier('b', 511), carrier('c', 509)];
    for (const mhz of [508.975, 509, 509.025, 512.5, 540]) {
      const full = evaluate(carriers, 2, mhz, third, 'full');
      const fast = evaluate(carriers, 2, mhz, third, 'first-hit');
      expect(fast.worst === 'clear').toBe(full.worst === 'clear');
    }
  });

  it('restores the working frequency array', () => {
    const carriers = [carrier('a', 510), carrier('b', 511), carrier('c', 509)];
    const freqs = carriers.map((c) => c.freqKHz);
    evaluateCandidate(freqs, 2, 540000, third, carriers);
    expect(freqs).toEqual([510000, 511000, 509000]);
  });
});

describe('explanationText', () => {
  it('names the mechanism and the culprits for an exact hit', () => {
    expect(
      explanationText({ order: 3, verdict: 'exact', offsetKHz: 0, contributors: ['Mic 1', 'Mic 5'] }),
    ).toBe('3rd order · Mic 1 + Mic 5');
  });

  it('includes the distance for a near miss', () => {
    expect(
      explanationText({ order: 5, verdict: 'near', offsetKHz: 18, contributors: ['Mic 2', 'Mic 7'] }),
    ).toBe('5th order · 18 kHz away · Mic 2 + Mic 7');
  });

  it('says clear when there is nothing to explain', () => {
    expect(explanationText(null)).toBe('Clear');
  });
});
