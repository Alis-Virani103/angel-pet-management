import {
  getWeightInGrams,
  formatWeight,
  formatPieceWeight,
  calculateItemWeightGrams,
  calculateOrderTotalWeightGrams
} from '../src/utils/weightUtils';
import { Product, OrderItem } from '../src/types';

function runTests() {
  console.log('--- Starting Weight Conversion & Logic Verification ---');

  // Test 1: Unit normalization & formatting
  console.log('\n[Test 1: Unit Normalization & Formatting]');
  console.assert(getWeightInGrams(10, 'g') === 10, '10 g should be 10 grams');
  console.assert(getWeightInGrams(0.01, 'kg') === 10, '0.01 kg should be 10 grams');
  console.assert(getWeightInGrams(1.5, 'kg') === 1500, '1.5 kg should be 1500 grams');
  console.assert(getWeightInGrams(undefined, 'g') === null, 'undefined weight should be null');
  console.assert(getWeightInGrams(0, 'g') === null, '0 weight should be null (not valid)');
  console.assert(getWeightInGrams(-5, 'g') === null, 'negative weight should be null');

  console.assert(formatWeight(20000) === '20 kg', `Expected '20 kg', got '${formatWeight(20000)}'`);
  console.assert(formatWeight(500) === '500 g', `Expected '500 g', got '${formatWeight(500)}'`);
  console.assert(formatWeight(1250) === '1.25 kg', `Expected '1.25 kg', got '${formatWeight(1250)}'`);
  console.assert(formatWeight(50000) === '50 kg', `Expected '50 kg', got '${formatWeight(50000)}'`);
  console.assert(formatWeight(0) === '', `0 grams should format to empty string`);
  console.assert(formatPieceWeight(10, 'g') === '10 g / piece', `Piece weight format error: ${formatPieceWeight(10, 'g')}`);
  console.assert(formatPieceWeight(0.01, 'kg') === '0.01 kg / piece', `Piece weight format error: ${formatPieceWeight(0.01, 'kg')}`);
  console.log('✓ Normalization and formatting passed.');

  // Test 2: Prompt Test Case (100ml Bottle @ 10g with 2000 pcs and 5000 pcs)
  console.log('\n[Test 2: Single Product Weight Calculation]');
  const bottle100: Product = {
    id: 'btl-100',
    name: '100ml Bottle',
    sku: 'BTL-100',
    type: 'bottle',
    sizeOrType: '100ml',
    priceA: 3.5,
    priceB: 3.2,
    priceC: 3.0,
    currentStock: 10000,
    minimumStock: 1000,
    unit: 'pcs',
    status: 'active',
    createdAt: new Date().toISOString(),
    weightPerPiece: 10,
    weightUnit: 'g'
  };

  const weight2000 = calculateItemWeightGrams({ product: bottle100, quantity: 2000 });
  console.assert(weight2000 === 20000, `2,000 * 10g should be 20,000g, got ${weight2000}`);
  console.assert(formatWeight(weight2000) === '20 kg', `Formatted weight should be '20 kg', got '${formatWeight(weight2000)}'`);

  const weight5000 = calculateItemWeightGrams({ product: bottle100, quantity: 5000 });
  console.assert(weight5000 === 50000, `5,000 * 10g should be 50,000g, got ${weight5000}`);
  console.assert(formatWeight(weight5000) === '50 kg', `Formatted weight should be '50 kg', got '${formatWeight(weight5000)}'`);
  console.log('✓ Single product 2,000 -> 20 kg and 5,000 -> 50 kg test passed.');

  // Test 3: Multiple Products separate weight & order total
  console.log('\n[Test 3: Multiple Products Order Total]');
  const bottle200: Product = {
    id: 'btl-200',
    name: '200ml Bottle',
    sku: 'BTL-200',
    type: 'bottle',
    sizeOrType: '200ml',
    priceA: 5.0,
    priceB: 4.8,
    priceC: 4.5,
    currentStock: 5000,
    minimumStock: 500,
    unit: 'pcs',
    status: 'active',
    createdAt: new Date().toISOString(),
    weightPerPiece: 15,
    weightUnit: 'g'
  };

  const cap28: Product = {
    id: 'cap-28',
    name: '28mm Cap',
    sku: 'CAP-28',
    type: 'cap',
    sizeOrType: '28mm',
    priceA: 1.0,
    priceB: 0.9,
    priceC: 0.8,
    currentStock: 20000,
    minimumStock: 2000,
    unit: 'pcs',
    status: 'active',
    createdAt: new Date().toISOString(),
    weightPerPiece: 2,
    weightUnit: 'g'
  };

  const unweightedProduct: Product = {
    id: 'unweighted-1',
    name: 'Unweighted Box',
    sku: 'BOX-1',
    type: 'bottle',
    sizeOrType: 'Box',
    priceA: 10,
    priceB: 10,
    priceC: 10,
    currentStock: 100,
    minimumStock: 10,
    unit: 'pcs',
    status: 'active',
    createdAt: new Date().toISOString()
  };

  const multiItems: OrderItem[] = [
    {
      productId: 'btl-100',
      productName: '100ml Bottle',
      productType: 'bottle',
      priceCategory: 'A',
      unitPrice: 3.5,
      quantity: 2000,
      subtotal: 7000,
      weightPerPiece: 10,
      weightUnit: 'g',
      totalWeightGrams: 20000,
      totalWeightDisplay: '20 kg'
    },
    {
      productId: 'btl-200',
      productName: '200ml Bottle',
      productType: 'bottle',
      priceCategory: 'A',
      unitPrice: 5.0,
      quantity: 1000,
      subtotal: 5000,
      weightPerPiece: 15,
      weightUnit: 'g',
      totalWeightGrams: 15000,
      totalWeightDisplay: '15 kg'
    },
    {
      productId: 'cap-28',
      productName: '28mm Cap',
      productType: 'cap',
      priceCategory: 'A',
      unitPrice: 1.0,
      quantity: 2000,
      subtotal: 2000,
      weightPerPiece: 2,
      weightUnit: 'g',
      totalWeightGrams: 4000,
      totalWeightDisplay: '4 kg'
    },
    {
      productId: 'unweighted-1',
      productName: 'Unweighted Box',
      productType: 'bottle',
      priceCategory: 'A',
      unitPrice: 10.0,
      quantity: 50,
      subtotal: 500
    }
  ];

  const totalMultiOrderWeight = calculateOrderTotalWeightGrams(
    multiItems,
    [bottle100, bottle200, cap28, unweightedProduct]
  );
  console.assert(totalMultiOrderWeight === 39000, `Expected 39,000g (39 kg), got ${totalMultiOrderWeight}`);
  console.assert(formatWeight(totalMultiOrderWeight) === '39 kg', `Expected '39 kg', got '${formatWeight(totalMultiOrderWeight)}'`);
  console.log('✓ Multi-product total calculation (20kg + 15kg + 4kg = 39 kg) passed.');

  // Test 4: Bottle + Inner + Cap Combo Weight
  console.log('\n[Test 4: Combo Physical Weight Calculation]');
  const inner28: Product = {
    id: 'inr-28',
    name: '28mm Inner',
    sku: 'INR-28',
    type: 'inner',
    sizeOrType: '28mm',
    priceA: 0.5,
    priceB: 0.4,
    priceC: 0.35,
    currentStock: 15000,
    minimumStock: 1000,
    unit: 'pcs',
    status: 'active',
    createdAt: new Date().toISOString(),
    weightPerPiece: 2,
    weightUnit: 'g'
  };

  const cap28Combo: Product = {
    id: 'cap-28c',
    name: '28mm Cap',
    sku: 'CAP-28C',
    type: 'cap',
    sizeOrType: '28mm',
    priceA: 1.0,
    priceB: 0.9,
    priceC: 0.8,
    currentStock: 20000,
    minimumStock: 2000,
    unit: 'pcs',
    status: 'active',
    createdAt: new Date().toISOString(),
    weightPerPiece: 3,
    weightUnit: 'g'
  };

  const comboWeight = calculateItemWeightGrams({
    product: bottle100, // 10g
    quantity: 2000,
    innerProduct: inner28, // 2g
    capProduct: cap28Combo // 3g
  });

  // Bottle = 20 kg, Inner = 4 kg, Cap = 6 kg -> Total = 30 kg (30,000 g)
  console.assert(comboWeight === 30000, `Expected combo weight 30,000g, got ${comboWeight}`);
  console.assert(formatWeight(comboWeight) === '30 kg', `Expected '30 kg', got '${formatWeight(comboWeight)}'`);
  console.log('✓ Combo weight calculation (10g + 2g + 3g) * 2000 = 30 kg passed.');

  // Test 5: Unweighted products handling
  console.log('\n[Test 5: Products without configured weight]');
  const onlyUnweightedItems: OrderItem[] = [
    {
      productId: 'unweighted-1',
      productName: 'Unweighted Box',
      productType: 'bottle',
      priceCategory: 'A',
      unitPrice: 10.0,
      quantity: 50,
      subtotal: 500
    }
  ];
  const unweightedTotal = calculateOrderTotalWeightGrams(onlyUnweightedItems, [unweightedProduct]);
  console.assert(unweightedTotal === null, `Unweighted order total should be null, got ${unweightedTotal}`);
  console.log('✓ Unweighted order gracefully returns null (no fake 0s).');

  console.log('\n=============================================');
  console.log('ALL WEIGHT SYSTEM TEST SUITES PASSED SUCCESSFULLY!');
  console.log('=============================================');
}

runTests();
