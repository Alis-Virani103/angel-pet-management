import React from 'react';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes } from 'firebase/storage';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';
import { addCustomer, addFinishedGoodsLog, addOrder, addPayment, addDispatch, addProduct, addPurchase, addSupplier, getCustomers, getOrders, getPayments, getRawMaterials, getPurchases, getProducts, getSuppliers, recordPurchasePayment, recordRawMaterialUsage, savePaymentReminder, updateCustomer, updateDispatchStatus, updateProduct, updatePurchaseStatus, updateSupplier } from '../../src/services/db';
import {
  auth as configuredAuth,
  db as configuredDb,
  firebaseConfig,
  storage as configuredStorage,
  usingFirebaseEmulators
} from '../../src/firebase/config';
import { LanguageProvider } from '../../src/i18n';
import { AuthProvider } from '../../src/auth/AuthContext';
import { Finance } from '../../src/pages/Finance';
import { AddProductModal } from '../../src/components/modals/AddProductModal';
import { NewOrderModal } from '../../src/components/modals/NewOrderModal';
import { NewPurchaseModal } from '../../src/components/modals/NewPurchaseModal';
import { calculatePacketUnits, canProductUseFractionalPackets, getProductUnitsPerPacket } from '../../src/utils/packetUtils';
import { calculateDispatchPieces, getDispatchUnitsPerPacket } from '../../src/utils/dispatchUtils';
import { calculatePurchasedMaterialTotals } from '../../src/utils/purchasedMaterialUtils';
import { calculateNetProductionQuantity } from '../../src/utils/productionUtils';
import type { Customer, Order, Product, RawMaterial } from '../../src/types';

const DEMO_PROJECT_ID = 'demo-angel-pet-audit';
const testSuffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
const ownerEmail = `owner-${testSuffix}@example.test`;
const employeeEmail = `employee-${testSuffix}@example.test`;
const testPassword = 'EmulatorOnly-12345!';

if (!usingFirebaseEmulators || firebaseConfig.projectId !== DEMO_PROJECT_ID) {
  throw new Error('ERP emulator tests refuse to run unless the demo-only Firebase emulator configuration is active.');
}
if (!configuredAuth || !configuredDb || !configuredStorage) {
  throw new Error('Firebase emulator clients were not initialized.');
}
const auth = configuredAuth;
const db = configuredDb;
const storage = configuredStorage;

const adminApp = initializeApp({ projectId: DEMO_PROJECT_ID }, `audit-${testSuffix}`);
const adminAuth = getAdminAuth(adminApp);
const adminDb = getAdminFirestore(adminApp);
let ownerUid = '';
let employeeUid = '';

const customerData = (id: string): Customer => ({
  id,
  name: 'Synthetic QA Customer',
  phone: '0000000000',
  company: 'Synthetic QA Company',
  address: 'Emulator fixture',
  customerType: 'Direct Customer',
  priceCategory: 'A',
  status: 'active',
  createdAt: '2026-01-01',
  totalOrders: 0,
  totalSpent: 0
});

const makeOrder = async (customerId: string, overrides: Partial<Order> = {}) => {
  await addCustomer(customerData(customerId));
  return addOrder({
    customerId,
    customerName: 'Synthetic QA Customer',
    companyName: 'Synthetic QA Company',
    items: [{
      productId: 'QA-PRODUCT',
      productName: 'Synthetic product',
      productType: 'bottle',
      priceCategory: 'A',
      unitPrice: 10,
      quantity: 10,
      subtotal: 100
    }],
    subtotal: 100,
    gstAmount: 0,
    gstRate: 0,
    totalAmount: 100,
    totalQuantity: 10,
    gstApplied: false,
    orderType: 'REGULAR',
    paymentType: 'debit_memo',
    ...overrides
  });
};

const rawMaterial = (id: string, currentStock: number): RawMaterial => ({
  id,
  name: 'Synthetic resin',
  code: id,
  category: 'granules',
  currentStock,
  minimumStock: 1,
  unit: 'kg',
  baseUnit: 'kg',
  purchaseUnit: 'kg',
  consumptionUnit: 'kg',
  conversionFactor: 1,
  piecesPerBaseUnit: 10,
  unitCost: 2,
  supplier: 'Synthetic supplier',
  status: currentStock <= 1 ? 'low_stock' : 'healthy',
  lastRestocked: '2026-01-01'
});

