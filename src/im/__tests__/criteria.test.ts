import { describe, it, expect } from 'vitest';
import {
  criterionKey,
  criterionLabel,
  realizableCriteria,
  txBucket,
  worseVerdict,
  verdictRank,
} from '../criteria';
import { DEFAULT_SETTINGS } from '../types';

describe('txBucket', () => {
  it('counts a harmonic of one transmitter as bucket 1', () => {
    expect(txBucket([3, 0, 0])).toBe(1);
  });

  it('counts a two-transmitter product as bucket 2', () => {
    expect(txBucket([2, -1, 0])).toBe(2);
  });

  it('counts a three-transmitter product as bucket 3', () => {
    expect(txBucket([1, 1, -1, 0])).toBe(3);
  });

  it('caps four or more transmitters at bucket 3', () => {
    expect(txBucket([1, 1, 1, 1, -1])).toBe(3);
  });
});

describe('criterionKey', () => {
  it('formats as {bucket}T{order}O', () => {
    expect(criterionKey(2, 3)).toBe('2T3O');
    expect(criterionKey(3, 5)).toBe('3T5O');
  });
});

describe('realizableCriteria', () => {
  it('lists the default set in order, strictest first', () => {
    expect(realizableCriteria(DEFAULT_SETTINGS)).toEqual([
      '1T3O',
      '2T3O',
      '3T3O',
      '1T5O',
      '2T5O',
      '3T5O',
    ]);
  });

  it('includes even orders when oddOnly is off', () => {
    expect(
      realizableCriteria({
        ...DEFAULT_SETTINGS,
        lowOrder: 2,
        highOrder: 3,
        oddOnly: false,
      }),
    ).toEqual(['1T2O', '2T2O', '1T3O', '2T3O', '3T3O']);
  });

  it('omits buckets that cannot occur at a given order', () => {
    // A 2nd-order product cannot involve three transmitters.
    expect(realizableCriteria({ ...DEFAULT_SETTINGS, lowOrder: 2, highOrder: 2, oddOnly: false }))
      .toEqual(['1T2O', '2T2O']);
  });
});

describe('verdict ordering', () => {
  it('ranks exact above near above clear', () => {
    expect(verdictRank('exact')).toBeGreaterThan(verdictRank('near'));
    expect(verdictRank('near')).toBeGreaterThan(verdictRank('clear'));
  });

  it('keeps the worse of two verdicts', () => {
    expect(worseVerdict('clear', 'near')).toBe('near');
    expect(worseVerdict('exact', 'near')).toBe('exact');
    expect(worseVerdict('clear', 'clear')).toBe('clear');
  });
});

describe('criterionLabel', () => {
  it('describes an interference criterion in words', () => {
    expect(criterionLabel('2T3O')).toBe('2 transmitters, 3rd order');
    expect(criterionLabel('3T5O')).toBe('3 or more transmitters, 5th order');
    expect(criterionLabel('1T3O')).toBe('1 transmitter, 3rd order');
  });

  it('describes the non-interference criteria', () => {
    expect(criterionLabel('spacing')).toBe('Minimum spacing');
    expect(criterionLabel('exclusion')).toBe('Excluded range');
  });
});
