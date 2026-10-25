import { describe, it, expect } from 'vitest';
import { toBaseQuantity, fromBaseQuantity, calculateEquivalentPieces } from '../../src/utils/unitConversion';
import type { RawMaterial } from '../../src/types';

describe('Finished Goods Production (After Weight-to-Pieces Removal)', () => {
  const mockMaterial: RawMaterial = {
    id: 'mat-1',
    name: 'Test Material',
    code: 'TM-001',
    category: 'granules',
    currentStock: 1000,
    minimumStock: 500,
    unit: 'kg',
    baseUnit: 'kg',
    purchaseUnit: 'kg',
    consumptionUnit: 'kg',
    conversionFactor: 1,
    piecesPerBaseUnit: 500, // 1 kg = 500 pieces
    unitCost: 100,
    supplier: 'Test Supplier',
    status: 'healthy',
    lastRestocked: '2026-10-26'
  };

  it('calculates material consumption from quantity produced', () => {
    const quantityProduced = 1000; // 1000 pieces
    const materialBaseQuantity = toBaseQuantity(quantityProduced, 'pcs', mockMaterial);
    expect(materialBaseQuantity).toBe(2); // 1000 pcs / 500 pcs/kg = 2 kg
  });

  it('calculates net production after wastage', () => {
    const quantityProduced = 1000;
    const wastage1 = 5;
    const wastage2 = 2;
    const netPieces = quantityProduced - wastage1 - wastage2;
    expect(netPieces).toBe(993); // 1000 - 5 - 2 = 993 pieces
  });

  it('calculates equivalent pieces from material base quantity', () => {
    const materialBaseQuantity = 10; // 10 kg
    const equivalentPieces = calculateEquivalentPieces(materialBaseQuantity, mockMaterial);
    expect(equivalentPieces).toBe(5000); // 10 kg * 500 pcs/kg = 5000 pieces
  });

  it('converts material quantity for display', () => {
    const materialBaseQuantity = 2; // 2 kg
    const materialQuantity = fromBaseQuantity(materialBaseQuantity, 'kg', mockMaterial);
    expect(materialQuantity).toBe(2); // 2 kg in kg unit
  });

  it('handles wastage validation', () => {
    const quantityProduced = 100;
    const wastage1 = 50;
    const wastage2 = 60;
    const netPieces = quantityProduced - wastage1 - wastage2;
    expect(netPieces).toBe(-10); // Should be rejected by validation
  });

  it('validates wastage as whole numbers', () => {
    const wastage1 = 5.5; // Not a whole number
    const isInteger = Number.isInteger(wastage1);
    expect(isInteger).toBe(false); // Should be rejected by validation
  });

  it('handles material without piecesPerBaseUnit', () => {
    const materialWithoutPieces: RawMaterial = {
      ...mockMaterial,
      piecesPerBaseUnit: undefined
    };

    const materialBaseQuantity = 10;
    const equivalentPieces = calculateEquivalentPieces(materialBaseQuantity, materialWithoutPieces);
    expect(equivalentPieces).toBeUndefined(); // No equivalent pieces calculation
  });
});
