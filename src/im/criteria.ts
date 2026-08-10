import type { Settings } from './types';

export type Verdict = 'clear' | 'near' | 'exact';

/**
 * Either an interference criterion written `{bucket}T{order}O` — `2T3O` is
 * "two transmitters, third order" — or one of the two non-interference keys
 * below.
 */
export type CriterionKey = string;

export const SPACING_CRITERION = 'spacing';
export const EXCLUSION_CRITERION = 'exclusion';

/**
 * The number of distinct carriers contributing to a product, capped at 3.
 *
 * The cap is deliberate (spec §4.1): the user acts on "two transmitters
 * interacting" versus "a combination of several", and exact counts above three
 * would multiply columns without changing any decision.
 */
export function txBucket(coeffs: readonly number[]): number {
  let count = 0;
  for (const c of coeffs) {
    if (c !== 0) {
      count += 1;
      if (count === 3) return 3;
    }
  }
  return count;
}

export function criterionKey(bucket: number, order: number): CriterionKey {
  return `${bucket}T${order}O`;
}

/**
 * Every criterion the current settings could produce, ordered by increasing
 * order then increasing bucket so the strictest test is leftmost.
 *
 * A bucket above the order is impossible: each contributing transmitter needs
 * at least one unit of order.
 */
export function realizableCriteria(settings: Settings): CriterionKey[] {
  const keys: CriterionKey[] = [];
  for (let order = settings.lowOrder; order <= settings.highOrder; order += 1) {
    if (settings.oddOnly && order % 2 === 0) continue;
    for (let bucket = 1; bucket <= 3; bucket += 1) {
      if (order < bucket) continue;
      keys.push(criterionKey(bucket, order));
    }
  }
  return keys;
}

const RANK: Record<Verdict, number> = { clear: 0, near: 1, exact: 2 };

export function verdictRank(verdict: Verdict): number {
  return RANK[verdict];
}

export function worseVerdict(a: Verdict, b: Verdict): Verdict {
  return RANK[a] >= RANK[b] ? a : b;
}

export function ordinal(order: number): string {
  if (order === 1) return '1st';
  if (order === 2) return '2nd';
  if (order === 3) return '3rd';
  return `${order}th`;
}

export function criterionLabel(key: CriterionKey): string {
  if (key === SPACING_CRITERION) return 'Minimum spacing';
  if (key === EXCLUSION_CRITERION) return 'Excluded range';
  const match = /^(\d+)T(\d+)O$/.exec(key);
  if (match === null) return key;
  const bucket = Number(match[1]);
  const order = Number(match[2]);
  const who =
    bucket === 1 ? '1 transmitter' : bucket === 3 ? '3 or more transmitters' : `${bucket} transmitters`;
  return `${who}, ${ordinal(order)} order`;
}
