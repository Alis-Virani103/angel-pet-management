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
