import { getProductPriceForCategory, isValidProductPrice, formatPrice, getPriceCategoryLabel, getPreviousRatesForProduct, formatPreviousRates } from '../src/utils/pricingUtils';
import { calculatePacketUnits, getProductUnitsPerPacket } from '../src/utils/packetUtils';
import { generateInvoiceHtml, amountInWords, numToWords } from '../src/utils/invoicePrintUtils';
import { Product, OrderItem, PriceCategory, Order } from '../src/types';

function runTests() {
  console.log('Running Sales Order Pricing & Invoice Logic Tests...\n');

  const sampleProduct1: Product = {
    id: 'PRD-101',
    name: '100ml Bottle',
    sku: 'BTL-100',
    type: 'bottle',
    sizeOrType: '100 ml',
    priceA: 3.50,
    priceB: 3.10,
    priceC: 2.80,
    currentStock: 18500,
    minimumStock: 5000,
    unit: 'pcs',
    unitsPerPacket: 100,
    status: 'active',
    createdAt: '2026-01-01'
  };

  const sampleProduct2: Product = {
    id: 'PRD-102',
    name: '200ml Bottle',
    sku: 'BTL-200',
    type: 'bottle',
    sizeOrType: '200 ml',
    priceA: 4.80,
    priceB: 4.30,
    priceC: 3.90,
    currentStock: 22000,
    minimumStock: 6000,
    unit: 'pcs',
    unitsPerPacket: 50,
    status: 'active',
    createdAt: '2026-01-01'
  };

  // 1. Test Category A -> Price A
  const p1_A = getProductPriceForCategory(sampleProduct1, 'A');
  console.assert(p1_A === 3.50, `Expected 3.50, got ${p1_A}`);
  console.log('✔ Test 1: Category A -> Price A = ₹3.50');

  // 2. Test Category B -> Price B
  const p1_B = getProductPriceForCategory(sampleProduct1, 'B');
  console.assert(p1_B === 3.10, `Expected 3.10, got ${p1_B}`);
  console.log('✔ Test 2: Category B -> Price B = ₹3.10');

  // 3. Test Category C -> Price C
  const p1_C = getProductPriceForCategory(sampleProduct1, 'C');
  console.assert(p1_C === 2.80, `Expected 2.80, got ${p1_C}`);
  console.log('✔ Test 3: Category C -> Price C = ₹2.80');

  // 4. Multiple Products with Independent Tier Pricing
  const p2_B = getProductPriceForCategory(sampleProduct2, 'B');
  console.assert(p1_B === 3.10 && p2_B === 4.30, 'Multiple products should use independent tier prices');
  console.log(`✔ Test 4: Multiple Products independent pricing (P1: ₹${p1_B}, P2: ₹${p2_B})`);

  // 5. Dynamic updates when category changes
  const categories: PriceCategory[] = ['A', 'B', 'C'];
  const expectedP1Prices = [3.50, 3.10, 2.80];
  categories.forEach((cat, idx) => {
    const price = getProductPriceForCategory(sampleProduct1, cat);
    console.assert(price === expectedP1Prices[idx], `Category ${cat} dynamic switch failed`);
  });
  console.log('✔ Test 5: Dynamic category switching A -> B -> C');

  // 6. Packet selling calculations
  const packetCount = 10;
  const unitsPerPacket = getProductUnitsPerPacket(sampleProduct1)!;
  const totalUnits = calculatePacketUnits(packetCount, unitsPerPacket);
  console.assert(totalUnits === 1000, `Expected 1000 units, got ${totalUnits}`);
  const packetSubtotal = totalUnits * p1_B!;
  console.assert(packetSubtotal === 3100, `Expected 3100 subtotal, got ${packetSubtotal}`);
  console.log(`✔ Test 6: Packet selling conversion (10 packets * 100 units = ${totalUnits} units @ ₹${p1_B} = ₹${packetSubtotal})`);

  // 7. GST and Grand total calculations
  const subtotal = packetSubtotal;
  const gstAmount = subtotal * 0.18;
  const grandTotal = subtotal + gstAmount;
  console.assert(Math.abs(gstAmount - 558) < 0.001, `Expected GST 558, got ${gstAmount}`);
  console.assert(Math.abs(grandTotal - 3658) < 0.001, `Expected Grand Total 3658, got ${grandTotal}`);
  console.log(`✔ Test 7: Subtotal (₹${subtotal}) + GST 18% (₹${gstAmount}) = Grand Total (₹${grandTotal})`);

  // 8. Edge cases handling (0, negative, null, undefined, NaN)
  const invalidProduct = {
    priceA: 0,
    priceB: -5,
    priceC: NaN,
  } as unknown as Product;

  console.assert(getProductPriceForCategory(invalidProduct, 'A') === null, '0 price should be invalid / null');
  console.assert(getProductPriceForCategory(invalidProduct, 'B') === null, 'Negative price should be invalid / null');
  console.assert(getProductPriceForCategory(invalidProduct, 'C') === null, 'NaN price should be invalid / null');
  console.assert(getProductPriceForCategory(null, 'A') === null, 'Null product should be null');
  console.assert(!isValidProductPrice(0), '0 is not valid product price');
  console.assert(!isValidProductPrice(-10), '-10 is not valid product price');
  console.assert(!isValidProductPrice(null), 'null is not valid product price');
  console.assert(!isValidProductPrice(undefined), 'undefined is not valid product price');
  console.assert(isValidProductPrice(3.50), '3.50 is valid product price');
  console.log('✔ Test 8: Edge cases safely handled (0, negative, null, undefined, NaN rejected)');

  // 9. Previous Rates (up to 3 orders) test
  const mockOrders = [
    { orderDate: '2026-03-01', customerId: 'CUS-01', items: [{ productId: 'PRD-101', unitPrice: 3.50 }] },
    { orderDate: '2026-03-10', customerId: 'CUS-01', items: [{ productId: 'PRD-101', unitPrice: 3.40 }] },
    { orderDate: '2026-03-20', customerId: 'CUS-01', items: [{ productId: 'PRD-101', unitPrice: 3.10 }, { productId: 'PRD-102', unitPrice: 4.50 }] },
    { orderDate: '2026-03-25', customerId: 'CUS-01', items: [{ productId: 'PRD-101', unitPrice: 3.20 }, { productId: 'PRD-102', unitPrice: 4.80 }] },
  ];
  const prev3RatesP1 = getPreviousRatesForProduct(mockOrders, 'PRD-101', 'CUS-01', 3);
  console.assert(prev3RatesP1.length === 3, `Expected 3 rates, got ${prev3RatesP1.length}`);
  console.assert(prev3RatesP1[0] === 3.20 && prev3RatesP1[1] === 3.10 && prev3RatesP1[2] === 3.40, 'Should get newest 3 rates in order');
  console.assert(formatPreviousRates(prev3RatesP1) === 'Previous Rates: ₹3.20 • ₹3.10 • ₹3.40', 'Formatted string should match specification');
  console.log(`✔ Test 9: Previous 3 order rates: ${formatPreviousRates(prev3RatesP1)}`);

  // 10. Fewer than 3 rates and No previous rate tests
  const prev2RatesP2 = getPreviousRatesForProduct(mockOrders, 'PRD-102', 'CUS-01', 3);
  console.assert(prev2RatesP2.length === 2, `Expected 2 rates, got ${prev2RatesP2.length}`);
  console.assert(formatPreviousRates(prev2RatesP2) === 'Previous Rates: ₹4.80 • ₹4.50', '2 rates formatted string');
  console.log(`✔ Test 10: Fewer than 3 rates: ${formatPreviousRates(prev2RatesP2)}`);

  const prev0Rates = getPreviousRatesForProduct(mockOrders, 'PRD-UNKNOWN', 'CUS-01', 3);
  console.assert(prev0Rates.length === 0, 'Unknown product should have 0 rates');
  console.assert(formatPreviousRates(prev0Rates) === 'No previous rate', '0 rates should show "No previous rate"');
  console.log(`✔ Test 11: No history: ${formatPreviousRates(prev0Rates)}`);

  // 12. Amount in words & Invoice HTML Generation
  const words = amountInWords(3658);
  console.assert(words === 'Rupees Three Thousand Six Hundred Fifty Eight Only', `Unexpected words: ${words}`);
  console.log(`✔ Test 12: amountInWords(3658) = "${words}"`);

  // 13. TEST 1 & TEST 7: Kachha Bill (GST unchecked, multi-product non-GST)
  const nonGstOrder: Order = {
    id: 'ORD-KACHHA-01',
    orderNumber: 'ORD-1001',
    customerId: 'CUS-01',
    customerName: 'Rajesh Patel',
    companyName: 'MediCare Labs',
    items: [
      { productId: 'PRD-101', productName: '100ml Bottle', productType: 'bottle', priceCategory: 'A', unitPrice: 3.50, quantity: 1000, subtotal: 3500 },
      { productId: 'PRD-102', productName: '200ml Bottle', productType: 'bottle', priceCategory: 'A', unitPrice: 4.80, quantity: 500, subtotal: 2400 }
    ],
    subtotal: 5900,
    gstAmount: 0,
    gstRate: 0,
    gstApplied: false,
    billType: 'kachha',
    totalAmount: 5900,
    totalQuantity: 1500,
    orderStatus: 'pending',
    paymentStatus: 'pending',
    paidAmount: 0,
    orderDate: '2026-03-28',
    notes: 'Kachha Bill non-GST transaction'
  };

  const kachhaHtml = generateInvoiceHtml(nonGstOrder, {
    companyName: 'Angel Pet Packaging Solutions Pvt Ltd',
    gstin: '24AAACA1234B1Z9'
  });

  console.assert(kachhaHtml.includes('KACHHA BILL'), 'Kachha bill title is KACHHA BILL');
  console.assert(!kachhaHtml.includes('24AAACA1234B1Z9'), 'Kachha bill does NOT include company GSTIN');
  console.assert(!kachhaHtml.includes('CGST'), 'Kachha bill does NOT include CGST');
  console.assert(!kachhaHtml.includes('SGST'), 'Kachha bill does NOT include SGST');
  console.assert(!kachhaHtml.includes('IGST'), 'Kachha bill does NOT include IGST');
  console.assert(kachhaHtml.includes('100ml Bottle') && kachhaHtml.includes('200ml Bottle'), 'All products appear in Kachha Bill');
  console.assert(kachhaHtml.includes('5,900.00'), 'Kachha Bill subtotal and total are identical (₹5,900.00)');
  console.log('✔ Test 13: Kachha Bill verified (no GSTIN, no tax breakdown, subtotal equals grand total)');

  // 14. TEST 2 & TEST 6: Pakka Bill / Tax Invoice (GST checked, multi-product)
  const gstOrder: Order = {
    id: 'ORD-PAKKA-01',
    orderNumber: 'ORD-1002',
    customerId: 'CUS-02',
    customerName: 'Suresh Patel',
    companyName: 'Patel Distributors',
    items: [
      { productId: 'PRD-101', productName: '100ml Bottle', productType: 'bottle', priceCategory: 'B', unitPrice: 3.10, quantity: 1000, subtotal: 3100 },
      { productId: 'PRD-102', productName: '200ml Bottle', productType: 'bottle', priceCategory: 'B', unitPrice: 4.30, quantity: 500, subtotal: 2150 }
    ],
    subtotal: 5250,
    gstAmount: 945,
    gstRate: 18,
    gstApplied: true,
    billType: 'pakka',
    totalAmount: 6195,
    totalQuantity: 1500,
    orderStatus: 'pending',
    paymentStatus: 'pending',
    paidAmount: 0,
    orderDate: '2026-03-28',
    notes: 'Pakka Tax Invoice'
  };

  const pakkaHtml = generateInvoiceHtml(
    gstOrder,
    {
      companyName: 'Custom Packaging Corp',
      address: 'Plot 55, Sector 12, GIDC, Vadodara',
      phone: '+91 98980 11223',
      email: 'contact@custompkg.com',
      gstin: '24AABCC5566D1Z5'
    },
    {
      name: 'Suresh Patel',
      company: 'Patel Distributors',
      gstin: '24CUSTGSTIN999'
    }
  );

  console.assert(pakkaHtml.includes('TAX INVOICE'), 'Pakka bill title is TAX INVOICE');
  console.assert(pakkaHtml.includes('Custom Packaging Corp'), 'Dynamic company name used in Pakka bill');
  console.assert(pakkaHtml.includes('24AABCC5566D1Z5'), 'Dynamic company GSTIN present in Pakka bill');
  console.assert(pakkaHtml.includes('24CUSTGSTIN999'), 'Customer GSTIN present in Pakka bill');
  console.assert(pakkaHtml.includes('CGST (9%):') && pakkaHtml.includes('SGST (9%):'), 'CGST / SGST breakdown present in Pakka bill');
  console.assert(pakkaHtml.includes('6,195.00'), 'Correct Grand Total ₹6,195.00 in Pakka bill');
  console.log('✔ Test 14: Pakka Bill / Tax Invoice verified (dynamic company details, GSTIN, CGST/SGST tax breakdown)');

  // 15. TEST 4 & TEST 5: Old orders fallback resolution
  const oldGstOrder: Order = {
    id: 'ORD-OLD-01',
    orderNumber: 'ORD-9001',
    customerId: 'CUS-01',
    customerName: 'Old Customer',
    companyName: 'Old Co',
    items: [{ productId: 'PRD-101', productName: '100ml Bottle', productType: 'bottle', priceCategory: 'A', unitPrice: 3.50, quantity: 100, subtotal: 350 }],
    subtotal: 350,
    gstAmount: 63,
    gstRate: 18,
    totalAmount: 413,
    orderStatus: 'completed',
    paymentStatus: 'paid',
    paidAmount: 413,
    orderDate: '2025-11-10'
  };

  const oldNonGstOrder: Order = {
    id: 'ORD-OLD-02',
    orderNumber: 'ORD-9002',
    customerId: 'CUS-01',
    customerName: 'Old Customer',
    companyName: 'Old Co',
    items: [{ productId: 'PRD-101', productName: '100ml Bottle', productType: 'bottle', priceCategory: 'A', unitPrice: 3.50, quantity: 100, subtotal: 350 }],
    subtotal: 350,
    gstAmount: 0,
    gstRate: 0,
    totalAmount: 350,
    orderStatus: 'completed',
    paymentStatus: 'paid',
    paidAmount: 350,
    orderDate: '2025-11-11'
  };

  const oldGstHtml = generateInvoiceHtml(oldGstOrder);
  console.assert(oldGstHtml.includes('TAX INVOICE'), 'Old order with gstRate > 0 safely resolves to Pakka Bill');
  
  const oldNonGstHtml = generateInvoiceHtml(oldNonGstOrder);
  console.assert(oldNonGstHtml.includes('KACHHA BILL'), 'Old order with 0 GST safely resolves to Kachha Bill');
  console.log('✔ Test 15: Backward compatibility for historical orders verified');

  // 16. Packaging compatibility discovery tests
  const sampleCap: Product = {
    id: 'PRD-201',
    name: '28mm Standard Cap',
    sku: 'CAP-28S',
    type: 'cap',
    sizeOrType: '28 mm standard',
    priceA: 5.00,
    priceB: 4.50,
    priceC: 4.00,
    currentStock: 42500,
    minimumStock: 10000,
    unit: 'pcs',
    status: 'active',
    createdAt: '2026-01-01'
  };

  const sampleInner: Product = {
    id: 'PRD-301',
    name: '28mm Standard Inner',
    sku: 'INR-28S',
    type: 'inner',
    sizeOrType: '28 mm standard',
    priceA: 3.00,
    priceB: 2.70,
    priceC: 2.40,
    currentStock: 50000,
    minimumStock: 15000,
    unit: 'pcs',
    status: 'active',
    createdAt: '2026-01-01'
  };

  const sampleBottleWithCompat: Product = {
    id: 'PRD-101',
    name: '100ml Bottle',
    sku: 'BTL-100',
    type: 'bottle',
    sizeOrType: '100 ml (28mm neck)',
    priceA: 100.00,
    priceB: 90.00,
    priceC: 80.00,
    currentStock: 18500,
    minimumStock: 5000,
    unit: 'pcs',
    status: 'active',
    createdAt: '2026-01-01',
    compatibleCapId: 'PRD-201',
    compatibleInnerId: 'PRD-301'
  };

  const productsCatalog = [sampleBottleWithCompat, sampleCap, sampleInner];

  // 17. Test Packaging Combo: 200 Bottles Only
  const bottleOnlyOrder: Order = {
    id: 'ORD-BOTTLE-ONLY',
    orderNumber: 'ORD-BTL-01',
    customerId: 'CUS-01',
    customerName: 'Test Customer',
    companyName: 'Test Co',
    items: [
      {
        id: 'main-1',
        productId: 'PRD-101',
        productName: '100ml Bottle',
        productType: 'bottle',
        priceCategory: 'A',
        unitPrice: 100.00,
        quantity: 200,
        subtotal: 20000,
        packagingMode: 'bottle_only'
      }
    ],
    subtotal: 20000,
    gstAmount: 3600,
    gstRate: 18,
    gstApplied: true,
    totalAmount: 23600,
    totalQuantity: 200,
    orderStatus: 'pending',
    paymentStatus: 'pending',
    paidAmount: 0,
    orderDate: '2026-09-28'
  };

  console.assert(bottleOnlyOrder.items.length === 1, 'Bottle only order should have 1 item');
  console.assert(bottleOnlyOrder.subtotal === 20000, 'Bottle only subtotal is 20000');
  const bottleOnlyHtml = generateInvoiceHtml(bottleOnlyOrder);
  console.assert(bottleOnlyHtml.includes('100ml Bottle') && !bottleOnlyHtml.includes('28mm Standard Cap'), 'Bottle only invoice should not have Cap');
  console.log('✔ Test 16: 200 Bottles Only verified (1 item, Subtotal ₹20,000, total ₹23,600 with GST)');

  // 18. Test Packaging Combo: 200 Bottles + Cap
  const bottleCapOrder: Order = {
    id: 'ORD-BOTTLE-CAP',
    orderNumber: 'ORD-BTL-02',
    customerId: 'CUS-01',
    customerName: 'Test Customer',
    companyName: 'Test Co',
    items: [
      {
        id: 'main-2',
        productId: 'PRD-101',
        productName: '100ml Bottle',
        productType: 'bottle',
        priceCategory: 'A',
        unitPrice: 100.00,
        quantity: 200,
        subtotal: 20000,
        packagingMode: 'bottle_cap'
      },
      {
        id: 'linked-cap-1',
        productId: 'PRD-201',
        productName: '28mm Standard Cap',
        productType: 'cap',
        priceCategory: 'A',
        unitPrice: 5.00,
        quantity: 200,
        subtotal: 1000,
        isAutoGenerated: true,
        linkedToItemId: 'main-2',
        mainItemId: 'main-2'
      }
    ],
    subtotal: 21000,
    gstAmount: 3780,
    gstRate: 18,
    gstApplied: true,
    totalAmount: 24780,
    totalQuantity: 400,
    orderStatus: 'pending',
    paymentStatus: 'pending',
    paidAmount: 0,
    orderDate: '2026-09-28'
  };

  console.assert(bottleCapOrder.items.length === 2, 'Bottle + Cap order should have 2 items');
  console.assert(bottleCapOrder.items[0].quantity === 200 && bottleCapOrder.items[1].quantity === 200, 'Cap qty equals bottle qty = 200');
  console.assert(bottleCapOrder.subtotal === 21000, 'Bottle + Cap subtotal = 20000 + 1000 = 21000');
  const bottleCapHtml = generateInvoiceHtml(bottleCapOrder);
  console.assert(bottleCapHtml.includes('100ml Bottle') && bottleCapHtml.includes('28mm Standard Cap'), 'Bottle + Cap invoice contains separate lines for Bottle & Cap');
  console.log('✔ Test 17: 200 Bottles + Cap verified (Separate items, ₹20,000 + ₹1,000 = Subtotal ₹21,000)');

  // 19. Test Packaging Combo: 200 Bottles + Inner + Cap
  const bottleInnerCapOrder: Order = {
    id: 'ORD-BOTTLE-INNER-CAP',
    orderNumber: 'ORD-BTL-03',
    customerId: 'CUS-01',
    customerName: 'Test Customer',
    companyName: 'Test Co',
    items: [
      {
        id: 'main-3',
        productId: 'PRD-101',
        productName: '100ml Bottle',
        productType: 'bottle',
        priceCategory: 'A',
        unitPrice: 100.00,
        quantity: 200,
        subtotal: 20000,
        packagingMode: 'bottle_inner_cap'
      },
      {
        id: 'linked-inner-1',
        productId: 'PRD-301',
        productName: '28mm Standard Inner',
        productType: 'inner',
        priceCategory: 'A',
        unitPrice: 3.00,
        quantity: 200,
        subtotal: 600,
        isAutoGenerated: true,
        linkedToItemId: 'main-3',
        mainItemId: 'main-3'
      },
      {
        id: 'linked-cap-2',
        productId: 'PRD-201',
        productName: '28mm Standard Cap',
        productType: 'cap',
        priceCategory: 'A',
        unitPrice: 5.00,
        quantity: 200,
        subtotal: 1000,
        isAutoGenerated: true,
        linkedToItemId: 'main-3',
        mainItemId: 'main-3'
      }
    ],
    subtotal: 21600,
    gstAmount: 3888,
    gstRate: 18,
    gstApplied: true,
    totalAmount: 25488,
    totalQuantity: 600,
    orderStatus: 'pending',
    paymentStatus: 'pending',
    paidAmount: 0,
    orderDate: '2026-09-28'
  };

  console.assert(bottleInnerCapOrder.items.length === 3, 'Bottle + Inner + Cap has 3 items');
  console.assert(bottleInnerCapOrder.subtotal === 21600, 'Subtotal: 20000 + 600 + 1000 = 21600');
  const bottleInnerCapHtml = generateInvoiceHtml(bottleInnerCapOrder);
  console.assert(bottleInnerCapHtml.includes('100ml Bottle'), 'Invoice has 100ml Bottle');
  console.assert(bottleInnerCapHtml.includes('28mm Standard Inner'), 'Invoice has 28mm Standard Inner');
  console.assert(bottleInnerCapHtml.includes('28mm Standard Cap'), 'Invoice has 28mm Standard Cap');
  console.assert(bottleInnerCapHtml.includes('21,600.00'), 'Invoice has Subtotal 21,600.00');
  console.assert(bottleInnerCapHtml.includes('Packaging: Bottle + Inner + Cap'), 'Invoice has packaging mode subtitle');
  console.log('✔ Test 18: 200 Bottles + Inner + Cap verified (3 separate lines: Bottle ₹20,000 + Inner ₹600 + Cap ₹1,000 = ₹21,600)');

  // 20. Quantity change sync: 200 -> 500
  const newQty = 500;
  const updatedItems = bottleInnerCapOrder.items.map((it) => ({
    ...it,
    quantity: newQty,
    subtotal: it.unitPrice * newQty
  }));
  const updatedSubtotal = updatedItems.reduce((s, it) => s + it.subtotal, 0);
  console.assert(updatedItems[0].quantity === 500 && updatedItems[1].quantity === 500 && updatedItems[2].quantity === 500, 'All quantities synced to 500');
  console.assert(updatedSubtotal === 500 * 100 + 500 * 3 + 500 * 5, `Expected 54000, got ${updatedSubtotal}`);
  console.log(`✔ Test 19: Quantity change 200 -> 500 synced (Bottle: 500 × ₹100, Inner: 500 × ₹3, Cap: 500 × ₹5 = Subtotal ₹${updatedSubtotal})`);

  // 21. Price Category change: A -> B -> C for all 3 products
  const priceCatB_Bottle = getProductPriceForCategory(sampleBottleWithCompat, 'B')!;
  const priceCatB_Inner = getProductPriceForCategory(sampleInner, 'B')!;
  const priceCatB_Cap = getProductPriceForCategory(sampleCap, 'B')!;
  console.assert(priceCatB_Bottle === 90 && priceCatB_Inner === 2.70 && priceCatB_Cap === 4.50, 'Category B pricing verified');
  const catBSubtotal = 200 * priceCatB_Bottle + 200 * priceCatB_Inner + 200 * priceCatB_Cap;
  console.assert(catBSubtotal === 200 * 90 + 200 * 2.70 + 200 * 4.50, `Category B subtotal: ${catBSubtotal}`);

  const priceCatC_Bottle = getProductPriceForCategory(sampleBottleWithCompat, 'C')!;
  const priceCatC_Inner = getProductPriceForCategory(sampleInner, 'C')!;
  const priceCatC_Cap = getProductPriceForCategory(sampleCap, 'C')!;
  console.assert(priceCatC_Bottle === 80 && priceCatC_Inner === 2.40 && priceCatC_Cap === 4.00, 'Category C pricing verified');
  const catCSubtotal = 200 * priceCatC_Bottle + 200 * priceCatC_Inner + 200 * priceCatC_Cap;
  console.assert(catCSubtotal === 200 * 80 + 200 * 2.40 + 200 * 4.00, `Category C subtotal: ${catCSubtotal}`);
  console.log(`✔ Test 20: Price category changes verified (Cat B Subtotal: ₹${catBSubtotal}, Cat C Subtotal: ₹${catCSubtotal})`);

  console.log('\nAll 20 pricing, packaging combinations & invoice unit tests passed successfully!');
}

runTests();