const product = (id: string, currentStock: number): Product => ({
  id,
  name: 'Synthetic bottle',
  sku: id,
  type: 'bottle',
  sizeOrType: 'QA',
  priceA: 10,
  priceB: 10,
  priceC: 10,
  currentStock,
  minimumStock: 0,
  unit: 'pcs',
  unitsPerPacket: 500,
  allowFractionalPackets: true,
  status: 'active',
  createdAt: '2026-01-01'
});

beforeAll(async () => {
  const owner = await createUserWithEmailAndPassword(auth, ownerEmail, testPassword);
  ownerUid = owner.user.uid;
  await adminAuth.setCustomUserClaims(ownerUid, { admin: true });
  await owner.user.getIdToken(true);
});

afterAll(async () => {
  cleanup();
  await signOut(auth);
  await deleteApp(adminApp);
});

afterEach(cleanup);

describe('isolated Firebase emulator workflows', () => {
  it('requires and saves a supplier selected from searchable saved supplier records', async () => {
    const renderPurchaseModal = () => render(
      <MemoryRouter>
        <LanguageProvider>
          <AuthProvider>
            <NewPurchaseModal isOpen onClose={() => undefined} />
          </AuthProvider>
        </LanguageProvider>
      </MemoryRouter>
    );

    renderPurchaseModal();
    await waitFor(() => {
      expect(screen.getByText(/No suppliers are saved yet/)).toBeTruthy();
    }, { timeout: 12000 });
    cleanup();

    const supplier = await addSupplier({
      name: 'Synthetic Purchase Contact',
      company: 'Synthetic Purchase Company',
      phone: '9000000000',
      address: 'Emulator fixture',
      status: 'active'
    });
    const materialId = `QA-RM-PURCHASE-${testSuffix}`;
    await adminDb.doc(`rawMaterials/${materialId}`).set({
      id: materialId,
      name: 'Synthetic purchase material',
      code: `QA-${testSuffix}`,
      category: 'granules',
      currentStock: 0,
      minimumStock: 1,
      unit: 'kg',
      baseUnit: 'kg',
      purchaseUnit: 'kg',
      consumptionUnit: 'kg',
      conversionFactor: 1,
      unitCost: 2,
      supplier: supplier.company || supplier.name,
      status: 'low_stock',
      lastRestocked: '2026-01-01'
    });

    renderPurchaseModal();
    const user = userEvent.setup();
    await screen.findByRole('button', { name: /Select a saved supplier/ });
    await user.click(screen.getByRole('button', { name: /Select a saved supplier/ }));
    const supplierSearch = screen.getByRole('combobox', { name: 'Search saved suppliers' });
    await user.type(supplierSearch, 'Synthetic Purchase');
    const supplierOption = await screen.findByRole('option', { name: /Synthetic Purchase Company/ });
    expect(screen.queryByText(/No saved suppliers match/)).toBeNull();
    await user.click(supplierOption);

    await user.click(screen.getByRole('button', { name: /Select material/ }));
    await user.click(await screen.findByRole('button', { name: /Synthetic purchase material/ }));
    await user.type(screen.getByRole('textbox', { name: 'Quantity for purchase item 1' }), '3');
    const rateInput = screen.getByRole('textbox', { name: 'Rate for purchase item 1' });
    await user.clear(rateInput);
    await user.type(rateInput, '25');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Entry Delivery Status' }), 'pending');
    await user.click(screen.getByRole('button', { name: 'Save Purchase Entry' }));

    await waitFor(async () => {
      const purchases = await getPurchases();
      const savedPurchase = purchases.find((purchase) => purchase.supplierId === supplier.id);
      expect(savedPurchase).toMatchObject({
        supplierId: supplier.id,
        supplierName: supplier.company,
        supplierPhone: supplier.phone,
        status: 'pending',
        subtotal: 75
      });
      expect((await adminDb.doc(`suppliers/${supplier.id}`).get()).exists).toBe(true);
    });
  });

  it('saves customers and suppliers with optional phone and company details', async () => {
    const customerWithoutContactDetails = await addCustomer({
      id: `QA-CUS-OPTIONAL-${testSuffix}`,
      name: 'Customer without contact details',
      address: 'Emulator fixture',
      customerType: 'Direct Customer',
      priceCategory: 'A',
      status: 'active'
    });
    const customerWithoutContactSnapshot = await adminDb.doc(`customers/${customerWithoutContactDetails.id}`).get();
    expect(customerWithoutContactSnapshot.data()).not.toHaveProperty('phone');
    expect(customerWithoutContactSnapshot.data()).not.toHaveProperty('company');
    expect((await getCustomers()).find((customer) => customer.id === customerWithoutContactDetails.id)).toMatchObject({
      phone: '',
      company: ''
    });

    const customerWithContactDetails = await addCustomer({
      id: `QA-CUS-CONTACT-${testSuffix}`,
      name: 'Customer with contact details',
      phone: '9876543210',
      company: 'Synthetic customer company',
      address: 'Emulator fixture',
      customerType: 'Direct Customer',
      priceCategory: 'A',
      status: 'active'
    });
    await updateCustomer(customerWithContactDetails.id, {
      phone: '9123456780',
      company: 'Updated synthetic customer company'
    });
    expect((await adminDb.doc(`customers/${customerWithContactDetails.id}`).get()).data()).toMatchObject({
      phone: '9123456780',
      company: 'Updated synthetic customer company'
    });

    const supplierWithoutCompany = await addSupplier({
      name: 'Supplier without company',
      address: 'Emulator fixture',
      status: 'active'
    });
    expect((await adminDb.doc(`suppliers/${supplierWithoutCompany.id}`).get()).data()).not.toHaveProperty('company');
    await updateSupplier(supplierWithoutCompany.id, { company: 'Added supplier company' });

    const supplierWithCompany = await addSupplier({
      name: 'Supplier with company',
      company: 'Synthetic supplier company',
      phone: '9988776655',
      address: 'Emulator fixture',
      status: 'active'
    });
    await updateSupplier(supplierWithCompany.id, { company: '', phone: '' });

    const suppliers = await getSuppliers();
    expect(suppliers.find((supplier) => supplier.id === supplierWithoutCompany.id)).toMatchObject({
      name: 'Supplier without company',
      company: 'Added supplier company'
    });
    expect(suppliers.find((supplier) => supplier.id === supplierWithCompany.id)).toMatchObject({
      name: 'Supplier with company',
      company: '',
      phone: ''
    });
  });

  it('does not write reminders while Finance loads, then persists an explicit reminder', async () => {
    const customerId = `QA-CUS-${testSuffix}`;
    const order = await makeOrder(customerId);
    const reminderRef = adminDb.doc(`paymentReminders/REM-${order.id}`);
    expect((await reminderRef.get()).exists).toBe(false);

    const { container } = render(
      <MemoryRouter>
        <LanguageProvider>
          <AuthProvider>
            <Finance
              onOpenRecordPaymentModal={() => undefined}
              onOpenRecordPurchasePaymentModal={() => undefined}
              onOpenAddExpenseModal={() => undefined}
            />
          </AuthProvider>
        </LanguageProvider>
      </MemoryRouter>
    );

    const user = userEvent.setup();
    const remindersTab = await screen.findByRole('button', { name: /Reminders/ });
    await waitFor(async () => {
      expect((await reminderRef.get()).exists).toBe(false);
    });
    await user.click(remindersTab);
    await user.click(await screen.findByRole('button', { name: 'Set reminder' }));
    const dueDateInput = container.querySelector('input[type="date"]');
    if (!dueDateInput) throw new Error('Reminder due-date input was not rendered.');
    fireEvent.change(dueDateInput, { target: { value: '2026-10-20' } });
    await user.click(screen.getByRole('button', { name: 'Save reminder' }));

    await waitFor(async () => {
      const savedReminder = await reminderRef.get();
      expect(savedReminder.exists).toBe(true);
      expect(savedReminder.data()?.dueDate).toBe('2026-10-20');
      expect(screen.getByRole('button', { name: 'Manage' })).toBeTruthy();
    });
  });

  it('tracks sales payments and rejects a repeated payment once it exceeds the remaining balance', async () => {
    const order = await makeOrder(`QA-CUS-SALES-${testSuffix}`);
    expect(order.paymentStatus).toBe('pending');
    expect(order.paidAmount).toBe(0);

    const paymentInput = {
      orderId: order.id,
      orderNumber: order.orderNumber,
      customerId: order.customerId,
      customerName: order.customerName,
      amount: 60,
      paymentMethod: 'cash' as const,
      paymentDate: '2026-10-19'
    };
    await addPayment(paymentInput);
    await expect(addPayment(paymentInput)).rejects.toThrow('Payment amount cannot exceed the outstanding balance.');

    let refreshedOrder = (await getOrders()).find((item) => item.id === order.id);
    expect(refreshedOrder?.paidAmount).toBe(60);
    expect(refreshedOrder?.paymentStatus).toBe('partially_paid');
    expect(order.totalAmount - (refreshedOrder?.paidAmount || 0)).toBe(40);
    await addPayment({ ...paymentInput, amount: 40 });
    refreshedOrder = (await getOrders()).find((item) => item.id === order.id);
    expect(refreshedOrder?.paidAmount).toBe(100);
    expect(refreshedOrder?.paymentStatus).toBe('paid');
    expect((await getPayments()).filter((payment) => payment.orderId === order.id)).toHaveLength(2);
  });

  it('adds received purchase stock once and records supplier payments against outstanding balance', async () => {
    const materialId = `QA-RM-PURCHASE-${testSuffix}`;
    await adminDb.doc(`rawMaterials/${materialId}`).set(rawMaterial(materialId, 10));
    const purchase = await addPurchase({
      supplierName: 'Synthetic supplier',
      items: [{
        rawMaterialId: materialId,
        rawMaterialName: 'Synthetic resin',
        category: 'granules',
        unit: 'kg',
        unitCost: 2,
        quantity: 5,
        subtotal: 10
      }],
      subtotal: 10,
      gstAmount: 0,
      gstRate: 0,
      totalAmount: 10,
      totalQuantity: 5,
      status: 'received',
      paymentStatus: 'pending',
      purchaseDate: '2026-10-19'
    });
    expect(purchase.stockAdded).toBe(true);
    expect((await getRawMaterials()).find((item) => item.id === materialId)?.currentStock).toBe(15);

    await updatePurchaseStatus(purchase.id, 'received');
    expect((await getRawMaterials()).find((item) => item.id === materialId)?.currentStock).toBe(15);
    const updatedPurchase = await recordPurchasePayment(purchase.id, 4, '2026-10-19');
    expect(updatedPurchase.paidAmount).toBe(4);
    expect(updatedPurchase.paymentStatus).toBe('partially_paid');
    expect(updatedPurchase.totalAmount - updatedPurchase.paidAmount).toBe(6);
    expect((await getPurchases()).find((item) => item.id === purchase.id)?.paymentRecords).toHaveLength(1);
  });

  it('subtracts wastage from net production while deducting the gross quantity from raw stock', async () => {
    const materialId = `QA-RM-PRODUCTION-${testSuffix}`;
    const productId = `QA-PRODUCT-PRODUCTION-${testSuffix}`;
    await adminDb.doc(`rawMaterials/${materialId}`).set(rawMaterial(materialId, 250));
    await adminDb.doc(`products/${productId}`).set(product(productId, 5));
    const usage = await recordRawMaterialUsage({
      materialId,
      materialName: 'Synthetic resin',
      quantity: 247,
      unit: 'kg',
      wastage1: 2,
      wastage2: 1,
      equivalentPieces: 2470,
      totalDeduction: 250,
      date: '2026-10-19',
      productionBatch: `QA-PROD-${testSuffix}`
    });

    expect(calculateNetProductionQuantity(250, 2, 1)).toBe(247);
    expect(usage.baseQuantity).toBe(247);
    expect(usage.baseTotalDeduction).toBe(250);
    expect(usage.equivalentPieces).toBe(2470);
    expect((await getRawMaterials()).find((item) => item.id === materialId)?.currentStock).toBe(0);
    await addFinishedGoodsLog({
      productId,
      productName: 'Synthetic bottle',
      type: 'bottle',
      quantityProduced: 100,
      unit: 'pcs',
      date: '2026-10-19'
    });
    expect((await getProducts()).find((item) => item.id === productId)?.currentStock).toBe(105);
  });

  it('deducts partial dispatches from finished stock once and completes delivery progress', async () => {
    const customerId = `QA-CUS-DISPATCH-${testSuffix}`;
    const productId = `QA-PRODUCT-DISPATCH-${testSuffix}`;
    const order = await makeOrder(customerId, {
      items: [{
        productId,
        productName: 'Synthetic bottle',
        productType: 'bottle',
        priceCategory: 'A',
        unitPrice: 10,
        quantity: 10,
        subtotal: 100
      }]
    });
    await adminDb.doc(`products/${productId}`).set(product(productId, 20));

    const firstDispatch = await addDispatch({
      orderId: order.id,
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      items: [{ productId, productName: 'Synthetic bottle', quantity: 4 }],
      dispatchDate: '2026-10-19',
      status: 'dispatched'
    });
    expect(firstDispatch.stockDeducted).toBe(true);
    expect((await getDoc(doc(db, 'products', productId))).data()?.currentStock).toBe(16);
    await updateDispatchStatus(firstDispatch.id, 'dispatched');
    expect((await getDoc(doc(db, 'products', productId))).data()?.currentStock).toBe(16);

    await addDispatch({
      orderId: order.id,
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      items: [{ productId, productName: 'Synthetic bottle', quantity: 6 }],
      dispatchDate: '2026-10-19',
      status: 'delivered'
    });
    expect((await getDoc(doc(db, 'products', productId))).data()?.currentStock).toBe(10);
    expect((await getOrders()).find((item) => item.id === order.id)?.orderStatus).toBe('completed');
  });

  it('uses packet-plus-loose piece totals for order quantities and deducts dispatch stock once', async () => {
    const customerId = `QA-CUS-PACKET-DISPATCH-${testSuffix}`;
    const productId = `QA-PRODUCT-PACKET-DISPATCH-${testSuffix}`;
    const orderQuantity = calculatePacketUnits(2, 500) + 7;
    const order = await makeOrder(customerId, {
      items: [{
        productId,
        productName: 'Synthetic packet bottle',
        productType: 'bottle',
        priceCategory: 'A',
        unitPrice: 10,
        quantity: orderQuantity,
        subtotal: orderQuantity * 10,
        soldByPacket: true,
        packetCount: 2,
        loosePieces: 7,
        unitsPerPacket: 500
      }],
      subtotal: orderQuantity * 10,
      totalAmount: orderQuantity * 10,
      totalQuantity: orderQuantity
    });
    await adminDb.doc(`products/${productId}`).set(product(productId, 1500));

    const dispatch = await addDispatch({
      orderId: order.id,
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      items: [{
        productId,
        productName: 'Synthetic packet bottle',
        quantity: orderQuantity,
        deliveryUnit: 'packets',
        packetQuantity: 2,
        loosePieces: 7,
        unitsPerPacket: 500
      }],
      dispatchDate: '2026-10-19',
      status: 'dispatched'
    });

    expect(order.items[0].quantity).toBe(1007);
    expect(dispatch.items[0].quantity).toBe(1007);
    expect((await getDoc(doc(db, 'products', productId))).data()?.currentStock).toBe(493);
    await updateDispatchStatus(dispatch.id, 'dispatched');
    expect((await getDoc(doc(db, 'products', productId))).data()?.currentStock).toBe(493);
  });

  it('uses packet-unit conversion for fractional packets, loose pieces, and pricing', () => {
    const quantity = calculatePacketUnits(2.5, 500) + 7;
    const unitPrice = 10;
    expect(quantity).toBe(1257);
    expect(quantity * unitPrice).toBe(12570);
    expect(calculatePacketUnits(0.25, 500) + 3).toBe(128);
    expect(canProductUseFractionalPackets({ allowFractionalPackets: false })).toBe(false);
  });

  it('uses packet configuration across product categories and counts loose dispatch pieces once', () => {
    const configuredProducts = (['bottle', 'cap', 'inner'] as const).map((type) => ({
      type,
      unitsPerPacket: 500
    }));
    expect(configuredProducts.map((product) => getDispatchUnitsPerPacket(undefined, product))).toEqual([500, 500, 500]);
    expect(getDispatchUnitsPerPacket(undefined, { unitsPerPacket: 0 })).toBeUndefined();
    expect(getDispatchUnitsPerPacket(undefined, { unitsPerPacket: 12.5 })).toBeUndefined();
    expect(getDispatchUnitsPerPacket({ unitsPerPacket: 400 }, { unitsPerPacket: 500 })).toBe(400);

    expect(calculateDispatchPieces(2, 'packets', 500, 7)).toBe(1007);
    expect(calculateDispatchPieces(0, 'packets', 500, 7)).toBe(7);
    expect(calculateDispatchPieces(12, 'pieces', 500, 7)).toBe(12);
    expect(getProductUnitsPerPacket({ unitsPerPacket: '240' as unknown as number })).toBe(240);
    expect(getProductUnitsPerPacket({})).toBeUndefined();
  });

  it('saves packet sizes for supported product types and preserves configured or missing values on unrelated edits', async () => {
    const packetSizes = { bottle: 360, cap: 240, inner: 120 } as const;
    const savedProducts = await Promise.all(
      (Object.keys(packetSizes) as Array<keyof typeof packetSizes>).map((type) =>
        addProduct({
          name: `Synthetic ${type} packet product`,
          sku: `QA-${type.toUpperCase()}-${testSuffix}`,
          type,
          sizeOrType: 'QA',
          priceA: 1,
          priceB: 1,
          priceC: 1,
          currentStock: 100,
          minimumStock: 0,
          unit: 'pcs',
          unitsPerPacket: packetSizes[type],
          status: 'active'
        })
      )
    );

    for (const savedProduct of savedProducts) {
      expect((await getDoc(doc(db, 'products', savedProduct.id))).data()?.unitsPerPacket)
        .toBe(packetSizes[savedProduct.type]);
      const updatedProduct = await updateProduct(savedProduct.id, { priceA: 2 });
      expect(updatedProduct.unitsPerPacket).toBe(packetSizes[savedProduct.type]);
      expect((await getDoc(doc(db, 'products', savedProduct.id))).data()?.unitsPerPacket)
        .toBe(packetSizes[savedProduct.type]);
    }

    const unconfiguredProduct = await addProduct({
      name: 'Synthetic unconfigured closure',
      sku: `QA-CLOSURE-${testSuffix}`,
      type: 'cap',
      sizeOrType: 'QA',
      priceA: 1,
      priceB: 1,
      priceC: 1,
      currentStock: 100,
      minimumStock: 0,
      unit: 'pcs',
      status: 'active'
    });
    await updateProduct(unconfiguredProduct.id, { priceA: 2 });
    expect((await getDoc(doc(db, 'products', unconfiguredProduct.id))).data())
      .not.toHaveProperty('unitsPerPacket');
  });

  it('adds and edits packet configuration through the product form', async () => {
    const user = userEvent.setup();
    const renderProductModal = (initialProduct?: Product) => render(
      <MemoryRouter>
        <LanguageProvider>
          <AuthProvider>
            <AddProductModal
              isOpen
              onClose={() => undefined}
              defaultType="cap"
              initialProduct={initialProduct}
            />
          </AuthProvider>
        </LanguageProvider>
      </MemoryRouter>
    );
    const getInput = (label: string) => {
      const input = screen.getByText(label, { exact: true }).parentElement?.querySelector('input');
      if (!input) throw new Error(`Could not find input for ${label}.`);
      return input;
    };

    renderProductModal();
    await user.type(getInput('Product Name'), 'Synthetic form packet cap');
    await user.type(getInput('Units per Packet (Optional)'), '240');
    await user.type(getInput('Price A (Standard ₹)'), '1');
    await user.type(getInput('Price B (Wholesale ₹)'), '1');
    await user.type(getInput('Price C (Special ₹)'), '1');
    await user.click(screen.getByRole('button', { name: 'Add Product' }));

    let savedProduct: Product | undefined;
    await waitFor(async () => {
      savedProduct = (await getProducts()).find((item) => item.name === 'Synthetic form packet cap');
      expect(savedProduct?.unitsPerPacket).toBe(240);
    });
    cleanup();

    if (!savedProduct) throw new Error('Product form did not save its packet configuration.');
    renderProductModal(savedProduct);
    expect(getInput('Units per Packet (Optional)')).toHaveProperty('value', '240');
    await user.clear(getInput('Price A (Standard ₹)'));
    await user.type(getInput('Price A (Standard ₹)'), '2');
    await user.click(screen.getByRole('button', { name: 'Update Product' }));

    await waitFor(async () => {
      expect((await getDoc(doc(db, 'products', savedProduct!.id))).data()?.unitsPerPacket).toBe(240);
    });
  });

  it('shows Packet mode after product selection and disables it only when packet size is missing', async () => {
    const configuredProductId = `QA-PRODUCT-ORDER-PACKET-${testSuffix}`;
    const unconfiguredProductId = `QA-PRODUCT-ORDER-PIECES-${testSuffix}`;
    await adminDb.doc(`products/${configuredProductId}`).set({
      ...product(configuredProductId, 1000),
      name: 'Synthetic configured packet bottle'
    });
    const unconfiguredProduct = {
      ...product(unconfiguredProductId, 1000),
      name: 'Synthetic unconfigured packet cap',
      type: 'cap' as const
    };
    delete unconfiguredProduct.unitsPerPacket;
    await adminDb.doc(`products/${unconfiguredProductId}`).set(unconfiguredProduct);

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <LanguageProvider>
          <AuthProvider>
            <NewOrderModal isOpen onClose={() => undefined} />
          </AuthProvider>
        </LanguageProvider>
      </MemoryRouter>
    );

    const productSearch = await screen.findByRole('combobox', { name: 'Search product 1' });
    await user.type(productSearch, 'Synthetic configured packet bottle');
    await user.click(await screen.findByRole('option', { name: /Synthetic configured packet bottle/ }));
    const configuredPacketButton = screen.getByRole('button', { name: 'Packet' });
    expect(configuredPacketButton.hasAttribute('disabled')).toBe(false);

    await user.click(screen.getByTitle('Clear product selection'));
    await user.type(productSearch, 'Synthetic unconfigured packet cap');
    await user.click(await screen.findByRole('option', { name: /Synthetic unconfigured packet cap/ }));
    const unconfiguredPacketButton = screen.getByRole('button', { name: 'Packet' });
    expect(unconfiguredPacketButton.hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: 'Pieces' })).toBeTruthy();
  });

  it('calculates purchased material weight for bags, pieces, and packets', () => {
    expect(calculatePurchasedMaterialTotals('bags', 3, 25)).toEqual({ totalWeightKg: 75 });
    expect(calculatePurchasedMaterialTotals('piece_count', 200, 15)).toEqual({
      totalWeightKg: 3,
      totalPieces: 200
    });
    expect(calculatePurchasedMaterialTotals('packets', 4, 2.5)).toEqual({ totalWeightKg: 10 });
  });

  it('allows the owner and denies restricted-employee reminder writes in app and Firestore rules', async () => {
    if (!storage) throw new Error('Firebase Storage emulator client was not initialized.');
    const ownerReminderId = `QA-OWNER-${testSuffix}`;
    await setDoc(doc(db, 'paymentReminders', ownerReminderId), {
      id: ownerReminderId,
      orderId: ownerReminderId,
      customerId: 'QA-CUSTOMER',
      customerName: 'Synthetic QA Customer',
      phone: '0000000000',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    expect((await getDoc(doc(db, 'paymentReminders', ownerReminderId))).exists()).toBe(true);
    await uploadBytes(ref(storage, `documents/QA-owner-${testSuffix}.txt`), new Blob(['synthetic emulator test']));

    const employee = await createUserWithEmailAndPassword(auth, employeeEmail, testPassword);
    employeeUid = employee.user.uid;
    await adminDb.doc(`userProfiles/${employeeUid}`).set({
      uid: employeeUid,
      email: employeeEmail,
      displayName: 'Synthetic restricted employee',
      active: true,
      permissions: { finance: ['view'] },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    await signOut(auth);
    await signInWithEmailAndPassword(auth, employeeEmail, testPassword);
    await expect(savePaymentReminder({
      orderId: ownerReminderId,
      customerId: 'QA-CUSTOMER',
      customerName: 'Synthetic QA Customer',
      phone: '0000000000'
    })).rejects.toThrow('Permission denied: create access to finance.');
    await expect(setDoc(doc(db, 'paymentReminders', `QA-DENIED-${testSuffix}`), {
      orderId: `QA-DENIED-${testSuffix}`
    })).rejects.toThrow();
    await expect(uploadBytes(
      ref(storage, `documents/QA-denied-${testSuffix}.txt`),
      new Blob(['synthetic emulator test'])
    )).rejects.toThrow();

    await signOut(auth);
    await signInWithEmailAndPassword(auth, ownerEmail, testPassword);
    expect(ownerUid).not.toBe(employeeUid);
  });
});
