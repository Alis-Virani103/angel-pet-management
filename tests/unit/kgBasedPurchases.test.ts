import { describe, it, expect } from 'vitest';
import { getReceivedPurchaseBaseQuantity } from '../../src/utils/unitConversion';
import type { RawMaterial, PurchaseItem } from '../../src/types';

describe('Kilogram-Based Purchases (No Bag Conversion)', () => {
  const kgMaterial: RawMaterial = {
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
    unitCost: 100,
    supplier: 'Test Supplier',
    status: 'healthy',
    lastRestocked: '2026-10-26'
  };

  it('handles simple kg purchase without bag conversion', () => {
    const purchaseItem: PurchaseItem = {
      rawMaterialId: 'mat-1',
      rawMaterialName: 'Test Material',
      hsnSac: '1234',
      category: 'granules',
      unit: 'kg',
      unitCost: 100,
      quantity: 500,
      subtotal: 50000
    };

    const baseQuantity = getReceivedPurchaseBaseQuantity(purchaseItem, kgMaterial);
    expect(baseQuantity).toBe(500); // Direct kg conversion
  });

  it('handles gram-based purchase', () => {
    const gMaterial: RawMaterial = {
      ...kgMaterial,
      baseUnit: 'g',
      unit: 'g',
      purchaseUnit: 'g',
      consumptionUnit: 'g'
    };

    const purchaseItem: PurchaseItem = {
      rawMaterialId: 'mat-1',
      rawMaterialName: 'Test Material',
      hsnSac: '1234',
      category: 'granules',
      unit: 'g',
      unitCost: 0.1,
      quantity: 5000,
      subtotal: 500
    };

    const baseQuantity = getReceivedPurchaseBaseQuantity(purchaseItem, gMaterial);
    expect(baseQuantity).toBe(5000); // Direct g conversion
  });

  it('handles purchase with bags but no weight fields (falls back to quantity)', () => {
    const purchaseItem: PurchaseItem = {
      rawMaterialId: 'mat-1',
      rawMaterialName: 'Test Material',
      hsnSac: '1234',
      category: 'granules',
      unit: 'kg',
      unitCost: 100,
      quantity: 500,
      subtotal: 50000,
      numberOfBags: 10 // But no weight per bag or weight per piece
    };

    const baseQuantity = getReceivedPurchaseBaseQuantity(purchaseItem, kgMaterial);
    expect(baseQuantity).toBe(500); // Falls back to quantity field
  });

  it('handles purchase with conversion factor but no bag fields', () => {
    const materialWithConversion: RawMaterial = {
      ...kgMaterial,
      purchaseUnit: 'Bag',
      conversionFactor: 50, // 1 Bag = 50 kg
    };

    const purchaseItem: PurchaseItem = {
      rawMaterialId: 'mat-1',
      rawMaterialName: 'Test Material',
      hsnSac: '1234',
      category: 'granules',
      unit: 'Bag',
      unitCost: 5000,
      quantity: 10, // 10 Bags
      subtotal: 50000
    };

    const baseQuantity = getReceivedPurchaseBaseQuantity(purchaseItem, materialWithConversion);
    expect(baseQuantity).toBe(500); // 10 Bags * 50 kg/Bag = 500 kg
  });
});
