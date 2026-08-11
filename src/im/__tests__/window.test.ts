import { describe, expect, it } from 'vitest';
import { windowHz } from '../window';

describe('windowHz', () => {
  it('never falls below the near-hit floor', () => {
    expect(windowHz(0, 0, 25)).toBe(25000);
  });

  it('adds the victim bandwidth to the product spread', () => {
    // Three carriers of ±28 kHz mixing: 84 kHz of spread, and the victim's own
    // 28 kHz on top.
    expect(windowHz(84000, 28000, 25)).toBe(112000);
  });

  it('uses the spread alone when the victim has no width', () => {
    expect(windowHz(84000, 0, 25)).toBe(84000);
  });

  it('prefers the floor when the deviations are small', () => {
    expect(windowHz(3000, 1000, 25)).toBe(25000);
  });
});
