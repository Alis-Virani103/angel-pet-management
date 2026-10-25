import { describe, it, expect } from 'vitest';
import { calculateBagPieceConversion } from '../../src/utils/unitConversion';

describe('Purchase Weight-to-Pieces Calculation', () => {
  it('calculates total weight and pieces correctly for the example', () => {
    const result = calculateBagPieceConversion({
      numberOfBags: 5,
      weightPerBagKg: 25,
      weightPerPieceGrams: 10
    });

    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      expect(result.totalWeightGrams).toBe(125000); // 125 kg * 1000 = 125,000 g
      expect(result.calculatedPieces).toBe(12500); // 125,000 g / 10 g = 12,500 pieces
    }
  });

  it('displays total weight in kg correctly', () => {
    const result = calculateBagPieceConversion({
      numberOfBags: 5,
      weightPerBagKg: 25,
      weightPerPieceGrams: 10
    });

    if (!('error' in result)) {
      const totalWeightKg = result.totalWeightGrams / 1000;
      expect(totalWeightKg).toBe(125); // 125 kg
    }
  });

  it('handles zero or invalid weight per piece', () => {
    const result = calculateBagPieceConversion({
      numberOfBags: 5,
      weightPerBagKg: 25,
      weightPerPieceGrams: 0
    });

    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error).toContain('Weight per piece must be greater than 0');
    }
  });

  it('handles negative weight per piece', () => {
    const result = calculateBagPieceConversion({
      numberOfBags: 5,
      weightPerBagKg: 25,
      weightPerPieceGrams: -10
    });

    expect('error' in result).toBe(true);
  });

  it('handles zero number of bags', () => {
    const result = calculateBagPieceConversion({
      numberOfBags: 0,
      weightPerBagKg: 25,
      weightPerPieceGrams: 10
    });

    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error).toContain('Number of bags must be greater than 0');
    }
  });

  it('handles zero weight per bag', () => {
    const result = calculateBagPieceConversion({
      numberOfBags: 5,
      weightPerBagKg: 0,
      weightPerPieceGrams: 10
    });

    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error).toContain('Weight per bag must be greater than 0');
    }
  });

  it('updates calculation when inputs change', () => {
    const result1 = calculateBagPieceConversion({
      numberOfBags: 5,
      weightPerBagKg: 25,
      weightPerPieceGrams: 10
    });

    const result2 = calculateBagPieceConversion({
      numberOfBags: 10, // Changed from 5
      weightPerBagKg: 25,
      weightPerPieceGrams: 10
    });

    if (!('error' in result1) && !('error' in result2)) {
      expect(result2.totalWeightGrams).toBe(250000); // 10 * 25 * 1000 = 250,000 g
      expect(result2.calculatedPieces).toBe(25000); // 250,000 / 10 = 25,000 pieces
    }
  });

  it('handles fractional weight per piece', () => {
    const result = calculateBagPieceConversion({
      numberOfBags: 2,
      weightPerBagKg: 50,
      weightPerPieceGrams: 7.5
    });

    if (!('error' in result)) {
      expect(result.totalWeightGrams).toBe(100000); // 2 * 50 * 1000 = 100,000 g
      expect(result.calculatedPieces).toBe(13333.333333333334); // 100,000 / 7.5 = 13,333.33 pieces
    }
  });

  it('handles single bag', () => {
    const result = calculateBagPieceConversion({
      numberOfBags: 1,
      weightPerBagKg: 25,
      weightPerPieceGrams: 10
    });

    if (!('error' in result)) {
      expect(result.totalWeightGrams).toBe(25000); // 1 * 25 * 1000 = 25,000 g
      expect(result.calculatedPieces).toBe(2500); // 25,000 / 10 = 2,500 pieces
    }
  });
});
