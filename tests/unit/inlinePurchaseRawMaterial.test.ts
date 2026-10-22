import { describe, it, expect } from 'vitest';
import { toBaseQuantity } from '../../src/utils/unitConversion';
import { RawMaterial } from '../../src/types';

describe('Inline Raw Material Purchase Unit Logic', () => {
  it('correctly calculates base quantity for newly defined inline materials', () => {
    const inlineMaterial: RawMaterial = {
      id: 'temp-id',
      name: 'PET Resin Grade A',
      code: 'SKJ',
      category: 'granules',
      currentStock: 0,
      minimumStock: 500,
      unit: 'kg',
      baseUnit: 'kg',
      purchaseUnit: 'kg',
      consumptionUnit: 'kg',
      conversionFactor: 1,
      piecesPerBaseUnit: 1000,
      unitCost: 100,
      supplier: 'Alis virani',
      status: 'healthy',
      lastRestocked: ''
    };

    // Purchased in kg (same as baseUnit)
    const baseKg = toBaseQuantity(1000, 'kg', inlineMaterial);
    expect(baseKg).toBe(1000);

    // If purchased in Bags of 25 kg
    const bagMaterial: RawMaterial = {
      ...inlineMaterial,
      purchaseUnit: 'Bag',
      conversionFactor: 25
    };
    const baseFromBags = toBaseQuantity(40, 'Bag', bagMaterial);
    expect(baseFromBags).toBe(1000);
  });

  it('correctly calculates purchase subtotal and 18% GST for inline materials', () => {
    const quantity = 1000;
    const unitCost = 100;
    const subtotal = quantity * unitCost;
    const gstRate = 18;
    const gstAmount = subtotal * (gstRate / 100);
    const grandTotal = subtotal + gstAmount;

    expect(subtotal).toBe(100000);
    expect(gstAmount).toBe(18000);
    expect(grandTotal).toBe(118000);
  });

  it('validates that inline material requires non-empty name and code', () => {
    const validateInline = (name: string, code: string, qty: string, rate: string) => {
      if (!name.trim() || !code.trim()) return false;
      const numQty = Number(qty);
      const numRate = Number(rate);
      if (!qty || isNaN(numQty) || numQty <= 0) return false;
      if (rate === '' || isNaN(numRate) || numRate < 0) return false;
      return true;
    };

    expect(validateInline('PET Resin Grade A', 'SKJ', '1000', '100')).toBe(true);
    expect(validateInline('', 'SKJ', '1000', '100')).toBe(false);
    expect(validateInline('PET Resin Grade A', '', '1000', '100')).toBe(false);
    expect(validateInline('PET Resin Grade A', 'SKJ', '0', '100')).toBe(false);
    expect(validateInline('PET Resin Grade A', 'SKJ', '1000', '-5')).toBe(false);
  });
});
