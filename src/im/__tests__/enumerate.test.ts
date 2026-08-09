import { describe, it, expect } from 'vitest';
import { enumerateVectors } from '../enumerate';

function collect(
  n: number,
  low: number,
  high: number,
  oddOnly: boolean,
): number[][] {
  const out: number[][] = [];
  enumerateVectors(n, low, high, oddOnly, (coeffs) => {
    out.push([...coeffs]);
  });
  return out;
}

describe('enumerateVectors', () => {
  it('enumerates third-order vectors for two carriers', () => {
    const vectors = collect(2, 3, 3, true);
    expect(vectors).toHaveLength(6);
    expect(vectors).toContainEqual([2, -1]);
    expect(vectors).toContainEqual([1, -2]);
    expect(vectors).toContainEqual([2, 1]);
    expect(vectors).toContainEqual([1, 2]);
    expect(vectors).toContainEqual([3, 0]);
    expect(vectors).toContainEqual([0, 3]);
  });

  it('emits only canonical vectors, never a negated duplicate', () => {
    const vectors = collect(3, 2, 5, false);
    for (const v of vectors) {
      const firstNonZero = v.find((c) => c !== 0);
      expect(firstNonZero).toBeGreaterThan(0);
    }
  });

  it('emits every vector exactly once', () => {
    const vectors = collect(3, 2, 5, false);
    const keys = new Set(vectors.map((v) => v.join(',')));
    expect(keys.size).toBe(vectors.length);
  });

  it('respects the order bounds', () => {
    const vectors = collect(3, 3, 5, false);
    for (const v of vectors) {
      const order = v.reduce((sum, c) => sum + Math.abs(c), 0);
      expect(order).toBeGreaterThanOrEqual(3);
      expect(order).toBeLessThanOrEqual(5);
    }
  });

  it('emits only odd orders when oddOnly is set', () => {
    const vectors = collect(4, 2, 5, true);
    expect(vectors.length).toBeGreaterThan(0);
    for (const v of vectors) {
      const order = v.reduce((sum, c) => sum + Math.abs(c), 0);
      expect(order % 2).toBe(1);
    }
  });

  it('reports the visited count and passes the order to the visitor', () => {
    const orders: number[] = [];
    const count = enumerateVectors(2, 3, 3, true, (coeffs, order) => {
      orders.push(order);
      expect(coeffs).toHaveLength(2);
    });
    expect(count).toBe(6);
    expect(orders.every((o) => o === 3)).toBe(true);
  });

  it('stops early when the visitor returns false', () => {
    let seen = 0;
    const count = enumerateVectors(3, 2, 5, false, () => {
      seen += 1;
      return seen < 3;
    });
    expect(seen).toBe(3);
    expect(count).toBe(3);
  });
});
