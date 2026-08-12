const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

/**
 * "Edited 5 min ago" for the projects list. `now` is a parameter rather than a
 * `Date.now()` call so the function is pure and its tests need no clock.
 * A negative elapsed time means a clock change, not the future, so it reads as
 * "just now" instead of a nonsense count.
 */
export function formatTimeAgo(then: number, now: number): string {
  const elapsed = now - then;
  if (elapsed < MINUTE) return 'just now';

  if (elapsed < HOUR) {
    const mins = Math.floor(elapsed / MINUTE);
    return `${mins} min ago`;
  }
  if (elapsed < DAY) {
    const hours = Math.floor(elapsed / HOUR);
    return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
  }
  if (elapsed < WEEK) {
    const days = Math.floor(elapsed / DAY);
    return days === 1 ? 'yesterday' : `${days} days ago`;
  }
  return new Date(then).toLocaleDateString();
}
