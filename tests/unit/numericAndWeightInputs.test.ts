import { describe, it, expect } from 'vitest';
import { cleanDecimalInput, cleanIntegerInput } from '../../src/utils/packetUtils';
import { formatPrice } from '../../src/utils/pricingUtils';
import { getWeightInGrams, formatWeight, formatPieceWeight } from '../../src/utils/weightUtils';

describe('cleanDecimalInput', () => {
  it('strips unwanted leading zeros from integers', () => {
    expect(cleanDecimalInput('0780')).toBe('780');
    expect(cleanDecimalInput('04000')).toBe('4000');
    expect(cleanDecimalInput('07')).toBe('7');
    expect(cleanDecimalInput('007')).toBe('7');
    expect(cleanDecimalInput('0100')).toBe('100');
  });

  it('strips leading zeros before decimal point while preserving decimal values', () => {
    expect(cleanDecimalInput('06.50')).toBe('6.50');
    expect(cleanDecimalInput('0100.25')).toBe('100.25');
    expect(cleanDecimalInput('00.5')).toBe('0.5');
  });

  it('preserves valid decimals starting with zero', () => {
    expect(cleanDecimalInput('0.5')).toBe('0.5');
    expect(cleanDecimalInput('0.05')).toBe('0.05');
    expect(cleanDecimalInput('0.00')).toBe('0.00');
    expect(cleanDecimalInput('0.25')).toBe('0.25');
  });

  it('preserves user input during typing (allows partial decimal)', () => {
    expect(cleanDecimalInput('.')).toBe('.');
    expect(cleanDecimalInput('0.')).toBe('0.');
    expect(cleanDecimalInput('.5')).toBe('0.5');
    expect(cleanDecimalInput('10.')).toBe('10.');
    expect(cleanDecimalInput('10.0')).toBe('10.0');
  });

  it('keeps single zero intact', () => {
    expect(cleanDecimalInput('0')).toBe('0');
    expect(cleanDecimalInput('00')).toBe('0');
  });

  it('keeps empty input empty', () => {
    expect(cleanDecimalInput('')).toBe('');
  });

  it('filters non-numeric characters', () => {
    expect(cleanDecimalInput('₹780')).toBe('780');
    expect(cleanDecimalInput('abc')).toBe('');
  });
});

describe('cleanIntegerInput', () => {
  it('strips unwanted leading zeros from integers', () => {
    expect(cleanIntegerInput('0780')).toBe('780');
    expect(cleanIntegerInput('04000')).toBe('4000');
    expect(cleanIntegerInput('07')).toBe('7');
    expect(cleanIntegerInput('00123')).toBe('123');
  });

  it('preserves single zero and handles multiple zeros', () => {
    expect(cleanIntegerInput('0')).toBe('0');
    expect(cleanIntegerInput('00')).toBe('0');
  });

  it('returns empty string for empty input', () => {
    expect(cleanIntegerInput('')).toBe('');
  });
});

describe('formatPrice', () => {
  it('formats numbers and strings cleanly without leading zeros', () => {
    expect(formatPrice('07')).toBe('₹7.00');
    expect(formatPrice('06.50')).toBe('₹6.50');
    expect(formatPrice(7)).toBe('₹7.00');
    expect(formatPrice(6.5)).toBe('₹6.50');
    expect(formatPrice('0.5')).toBe('₹0.50');
  });

  it('handles null, undefined, or empty with placeholder', () => {
    expect(formatPrice(null)).toBe('-');
    expect(formatPrice(undefined)).toBe('-');
    expect(formatPrice('')).toBe('-');
  });
});

describe('weightUtils handling strings and numbers', () => {
  it('formats piece weight properly from number or string', () => {
    expect(formatPieceWeight(15, 'g')).toBe('15 g / piece');
    expect(formatPieceWeight('15', 'g')).toBe('15 g / piece');
    expect(formatPieceWeight('0.5', 'g')).toBe('0.5 g / piece');
    expect(formatPieceWeight(0.5, 'g')).toBe('0.5 g / piece');
  });

  it('formats total weight properly from number or string', () => {
    expect(formatWeight(1500)).toBe('1.5 kg');
    expect(formatWeight('1500')).toBe('1.5 kg');
    expect(formatWeight(500)).toBe('500 g');
    expect(formatWeight('500')).toBe('500 g');
  });

  it('calculates getWeightInGrams properly from number or string', () => {
    expect(getWeightInGrams(15, 'g')).toBe(15);
    expect(getWeightInGrams('15', 'g')).toBe(15);
    expect(getWeightInGrams('1.5', 'kg')).toBe(1500);
    expect(getWeightInGrams(1.5, 'kg')).toBe(1500);
  });
});

describe('Product Spec Weight resolution in Edit modal', () => {
  function resolveWeight(initialProduct: any): string {
    const rawWeight = initialProduct.weightPerPiece ??
      initialProduct.weight ??
      initialProduct.pieceWeight ??
      initialProduct.weightPerPieceGrams ??
      initialProduct.unitWeight;
    const numWeight = rawWeight !== undefined && rawWeight !== null && rawWeight !== '' ? Number(rawWeight) : NaN;
    return !isNaN(numWeight) && numWeight > 0 ? cleanDecimalInput(String(rawWeight)) : '';
  }

  it('extracts weight when stored as numeric weightPerPiece', () => {
    expect(resolveWeight({ weightPerPiece: 15 })).toBe('15');
  });

  it('extracts weight when stored as string weightPerPiece (e.g. from form input)', () => {
    expect(resolveWeight({ weightPerPiece: '15' })).toBe('15');
    expect(resolveWeight({ weightPerPiece: '015' })).toBe('15');
    expect(resolveWeight({ weightPerPiece: '0.5' })).toBe('0.5');
  });

  it('extracts weight from legacy or alternate fields', () => {
    expect(resolveWeight({ weight: 25 })).toBe('25');
    expect(resolveWeight({ pieceWeight: '30' })).toBe('30');
    expect(resolveWeight({ weightPerPieceGrams: 50 })).toBe('50');
  });

  it('returns empty string if no weight is configured', () => {
    expect(resolveWeight({})).toBe('');
    expect(resolveWeight({ weightPerPiece: undefined })).toBe('');
    expect(resolveWeight({ weightPerPiece: 0 })).toBe('');
  });
});
