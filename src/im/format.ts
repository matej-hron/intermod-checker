const MINUS = '\u2212';

export function carrierLetter(index: number): string {
  return String.fromCharCode(65 + index);
}

export function formatProduct(coeffs: readonly number[]): string {
  let text = '';
  for (let i = 0; i < coeffs.length; i += 1) {
    const c = coeffs[i];
    if (c === 0) continue;

    const magnitude = Math.abs(c);
    const term = (magnitude === 1 ? '' : String(magnitude)) + carrierLetter(i);

    if (text === '') {
      text = c < 0 ? `${MINUS}${term}` : term;
    } else {
      text += c < 0 ? ` ${MINUS} ${term}` : ` + ${term}`;
    }
  }
  return text;
}
