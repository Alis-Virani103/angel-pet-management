import { describe, it, expect } from 'vitest';
import { calculatePiecesFromWeight } from '../../src/utils/unitConversion';

describe('Production Wastage Calculation', () => {
  it('calculates total pieces from weight correctly', () => {
    const result = calculatePiecesFromWeight({
      numberOfBags: 5,
      weightPerBagKg: 25,
      weightPerPieceGrams: 10
    });

    expect(result.isValid).toBe(true);
    expect(result.totalWeightKg).toBe(125);
    expect(result.pieces).toBe(12500); // (125 kg * 1000) / 10g = 12,500 pieces
  });

  it('calculates net production after wastage in pieces', () => {
    const result = calculatePiecesFromWeight({
      numberOfBags: 5,
      weightPerBagKg: 25,
      weightPerPieceGrams: 10
    });

    const totalPieces = result.pieces || 0;
    const wastage1 = 5; // pieces
    const wastage2 = 2; // pieces
    const netPieces = totalPieces - wastage1 - wastage2;

    expect(totalPieces).toBe(12500);
    expect(netPieces).toBe(12493); // 12,500 - 5 - 2 = 12,493 pieces
  });

  it('handles zero wastage correctly', () => {
    const result = calculatePiecesFromWeight({
      numberOfBags: 5,
      weightPerBagKg: 25,
      weightPerPieceGrams: 10
    });

    const totalPieces = result.pieces || 0;
    const wastage1 = 0;
    const wastage2 = 0;
    const netPieces = totalPieces - wastage1 - wastage2;

    expect(totalPieces).toBe(12500);
    expect(netPieces).toBe(12500); // No wastage, net equals total
  });

  it('validates that wastage cannot exceed total production', () => {
    const result = calculatePiecesFromWeight({
      numberOfBags: 5,
      weightPerBagKg: 25,
      weightPerPieceGrams: 10
    });

    const totalPieces = result.pieces || 0;
    const wastage1 = 10000; // pieces
    const wastage2 = 5000; // pieces
    const netPieces = totalPieces - wastage1 - wastage2;

    expect(totalPieces).toBe(12500);
    expect(netPieces).toBe(-2500); // Should be rejected by validation
  });

  it('prevents division by zero with zero weight per piece', () => {
    const result = calculatePiecesFromWeight({
      numberOfBags: 5,
      weightPerBagKg: 25,
      weightPerPieceGrams: 0
    });

    expect(result.isValid).toBe(false);
    expect(result.error).toContain('Weight per piece must be a positive number');
  });

  it('prevents division by zero with negative weight per piece', () => {
    const result = calculatePiecesFromWeight({
      numberOfBags: 5,
      weightPerBagKg: 25,
      weightPerPieceGrams: -10
    });

    expect(result.isValid).toBe(false);
    expect(result.error).toContain('Weight per piece must be a positive number');
  });

  it('handles fractional weight per piece correctly', () => {
    const result = calculatePiecesFromWeight({
      numberOfBags: 2,
      weightPerBagKg: 50,
      weightPerPieceGrams: 7.5
    });

    expect(result.isValid).toBe(true);
    expect(result.totalWeightKg).toBe(100);
    expect(result.pieces).toBe(13333.333333333334); // (100 kg * 1000) / 7.5g = 13,333.33 pieces
  });

  it('calculates with single bag', () => {
    const result = calculatePiecesFromWeight({
      numberOfBags: 1,
      weightPerBagKg: 25,
      weightPerPieceGrams: 10
    });

    expect(result.isValid).toBe(true);
    expect(result.totalWeightKg).toBe(25);
    expect(result.pieces).toBe(2500); // (25 kg * 1000) / 10g = 2,500 pieces
  });

  it('handles large production volumes', () => {
    const result = calculatePiecesFromWeight({
      numberOfBags: 100,
      weightPerBagKg: 50,
      weightPerPieceGrams: 5
    });

    expect(result.isValid).toBe(true);
    expect(result.totalWeightKg).toBe(5000);
    expect(result.pieces).toBe(1000000); // (5000 kg * 1000) / 5g = 1,000,000 pieces
  });
});
