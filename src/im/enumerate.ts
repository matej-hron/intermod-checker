export type VectorVisitor = (
  coeffs: readonly number[],
  order: number,
) => boolean | void;

/**
 * Enumerates canonical intermodulation coefficient vectors.
 *
 * A vector is canonical when its first non-zero coefficient is positive, which
 * makes each vector/negation pair appear exactly once.
 *
 * The array handed to `visit` is reused between calls — copy it to retain it.
 * Returning `false` from `visit` aborts enumeration.
 */
export function enumerateVectors(
  n: number,
  lowOrder: number,
  highOrder: number,
  oddOnly: boolean,
  visit: VectorVisitor,
): number {
  const coeffs = new Array<number>(n).fill(0);
  let visited = 0;
  let aborted = false;

  const recurse = (index: number, used: number, seenNonZero: boolean): void => {
    if (aborted) return;

    if (index === n) {
      if (!seenNonZero) return;
      if (used < lowOrder) return;
      if (oddOnly && used % 2 === 0) return;
      visited += 1;
      if (visit(coeffs, used) === false) aborted = true;
      return;
    }

    const remaining = highOrder - used;
    // Canonical form: before the first non-zero coefficient, only zero or
    // positive values are allowed. Guard against `-0` (`remaining === 0`)
    // so a canonical zero coefficient is never stored as negative zero.
    const lowest = seenNonZero && remaining > 0 ? -remaining : 0;

    for (let c = lowest; c <= remaining; c += 1) {
      coeffs[index] = c;
      recurse(index + 1, used + Math.abs(c), seenNonZero || c !== 0);
      if (aborted) {
        coeffs[index] = 0;
        return;
      }
    }
    coeffs[index] = 0;
  };

  recurse(0, 0, false);
  return visited;
}
