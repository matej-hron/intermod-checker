import { describe, it, expect } from 'vitest';
import { mhzToKHz, kHzToMHzText, parseFrequencyMHz } from '../units';

describe('units', () => {
  it('converts MHz to integer kHz', () => {
    expect(mhzToKHz(500)).toBe(500000);
    expect(mhzToKHz(614.375)).toBe(614375);
  });

  it('rounds sub-kHz input to the nearest kHz', () => {
    expect(mhzToKHz(614.3751)).toBe(614375);
  });

  it('formats kHz back to a three-decimal MHz string', () => {
    expect(kHzToMHzText(614375)).toBe('614.375');
    expect(kHzToMHzText(500000)).toBe('500.000');
  });

  it('parses valid frequency text', () => {
    expect(parseFrequencyMHz('614.375')).toBe(614.375);
    expect(parseFrequencyMHz(' 614,375 ')).toBe(614.375);
  });

  it('rejects invalid frequency text', () => {
    expect(parseFrequencyMHz('')).toBeNull();
    expect(parseFrequencyMHz('abc')).toBeNull();
    expect(parseFrequencyMHz('-5')).toBeNull();
  });
});
