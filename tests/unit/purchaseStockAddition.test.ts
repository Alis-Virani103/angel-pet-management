import { describe, it, expect } from 'vitest';
import { getReceivedPurchaseBaseQuantity } from '../../src/utils/unitConversion';
import type { RawMaterial, PurchaseItem } from '../../src/types';

describe('Purchase Stock Addition with Weight-to-Pieces', () => {
  const mockMaterial: RawMaterial = {
    id: 'mat-1',
    name: 'Test Material',
    code: 'TM-001',
    category: 'granules',
    currentStock: 1000,
    minimumStock: 500,
    unit: 'kg',
    baseUnit: 'kg',
    purchaseUnit: 'Bag',
    consumptionUnit: 'kg',
    conversionFactor: 50, // 1 Bag = 50 kg
    piecesPerBaseUnit: 500, // 1 kg = 500 pieces
    unitCost: 100,
    supplier: 'Test Supplier',
    status: 'healthy',
    lastRestocked: '2026-10-26'
  };

  it('calculates stock addition using bag conversion', () => {
    const purchaseItem: PurchaseItem = {
      rawMaterialId: 'mat-1',
      rawMaterialName: 'Test Material',
      hsnSac: '1234',
      category: 'granules',
      unit: 'Bag',
      unitCost: 100,
      quantity: 5, // 5 Bags
      subtotal: 500,
      numberOfBags: 5,
      weightPerBagKg: 25,
      weightPerPieceGrams: 10,
      totalWeightGrams: 125000,
      calculatedPieces: 12500
    };

    const baseQuantity = getReceivedPurchaseBaseQuantity(purchaseItem, mockMaterial);
    expect(baseQuantity).toBe(125); // 5 bags * 25 kg/bag = 125 kg (uses actual weight per bag from purchase)
  });

  it('calculates stock addition using direct kg quantity', () => {
    const purchaseItem: PurchaseItem = {
      rawMaterialId: 'mat-1',
      rawMaterialName: 'Test Material',
      hsnSac: '1234',
      category: 'granules',
      unit: 'kg',
      unitCost: 100,
      quantity: 100, // 100 kg
      subtotal: 10000
    };

    const baseQuantity = getReceivedPurchaseBaseQuantity(purchaseItem, mockMaterial);
    expect(baseQuantity).toBe(100); // 100 kg in base unit
  });

  it('calculates stock addition using pieces', () => {
    const purchaseItem: PurchaseItem = {
      rawMaterialId: 'mat-1',
      rawMaterialName: 'Test Material',
      hsnSac: '1234',
      category: 'granules',
      unit: 'pcs',
      unitCost: 0.2,
      quantity: 1000, // 1000 pieces
      subtotal: 200
    };

    const baseQuantity = getReceivedPurchaseBaseQuantity(purchaseItem, mockMaterial);
    expect(baseQuantity).toBe(2); // 1000 pcs / 500 pcs/kg = 2 kg
  });

  it('avoids double-counting when bag conversion is used', () => {
    const purchaseItem: PurchaseItem = {
      rawMaterialId: 'mat-1',
      rawMaterialName: 'Test Material',
      hsnSac: '1234',
      category: 'granules',
      unit: 'Bag',
      unitCost: 100,
      quantity: 5, // This would be ignored in favor of bag conversion
      subtotal: 500,
      numberOfBags: 5,
      weightPerBagKg: 25,
      weightPerPieceGrams: 10,
      totalWeightGrams: 125000,
      calculatedPieces: 12500
    };

    const baseQuantity = getReceivedPurchaseBaseQuantity(purchaseItem, mockMaterial);
    expect(baseQuantity).toBe(125); // Uses bag conversion (5 * 25 kg), not quantity field
  });

  it('handles material without bag conversion fields', () => {
    const simpleMaterial: RawMaterial = {
      ...mockMaterial,
      purchaseUnit: 'kg',
      conversionFactor: 1
    };

    const purchaseItem: PurchaseItem = {
      rawMaterialId: 'mat-1',
      rawMaterialName: 'Test Material',
      hsnSac: '1234',
      category: 'granules',
      unit: 'kg',
      unitCost: 100,
      quantity: 100,
      subtotal: 10000
    };

    const baseQuantity = getReceivedPurchaseBaseQuantity(purchaseItem, simpleMaterial);
    expect(baseQuantity).toBe(100); // Direct kg conversion
  });
});
