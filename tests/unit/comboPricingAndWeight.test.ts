import { describe, it, expect } from 'vitest';
import { Product } from '../../src/types';
import { calculateEffectiveItemRate } from '../../src/utils/pricingUtils';
import { calculateItemWeightGrams, formatWeight } from '../../src/utils/weightUtils';

describe('Combo Pricing and Weight Calculations', () => {
  const mockBottle: Product = {
    id: 'BOTTLE-001',
    name: '500ml Bottle',
    sku: 'BTL-500',
    type: 'bottle',
    sizeOrType: '500ml',
    unit: 'pcs',
    currentStock: 1000,
    minimumStock: 100,
    priceA: 10,
    priceB: 9,
    priceC: 8,
    comboPriceA: 25,
    comboPriceB: 22,
    comboPriceC: 20,
    weightPerPiece: 20,
    weightUnit: 'g',
    status: 'active',
    createdAt: '2024-01-01'
  };

  const mockInner: Product = {
    id: 'INNER-001',
    name: '500ml Inner Liner',
    sku: 'INR-500',
    type: 'inner',
    sizeOrType: '500ml',
    unit: 'pcs',
    currentStock: 1000,
    minimumStock: 100,
    priceA: 8,
    priceB: 7,
    priceC: 6,
    weightPerPiece: 5,
    weightUnit: 'g',
    status: 'active',
    createdAt: '2024-01-01'
  };

  const mockCap: Product = {
    id: 'CAP-001',
    name: 'Standard Cap',
    sku: 'CAP-STD',
    type: 'cap',
    sizeOrType: 'Standard',
    unit: 'pcs',
    currentStock: 1000,
    minimumStock: 100,
    priceA: 7,
    priceB: 6,
    priceC: 5,
    weightPerPiece: 3,
    weightUnit: 'g',
    status: 'active',
    createdAt: '2024-01-01'
  };

  const mockAlternativeCap: Product = {
    id: 'CAP-002',
    name: 'Premium Cap',
    sku: 'CAP-PRM',
    type: 'cap',
    sizeOrType: 'Premium',
    unit: 'pcs',
    currentStock: 1000,
    minimumStock: 100,
    priceA: 12,
    priceB: 11,
    priceC: 10,
    weightPerPiece: 5,
    weightUnit: 'g',
    status: 'active',
    createdAt: '2024-01-01'
  };

  const mockAlternativeInner: Product = {
    id: 'INNER-002',
    name: 'Premium Inner Liner',
    sku: 'INR-PRM',
    type: 'inner',
    sizeOrType: 'Premium',
    unit: 'pcs',
    currentStock: 1000,
    minimumStock: 100,
    priceA: 15,
    priceB: 14,
    priceC: 13,
    weightPerPiece: 8,
    weightUnit: 'g',
    status: 'active',
    createdAt: '2024-01-01'
  };

  it('uses configured combo price when both inner and cap are selected (Category A)', () => {
    const rate = calculateEffectiveItemRate({
      product: mockBottle,
      category: 'A',
      innerProduct: mockInner,
      capProduct: mockCap
    });
    expect(rate).toBe(25); // Uses comboPriceA
  });

  it('recalculates price when cap changes from standard to premium (Category A)', () => {
    const rateWithStandardCap = calculateEffectiveItemRate({
      product: mockBottle,
      category: 'A',
      innerProduct: mockInner,
      capProduct: mockCap
    });
    expect(rateWithStandardCap).toBe(25); // Uses comboPriceA

    const rateWithPremiumCap = calculateEffectiveItemRate({
      product: mockBottle,
      category: 'A',
      innerProduct: mockInner,
      capProduct: mockAlternativeCap
    });
    // Fallback to sum since comboPriceA is for standard cap
    expect(rateWithPremiumCap).toBe(10 + 8 + 12); // Bottle A + Inner A + Premium Cap A
  });

  it('recalculates price when inner changes from standard to premium (Category A)', () => {
    const rateWithStandardInner = calculateEffectiveItemRate({
      product: mockBottle,
      category: 'A',
      innerProduct: mockInner,
      capProduct: mockCap
    });
    expect(rateWithStandardInner).toBe(25); // Uses comboPriceA

    const rateWithPremiumInner = calculateEffectiveItemRate({
      product: mockBottle,
      category: 'A',
      innerProduct: mockAlternativeInner,
      capProduct: mockCap
    });
    // Fallback to sum since comboPriceA is for standard inner
    expect(rateWithPremiumInner).toBe(10 + 15 + 7); // Bottle A + Premium Inner A + Cap A
  });

  it('recalculates price when cap is removed (bottle + inner only)', () => {
    const rateWithCap = calculateEffectiveItemRate({
      product: mockBottle,
      category: 'A',
      innerProduct: mockInner,
      capProduct: mockCap
    });
    expect(rateWithCap).toBe(25); // Uses comboPriceA

    const rateWithoutCap = calculateEffectiveItemRate({
      product: mockBottle,
      category: 'A',
      innerProduct: mockInner,
      capProduct: null
    });
    expect(rateWithoutCap).toBe(10 + 8); // Bottle A + Inner A
  });

  it('recalculates price when inner is removed (bottle + cap only)', () => {
    const rateWithInner = calculateEffectiveItemRate({
      product: mockBottle,
      category: 'A',
      innerProduct: mockInner,
      capProduct: mockCap
    });
    expect(rateWithInner).toBe(25); // Uses comboPriceA

    const rateWithoutInner = calculateEffectiveItemRate({
      product: mockBottle,
      category: 'A',
      innerProduct: null,
      capProduct: mockCap
    });
    expect(rateWithoutInner).toBe(10 + 7); // Bottle A + Cap A
  });

  it('recalculates price when both cap and inner are removed (bottle only)', () => {
    const rateWithBoth = calculateEffectiveItemRate({
      product: mockBottle,
      category: 'A',
      innerProduct: mockInner,
      capProduct: mockCap
    });
    expect(rateWithBoth).toBe(25); // Uses comboPriceA

    const rateWithoutBoth = calculateEffectiveItemRate({
      product: mockBottle,
      category: 'A',
      innerProduct: null,
      capProduct: null
    });
    expect(rateWithoutBoth).toBe(10); // Bottle A only
  });

  it('recalculates price correctly for Category B pricing', () => {
    const rateWithStandard = calculateEffectiveItemRate({
      product: mockBottle,
      category: 'B',
      innerProduct: mockInner,
      capProduct: mockCap
    });
    expect(rateWithStandard).toBe(22); // Uses comboPriceB

    const rateWithPremiumCap = calculateEffectiveItemRate({
      product: mockBottle,
      category: 'B',
      innerProduct: mockInner,
      capProduct: mockAlternativeCap
    });
    expect(rateWithPremiumCap).toBe(9 + 7 + 11); // Bottle B + Inner B + Premium Cap B
  });

  it('recalculates price correctly for Category C pricing', () => {
    const rateWithStandard = calculateEffectiveItemRate({
      product: mockBottle,
      category: 'C',
      innerProduct: mockInner,
      capProduct: mockCap
    });
    expect(rateWithStandard).toBe(20); // Uses comboPriceC

    const rateWithPremiumInner = calculateEffectiveItemRate({
      product: mockBottle,
      category: 'C',
      innerProduct: mockAlternativeInner,
      capProduct: mockCap
    });
    expect(rateWithPremiumInner).toBe(8 + 13 + 5); // Bottle C + Premium Inner C + Cap C
  });

  it('handles non-bottle products correctly (no combo pricing)', () => {
    const mockBottleOnly: Product = {
      id: 'BOTTLE-002',
      name: '1L Bottle',
      sku: 'BTL-1L',
      type: 'bottle',
      sizeOrType: '1L',
      unit: 'pcs',
      currentStock: 1000,
      minimumStock: 100,
      priceA: 15,
      priceB: 14,
      priceC: 13,
      weightPerPiece: 30,
      weightUnit: 'g',
      status: 'active',
      createdAt: '2024-01-01'
    };

    const rate = calculateEffectiveItemRate({
      product: mockBottleOnly,
      category: 'A',
      innerProduct: null,
      capProduct: null
    });
    expect(rate).toBe(15); // Just the bottle price
  });

  // ==================== COMBO WEIGHT CALCULATION TESTS ====================

  it('calculates combined weight for bottle + inner + cap combo', () => {
    const quantity = 100;
    const weight = calculateItemWeightGrams({
      product: mockBottle,
      quantity,
      innerProduct: mockInner,
      capProduct: mockCap
    });
    // Bottle: 20g × 100 = 2000g
    // Inner: 5g × 100 = 500g
    // Cap: 3g × 100 = 300g
    // Total: 2800g
    expect(weight).toBe(2800);
    expect(formatWeight(weight)).toBe('2.8 kg');
  });

  it('recalculates weight when cap changes from standard to premium', () => {
    const quantity = 50;
    const weightWithStandardCap = calculateItemWeightGrams({
      product: mockBottle,
      quantity,
      innerProduct: mockInner,
      capProduct: mockCap
    });
    // Bottle: 20g × 50 = 1000g
    // Inner: 5g × 50 = 250g
    // Standard Cap: 3g × 50 = 150g
    // Total: 1400g
    expect(weightWithStandardCap).toBe(1400);

    const weightWithPremiumCap = calculateItemWeightGrams({
      product: mockBottle,
      quantity,
      innerProduct: mockInner,
      capProduct: mockAlternativeCap
    });
    // Bottle: 20g × 50 = 1000g
    // Inner: 5g × 50 = 250g
    // Premium Cap: 5g × 50 = 250g
    // Total: 1500g
    expect(weightWithPremiumCap).toBe(1500);
  });

  it('recalculates weight when inner changes from standard to premium', () => {
    const quantity = 50;
    const weightWithStandardInner = calculateItemWeightGrams({
      product: mockBottle,
      quantity,
      innerProduct: mockInner,
      capProduct: mockCap
    });
    // Total: 1400g (as above)
    expect(weightWithStandardInner).toBe(1400);

    const weightWithPremiumInner = calculateItemWeightGrams({
      product: mockBottle,
      quantity,
      innerProduct: mockAlternativeInner,
      capProduct: mockCap
    });
    // Bottle: 20g × 50 = 1000g
    // Premium Inner: 8g × 50 = 400g
    // Cap: 3g × 50 = 150g
    // Total: 1550g
    expect(weightWithPremiumInner).toBe(1550);
  });

  it('calculates weight for bottle + inner only (no cap)', () => {
    const quantity = 100;
    const weight = calculateItemWeightGrams({
      product: mockBottle,
      quantity,
      innerProduct: mockInner,
      capProduct: null
    });
    // Bottle: 20g × 100 = 2000g
    // Inner: 5g × 100 = 500g
    // Total: 2500g
    expect(weight).toBe(2500);
    expect(formatWeight(weight)).toBe('2.5 kg');
  });

  it('calculates weight for bottle + cap only (no inner)', () => {
    const quantity = 100;
    const weight = calculateItemWeightGrams({
      product: mockBottle,
      quantity,
      innerProduct: null,
      capProduct: mockCap
    });
    // Bottle: 20g × 100 = 2000g
    // Cap: 3g × 100 = 300g
    // Total: 2300g
    expect(weight).toBe(2300);
    expect(formatWeight(weight)).toBe('2.3 kg');
  });

  it('calculates weight for bottle only (no combo)', () => {
    const quantity = 100;
    const weight = calculateItemWeightGrams({
      product: mockBottle,
      quantity,
      innerProduct: null,
      capProduct: null
    });
    // Bottle: 20g × 100 = 2000g
    // Total: 2000g
    expect(weight).toBe(2000);
    expect(formatWeight(weight)).toBe('2 kg');
  });

  it('handles missing component weights safely', () => {
    const bottleNoWeight: Product = {
      ...mockBottle,
      weightPerPiece: undefined
    };
    const innerNoWeight: Product = {
      ...mockInner,
      weightPerPiece: undefined
    };

    const quantity = 100;
    const weight = calculateItemWeightGrams({
      product: bottleNoWeight,
      quantity,
      innerProduct: innerNoWeight,
      capProduct: mockCap
    });
    // Only cap has weight: 3g × 100 = 300g
    expect(weight).toBe(300);
  });

  it('returns null when no components have weights', () => {
    const bottleNoWeight: Product = {
      ...mockBottle,
      weightPerPiece: undefined
    };
    const innerNoWeight: Product = {
      ...mockInner,
      weightPerPiece: undefined
    };
    const capNoWeight: Product = {
      ...mockCap,
      weightPerPiece: undefined
    };

    const weight = calculateItemWeightGrams({
      product: bottleNoWeight,
      quantity: 100,
      innerProduct: innerNoWeight,
      capProduct: capNoWeight
    });
    expect(weight).toBeNull();
  });

  it('handles invalid weight values safely', () => {
    const bottleInvalidWeight: Product = {
      ...mockBottle,
      weightPerPiece: -10 // Invalid negative weight
    };

    const quantity = 100;
    const weight = calculateItemWeightGrams({
      product: bottleInvalidWeight,
      quantity,
      innerProduct: mockInner,
      capProduct: mockCap
    });
    // Bottle weight is invalid, so only inner + cap: 5g × 100 + 3g × 100 = 800g
    expect(weight).toBe(800);
  });
});
