import { describe, expect, it } from 'vitest';
import { formatTimeAgo } from '../timeAgo';

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe('formatTimeAgo', () => {
  it('calls anything under a minute "just now"', () => {
    expect(formatTimeAgo(1000, 1000)).toBe('just now');
    expect(formatTimeAgo(0, MIN - 1)).toBe('just now');
  });

  it('counts whole minutes', () => {
    expect(formatTimeAgo(0, MIN)).toBe('1 min ago');
    expect(formatTimeAgo(0, 45 * MIN)).toBe('45 min ago');
  });

  it('counts whole hours', () => {
    expect(formatTimeAgo(0, HOUR)).toBe('1 hour ago');
    expect(formatTimeAgo(0, 5 * HOUR)).toBe('5 hours ago');
  });

  it('says yesterday for one day back', () => {
    expect(formatTimeAgo(0, DAY)).toBe('yesterday');
  });

  it('counts days up to a week', () => {
    expect(formatTimeAgo(0, 3 * DAY)).toBe('3 days ago');
    expect(formatTimeAgo(0, 6 * DAY)).toBe('6 days ago');
  });

  it('falls back to a date beyond a week', () => {
    expect(formatTimeAgo(0, 30 * DAY)).toBe(new Date(0).toLocaleDateString());
  });

  it('never reports the future as elapsed time', () => {
    expect(formatTimeAgo(10 * MIN, 0)).toBe('just now');
  });
});
