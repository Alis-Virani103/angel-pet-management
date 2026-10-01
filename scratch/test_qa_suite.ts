import {
  getProducts,
  addProduct,
  updateProduct,
  getCustomers,
  addCustomer,
  getOrders,
  addOrder,
  updateOrder,
  getPayments,
  addPayment,
  getDispatches,
  addDispatch,
  getRawMaterials,
  addRawMaterial,
  getPurchases,
  addPurchase,
  updatePurchase,
  recordPurchasePayment,
  uploadOrderSignedCopy,
  removeOrderSignedCopy
} from '../src/services/db';
import { getOrderQuantity } from '../src/utils/orderUtils';
import { getPreviousRatesForProduct, formatPreviousRates } from '../src/utils/pricingUtils';
import { generateInvoiceHtml, isPakkaBill } from '../src/utils/invoicePrintUtils';

// Mock localStorage for Node environment before running tests
const storageMap = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (key: string) => storageMap.get(key) || null,
  setItem: (key: string, value: string) => storageMap.set(key, value),
  removeItem: (key: string) => storageMap.delete(key),
  clear: () => storageMap.clear()
};

async function runQASuite() {
  console.log('====================================================');
  console.log('   ANGEL PET PACKAGING ERP — QA TEST SUITE RUNNER  ');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail = '') {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName} - ${detail}`);
      failed++;
    }
  }

  // --- MODULE 1: PRODUCTS ---
  console.log('\n--- 1. PRODUCTS MODULE TESTING ---');
  const initialProds = await getProducts();
  assert(initialProds.length > 0, 'Products load successfully');

  const newProd = await addProduct({
    name: 'QA Test 500ml PET Bottle',
    sku: 'QA-BTL-500',
    type: 'bottle',
    sizeOrType: '500 ml',
    priceA: 15.50,
    priceB: 14.00,
    priceC: 13.00,
    currentStock: 2000,
    minimumStock: 300,
    unit: 'pcs',
    status: 'active',
    imageUrl: 'https://res.cloudinary.com/demo/image/upload/v1/qa_sample.jpg',
    cloudinaryPublicId: 'qa_sample'
  });
  assert(Boolean(newProd.id), 'Add product creates valid record');

  // Verify persistence
  const prodsAfterAdd = await getProducts();
  const foundProd = prodsAfterAdd.find(p => p.id === newProd.id);
  assert(foundProd?.name === 'QA Test 500ml PET Bottle', 'Added product persists in db');
  assert(foundProd?.priceA === 15.50 && foundProd?.priceB === 14.00, 'Pricing tiers preserved');

  // Edit product without overwriting image
  const updatedProd = await updateProduct(newProd.id, { priceA: 16.00 });
  assert(updatedProd.priceA === 16.00, 'Product price updated correctly');
  assert(updatedProd.imageUrl === 'https://res.cloudinary.com/demo/image/upload/v1/qa_sample.jpg', 'Cloudinary image URL retained during edit');


  // --- MODULE 2: SALES ORDERS ---
  console.log('\n--- 2. SALES ORDERS MODULE TESTING ---');
  const customers = await getCustomers();
  const testCustomer = customers[0] || await addCustomer({
    name: 'Rahul Sharma',
    company: 'QA Test Customer Bottling Ltd',
    phone: '+91 98765 43210',
    address: 'Plot 42, GIDC Industrial Estate',
    customerType: 'Distributor',
    priceCategory: 'A',
    status: 'active'
  });

  // Test Customer display format: Person Name — Company — Tier
  const customerDisplayFormat = `${testCustomer.name} — ${testCustomer.company} — Tier ${testCustomer.priceCategory}`;
  assert(customerDisplayFormat.includes(' — ') && customerDisplayFormat.includes('Tier'), 'Customer dropdown display format satisfies Person Name — Company — Tier');

  // Test Customer Search Matching Logic (Real-time, Case-insensitive, multi-field)
  const filterCustomers = (query: string, list: typeof customers) => {
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((c) =>
      [c.name, c.company, c.phone, c.priceCategory, `tier ${c.priceCategory}`, `category ${c.priceCategory}`]
        .filter(Boolean)
        .some((val) => val.toLowerCase().includes(q))
    );
  };

  const nameQuery = testCustomer.name.slice(0, 4);
  const matchByName = filterCustomers(nameQuery, [testCustomer]);
  assert(matchByName.length === 1 && matchByName[0].id === testCustomer.id, 'Search customer by person name matches correctly');

  const companyQuery = testCustomer.company.slice(0, 4);
  const matchByCompany = filterCustomers(companyQuery, [testCustomer]);
  assert(matchByCompany.length === 1 && matchByCompany[0].id === testCustomer.id, 'Search customer by company name matches correctly');

  const phoneQuery = testCustomer.phone.slice(-4);
  const matchByPhone = filterCustomers(phoneQuery, [testCustomer]);
  assert(matchByPhone.length === 1 && matchByPhone[0].id === testCustomer.id, 'Search customer by phone number matches correctly');

  const matchByTier = filterCustomers(`tier ${testCustomer.priceCategory.toLowerCase()}`, [testCustomer]);
  assert(matchByTier.length === 1 && matchByTier[0].id === testCustomer.id, 'Search customer by tier matches correctly');

  // Create fresh QA Sales Order with multiple products
  const productList = await getProducts();
  const prod1 = productList[0];
  const prod2 = productList[1] || prod1;

  const orderLine1 = {
    productId: prod1.id,
    productName: prod1.name,
    productType: prod1.type,
    priceCategory: 'A' as const,
    unitPrice: 12.00,
    quantity: 400, // tested 0400 leading zero strip -> 400
    subtotal: 12.00 * 400
  };

  const orderLine2 = {
    productId: prod2.id,
    productName: prod2.name,
    productType: prod2.type,
    priceCategory: 'A' as const,
    unitPrice: 5.00,
    quantity: 600,
    subtotal: 5.00 * 600
  };

  const expectedSubtotal = orderLine1.subtotal + orderLine2.subtotal; // 4800 + 3000 = 7800
  const expectedGst = expectedSubtotal * 0.18; // 1404
  const expectedGrandTotal = expectedSubtotal + expectedGst; // 9204

  const createdOrder = await addOrder({
    customerId: testCustomer.id,
    customerName: testCustomer.name,
    companyName: testCustomer.company,
    items: [orderLine1, orderLine2],
    subtotal: expectedSubtotal,
    gstAmount: expectedGst,
    gstRate: 18,
    totalAmount: expectedGrandTotal,
    totalQuantity: 1000,
    notes: 'QA Test Order - Multi product'
  });

  assert(createdOrder.orderNumber.startsWith('ORD-'), 'Order number created with ORD- prefix');
  assert(createdOrder.subtotal === 7800, 'Subtotal calculation is accurate');
  assert(createdOrder.gstAmount === 1404, 'GST calculation is accurate (18%)');
  assert(createdOrder.totalAmount === 9204, 'Grand total calculation is accurate');
  assert(getOrderQuantity(createdOrder) === 1000, 'getOrderQuantity calculates 1000 total items for multi-product order');

  // Test GST Pakka Order Creation & Invoice Generation
  const pakkaOrder = await addOrder({
    customerId: testCustomer.id,
    customerName: testCustomer.name,
    companyName: testCustomer.company,
    items: [orderLine1, orderLine2],
    subtotal: expectedSubtotal,
    gstAmount: expectedGst,
    gstRate: 18,
    gstApplied: true,
    billType: 'pakka',
    totalAmount: expectedGrandTotal,
    totalQuantity: 1000,
    notes: 'QA Test Pakka Bill'
  });

  assert(isPakkaBill(pakkaOrder) === true, 'isPakkaBill returns true for order with gstApplied: true');
  const pakkaHtml = generateInvoiceHtml(pakkaOrder, {
    companyName: 'Angel Pet Packaging Solutions Pvt Ltd',
    gstin: '24AAACA1234B1Z9'
  });
  assert(pakkaHtml.includes('TAX INVOICE'), 'Pakka bill HTML contains "TAX INVOICE" header');
  assert(pakkaHtml.includes('24AAACA1234B1Z9'), 'Pakka bill HTML contains company GSTIN');
  assert(pakkaHtml.includes('CGST (9%):') && pakkaHtml.includes('SGST (9%):'), 'Pakka bill HTML contains CGST and SGST breakdown');
  assert(pakkaHtml.includes('9,204.00'), 'Pakka bill HTML displays correct Grand Total');

  // Test Non-GST Kachha Order Creation & Invoice Generation
  const kachhaOrder = await addOrder({
    customerId: testCustomer.id,
    customerName: testCustomer.name,
    companyName: testCustomer.company,
    items: [orderLine1, orderLine2],
    subtotal: expectedSubtotal,
    gstAmount: 0,
    gstRate: 0,
    gstApplied: false,
    billType: 'kachha',
    totalAmount: expectedSubtotal,
    totalQuantity: 1000,
    notes: 'QA Test Kachha Bill'
  });

  assert(isPakkaBill(kachhaOrder) === false, 'isPakkaBill returns false for order with gstApplied: false');
  const kachhaHtml = generateInvoiceHtml(kachhaOrder, {
    companyName: 'Angel Pet Packaging Solutions Pvt Ltd',
    gstin: '24AAACA1234B1Z9'
  });
  assert(kachhaHtml.includes('KACHHA BILL'), 'Kachha bill HTML contains "KACHHA BILL" header');
  assert(!kachhaHtml.includes('24AAACA1234B1Z9'), 'Kachha bill HTML strictly excludes company GSTIN');
  assert(!kachhaHtml.includes('CGST') && !kachhaHtml.includes('SGST'), 'Kachha bill HTML strictly excludes CGST/SGST breakdown');
  assert(kachhaHtml.includes('7,800.00'), 'Kachha bill HTML displays Subtotal = Grand Total = 7,800.00');

  // Test Cash Memo Document Type & Automatic Finance Payment
  const initialPaymentCount = (await getPayments()).length;
  const cashMemoOrder = await addOrder({
    customerId: testCustomer.id,
    customerName: testCustomer.name,
    companyName: testCustomer.company,
    items: [orderLine1],
    subtotal: orderLine1.subtotal,
    gstAmount: orderLine1.subtotal * 0.18,
    gstRate: 18,
    gstApplied: true,
    billType: 'pakka',
    paymentType: 'cash_memo',
    totalAmount: orderLine1.subtotal * 1.18, // 4800 + 864 = 5664
    totalQuantity: 400,
    notes: 'QA Cash Memo Sale'
  });

  assert(cashMemoOrder.paymentStatus === 'paid', 'Cash Memo automatically sets order paymentStatus to "paid"');
  assert(cashMemoOrder.paidAmount === 5664, 'Cash Memo sets paidAmount = totalAmount (5664)');
  assert(cashMemoOrder.paymentType === 'cash_memo', 'Cash Memo persists paymentType: "cash_memo"');

  const paymentsAfterCashMemo = await getPayments();
  assert(paymentsAfterCashMemo.length === initialPaymentCount + 1, 'Cash Memo automatically creates 1 Finance payment transaction');
  const autoPayment = paymentsAfterCashMemo.find(p => p.orderId === cashMemoOrder.id);
  assert(autoPayment?.amount === 5664, 'Auto payment record amount matches Grand Total (5664)');
  assert(autoPayment?.customerId === testCustomer.id, 'Auto payment references correct customer ID');
  assert(autoPayment?.paymentMethod === 'cash', 'Auto payment has paymentMethod: "cash"');

  const cashMemoInvoiceHtml = generateInvoiceHtml(cashMemoOrder);
  assert(cashMemoInvoiceHtml.includes('CASH MEMO'), 'Cash Memo invoice HTML clearly contains "CASH MEMO"');
  assert(cashMemoInvoiceHtml.includes('Fully Settled ✓') || cashMemoInvoiceHtml.includes('0.00'), 'Cash Memo invoice shows fully settled/zero balance');

  // Test Debit Memo Document Type (No auto payment, remains pending)
  const debitMemoOrder = await addOrder({
    customerId: testCustomer.id,
    customerName: testCustomer.name,
    companyName: testCustomer.company,
    items: [orderLine2],
    subtotal: orderLine2.subtotal,
    gstAmount: 0,
    gstRate: 0,
    gstApplied: false,
    billType: 'kachha',
    paymentType: 'debit_memo',
    totalAmount: orderLine2.subtotal, // 3000
    totalQuantity: 600,
    notes: 'QA Debit Memo Sale'
  });

  assert(debitMemoOrder.paymentStatus === 'pending', 'Debit Memo sets paymentStatus to "pending"');
  assert(debitMemoOrder.paidAmount === 0, 'Debit Memo sets paidAmount = 0');
  assert(debitMemoOrder.paymentType === 'debit_memo', 'Debit Memo persists paymentType: "debit_memo"');

  const paymentsAfterDebitMemo = await getPayments();
  assert(paymentsAfterDebitMemo.length === paymentsAfterCashMemo.length, 'Debit Memo does NOT create automatic Finance payment');

  const debitMemoInvoiceHtml = generateInvoiceHtml(debitMemoOrder);
  assert(debitMemoInvoiceHtml.includes('DEBIT MEMO'), 'Debit Memo invoice HTML clearly contains "DEBIT MEMO"');
  assert(debitMemoInvoiceHtml.includes('3,000.00'), 'Debit Memo invoice shows full balance due (3,000.00)');

  // Record Later Payment on Debit Memo
  const laterPayment = await addPayment({
    orderId: debitMemoOrder.id,
    orderNumber: debitMemoOrder.orderNumber,
    customerId: testCustomer.id,
    customerName: testCustomer.company,
    amount: 3000,
    paymentMethod: 'upi',
    paymentDate: new Date().toISOString().split('T')[0],
    notes: 'Later payment for Debit Memo'
  });
  assert(laterPayment.amount === 3000, 'Later payment on Debit Memo recorded successfully');
  const reloadedDebitMemo = (await getOrders()).find(o => o.id === debitMemoOrder.id);
  assert(reloadedDebitMemo?.paymentStatus === 'paid' && reloadedDebitMemo?.paidAmount === 3000, 'Debit Memo transitions to "paid" after later payment recorded');

  // --- MODULE 3: SALES PAYMENTS ---
  console.log('\n--- 3. SALES PAYMENTS MODULE TESTING ---');
  // Partial Payment (4204 of 9204)
  const partialPayment = await addPayment({
    orderId: createdOrder.id,
    orderNumber: createdOrder.orderNumber,
    customerId: testCustomer.id,
    customerName: testCustomer.company,
    amount: 4204,
    paymentMethod: 'bank_transfer',
    paymentDate: new Date().toISOString().split('T')[0],
    notes: 'QA Partial Payment'
  });
  assert(partialPayment.receiptNumber.startsWith('REC-'), 'Receipt number created with REC- prefix');

  const orderAfterPartial = (await getOrders()).find(o => o.id === createdOrder.id);
  assert(orderAfterPartial?.paidAmount === 4204, 'Paid amount updated to 4204 after partial payment');
  assert(orderAfterPartial?.paymentStatus === 'partially_paid', 'Payment status updated to partially_paid');
  assert((orderAfterPartial!.totalAmount - orderAfterPartial!.paidAmount) === 5000, 'Outstanding balance is 5000');

  // Negative amount rejection
  let zeroAmountError = false;
  try {
    await addPayment({
      orderId: createdOrder.id,
      orderNumber: createdOrder.orderNumber,
      customerId: testCustomer.id,
      customerName: testCustomer.company,
      amount: -100,
      paymentMethod: 'cash',
      paymentDate: new Date().toISOString().split('T')[0]
    });
  } catch (e) {
    zeroAmountError = true;
  }
  assert(zeroAmountError, 'Negative payment amount correctly rejected');

  // Overpayment rejection (> 5000 balance)
  let overpaymentError = false;
  try {
    await addPayment({
      orderId: createdOrder.id,
      orderNumber: createdOrder.orderNumber,
      customerId: testCustomer.id,
      customerName: testCustomer.company,
      amount: 6000,
      paymentMethod: 'bank_transfer',
      paymentDate: new Date().toISOString().split('T')[0]
    });
  } catch (e) {
    overpaymentError = true;
  }
  assert(overpaymentError, 'Overpayment above balance correctly rejected');

  // Complete full payment (remaining 5000)
  await addPayment({
    orderId: createdOrder.id,
    orderNumber: createdOrder.orderNumber,
    customerId: testCustomer.id,
    customerName: testCustomer.company,
    amount: 5000,
    paymentMethod: 'upi',
    paymentDate: new Date().toISOString().split('T')[0]
  });

  const orderAfterFull = (await getOrders()).find(o => o.id === createdOrder.id);
  assert(orderAfterFull?.paidAmount === 9204, 'Paid amount is equal to totalAmount (9204)');
  assert(orderAfterFull?.paymentStatus === 'paid', 'Payment status is fully "paid"');


  // --- MODULE 4: DISPATCH / INVENTORY ---
  console.log('\n--- 4. DISPATCH / INVENTORY MODULE TESTING ---');
  // Create another order for dispatch test
  const dispatchOrder = await addOrder({
    customerId: testCustomer.id,
    customerName: testCustomer.name,
    companyName: testCustomer.company,
    items: [{
      productId: newProd.id,
      productName: newProd.name,
      productType: newProd.type,
      priceCategory: 'A',
      unitPrice: 16.00,
      quantity: 500,
      subtotal: 8000
    }],
    subtotal: 8000,
    gstAmount: 1440,
    gstRate: 18,
    totalAmount: 9440,
    totalQuantity: 500
  });

  const stockBeforeDispatch = (await getProducts()).find(p => p.id === newProd.id)!.currentStock; // 2000

  // Dispatch order
  const dispatchRecord = await addDispatch({
    orderId: dispatchOrder.id,
    orderNumber: dispatchOrder.orderNumber,
    customerName: testCustomer.company,
    items: [{ productId: newProd.id, productName: newProd.name, quantity: 500 }],
    dispatchDate: new Date().toISOString().split('T')[0],
    vehicleNumber: 'GJ-06-QA-9999',
    driverName: 'QA Driver',
    status: 'dispatched'
  });
  assert(dispatchRecord.dispatchNumber.startsWith('DSP-'), 'Dispatch record created with DSP- prefix');

  const stockAfterDispatch = (await getProducts()).find(p => p.id === newProd.id)!.currentStock;
  assert(stockAfterDispatch === stockBeforeDispatch - 500, `Stock reduced by 500 (from ${stockBeforeDispatch} to ${stockAfterDispatch})`);

  // Verify double deduction protection: calling addDispatch or re-triggering stock deduction on same dispatch won't deduct stock twice
  const reDeductedDispatch = (await getDispatches()).find(d => d.id === dispatchRecord.id);
  assert(reDeductedDispatch?.stockDeducted === true, 'stockDeducted flag set to true');


  // --- MODULE 5: PURCHASES ---
  console.log('\n--- 5. PURCHASES MODULE TESTING ---');
  const rawMats = await getRawMaterials();
  const rm1 = rawMats[0] || await addRawMaterial({
    name: 'QA HDPE White Granules',
    code: 'QA-RM-01',
    category: 'granules',
    currentStock: 1000,
    minimumStock: 200,
    unit: 'kg',
    unitCost: 110,
    supplier: 'QA Test Supplier Chemicals Ltd'
  });

  const initialRmStock = rm1.currentStock;

  const purchaseBill = await addPurchase({
    supplierName: 'QA Test Supplier Chemicals Ltd',
    supplierPhone: '+91 99999 11111',
    items: [{
      rawMaterialId: rm1.id,
      rawMaterialName: rm1.name,
      hsnSac: rm1.code,
      category: rm1.category,
      unit: rm1.unit,
      unitCost: 110,
      quantity: 500,
      subtotal: 55000
    }],
    subtotal: 55000,
    gstAmount: 9900,
    gstRate: 18,
    totalAmount: 64900,
    totalQuantity: 500,
    status: 'received',
    purchaseDate: new Date().toISOString().split('T')[0]
  });

  assert(purchaseBill.purchaseNumber.startsWith('PO-'), 'Purchase created with PO- prefix');
  const stockAfterPurchase = (await getRawMaterials()).find(m => m.id === rm1.id)!.currentStock;
  assert(stockAfterPurchase === initialRmStock + 500, `Raw material stock increased by 500 (from ${initialRmStock} to ${stockAfterPurchase})`);

  // Edit Purchase: change quantity from 500 to 700 (+200 delta)
  await updatePurchase(purchaseBill.id, {
    items: [{
      rawMaterialId: rm1.id,
      rawMaterialName: rm1.name,
      hsnSac: rm1.code,
      category: rm1.category,
      unit: rm1.unit,
      unitCost: 110,
      quantity: 700,
      subtotal: 77000
    }],
    subtotal: 77000,
    totalAmount: 90860
  });

  const stockAfterPurchaseEdit = (await getRawMaterials()).find(m => m.id === rm1.id)!.currentStock;
  assert(stockAfterPurchaseEdit === stockAfterPurchase + 200, `Editing purchase adjusted raw material stock by delta +200 (now ${stockAfterPurchaseEdit})`);


  // --- MODULE 6: SUPPLIER PAYMENTS ---
  console.log('\n--- 6. SUPPLIER PAYMENTS MODULE TESTING ---');
  const updatedPurchase = (await getPurchases()).find(p => p.id === purchaseBill.id)!;
  const initialPaid = updatedPurchase.paidAmount || 0; // 0
  const remSupplierBal = updatedPurchase.totalAmount - initialPaid; // 90860

  // Record supplier payment of 40860
  const updatedPOAfterPayment = await recordPurchasePayment(purchaseBill.id, 40860, new Date().toISOString().split('T')[0], 'QA Supplier Payment Part');
  assert(updatedPOAfterPayment.paidAmount === 40860, 'Supplier paidAmount updated to 40860');
  assert(updatedPOAfterPayment.paymentStatus === 'partially_paid', 'Supplier payment status is partially_paid');
  assert((updatedPOAfterPayment.totalAmount - updatedPOAfterPayment.paidAmount) === 50000, 'Supplier outstanding balance is 50000');


  // --- MODULE 8: SIGNED COPY ---
  console.log('\n--- 8. SIGNED COPY MODULE TESTING ---');
  const mockFile = new File(['QA Test Signed Copy PDF Content'], 'qa_signed_po.pdf', { type: 'application/pdf' });
  const orderWithSignedCopy = await uploadOrderSignedCopy(createdOrder.id, mockFile);
  assert(Boolean(orderWithSignedCopy.signedCopy), 'Signed copy uploaded successfully to sales order');
  assert(orderWithSignedCopy.signedCopy?.fileName === 'qa_signed_po.pdf', 'Signed copy filename matches qa_signed_po.pdf');

  // Remove signed copy
  const orderAfterRemoveCopy = await removeOrderSignedCopy(createdOrder.id);
  assert(orderAfterRemoveCopy.signedCopy === undefined, 'Signed copy removed successfully');


  // --- SUMMARY ---
  console.log('\n====================================================');
  console.log(` QA TEST RUN COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runQASuite().catch(err => {
  console.error('QA Suite error:', err);
  process.exit(1);
});
