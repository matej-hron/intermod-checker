import { describe, it, expect } from 'vitest';
import { carrierLetter, formatProduct } from '../format';

describe('carrierLetter', () => {
  it('maps indexes to letters in input order', () => {
    expect(carrierLetter(0)).toBe('A');
    expect(carrierLetter(1)).toBe('B');
    expect(carrierLetter(23)).toBe('X');
  });
});

describe('formatProduct', () => {
  it('formats a third-order two-carrier product', () => {
    expect(formatProduct([2, -1])).toBe('2A − B');
  });

  it('omits the coefficient when it is one', () => {
    expect(formatProduct([1, 1, -1])).toBe('A + B − C');
  });

  it('formats a fifth-order product', () => {
    expect(formatProduct([3, -2])).toBe('3A − 2B');
  });

  it('skips zero coefficients', () => {
    expect(formatProduct([0, 3, 0])).toBe('3B');
  });

  it('prefixes a leading negative term with a minus sign', () => {
    expect(formatProduct([-1, 2])).toBe('−A + 2B');
  });
});
