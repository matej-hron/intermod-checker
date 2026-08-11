/**
 * How close a product must land to count as interference, in hertz.
 *
 * `spreadHz` is the product's own occupied width, the sum of each contributing
 * carrier's deviation weighted by its coefficient. `victimDevHz` is the victim
 * receiver's width: interference happens when the product's skirt overlaps the
 * passband, so a wide digital receiver is a bigger target than a narrow one.
 *
 * Hertz rather than kilohertz because Wisycom's narrow mode deviates ±17.5 kHz
 * and this arithmetic must stay exact.
 */
export function windowHz(
  spreadHz: number,
  victimDevHz: number,
  nearHitWindowKHz: number,
): number {
  const floor = nearHitWindowKHz * 1000;
  const combined = spreadHz + victimDevHz;
  return combined > floor ? combined : floor;
}
