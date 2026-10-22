import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Customer, Order, Payment, Product } from '../../src/types';
import { generateInvoiceHtml } from '../../src/utils/invoicePrintUtils';

vi.mock('../../src/firebase/config', () => ({
  auth: {
    currentUser: {
      uid: 'test-admin-uid',
      getIdTokenResult: async () => ({ claims: { admin: true } })
    }
  },
  db: {},
  storage: {},
  isLiveFirebaseConfigured: false,
  firebaseReady: Promise.resolve()
}));

// Import db services after mocking firebase/config
import { addOrder, getOrders, getCustomers, updateCustomer } from '../../src/services/db';

describe('Delivery Challan Workflow & Pricing Logic', () => {
  const mockCustomer: Customer = {
    id: 'CUST-001',
    name: 'Acme Logistics',
    company: 'Acme Corp',
    phone: '9876543210',
    address: 'Industrial Zone',
    customerType: 'Direct Customer',
    priceCategory: 'A',
    status: 'active',
    totalOrders: 2,
    totalSpent: 5000
  };

  const mockProductWithPrice: Product = {
    id: 'PROD-001',
    name: '200ml Bottle',
    type: 'bottle',
    unit: 'pcs',
    currentStock: 1000,
    minimumStock: 100,
    priceA: 12.5,
    priceB: 11.0,
    priceC: 10.0
  };

  const mockProductWithoutPrice: Product = {
    id: 'PROD-002',
    name: 'New Custom Jar',
    type: 'jar',
    unit: 'pcs',
    currentStock: 500,
    minimumStock: 50
    // Notice: no priceA, priceB, or priceC configured!
  };

  const getSavedOrders = (): Order[] => {
    return JSON.parse(localStorage.getItem('angel_pet_orders') || '[]');
  };

  const getSavedPayments = (): Payment[] => {
    return JSON.parse(localStorage.getItem('angel_pet_payments') || '[]');
  };

  const getSavedCustomers = (): Customer[] => {
    return JSON.parse(localStorage.getItem('angel_pet_customers') || '[]');
  };

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('angel_pet_customers', JSON.stringify([mockCustomer]));
    localStorage.setItem('angel_pet_orders', JSON.stringify([]));
    localStorage.setItem('angel_pet_payments', JSON.stringify([]));
    localStorage.setItem('angel_pet_products', JSON.stringify([mockProductWithPrice, mockProductWithoutPrice]));
  });

  it('successfully creates a Delivery Challan order when rates are omitted (rate = 0)', async () => {
    const challanOrder = await addOrder({
      customerId: mockCustomer.id,
      customerName: mockCustomer.name,
      companyName: mockCustomer.company,
      orderType: 'REGULAR',
      paymentType: 'delivery_challan',
      subtotal: 0,
      gstAmount: 0,
      gstRate: 0,
      gstApplied: false,
      billType: 'kachha',
      totalAmount: 0,
      totalQuantity: 250,
      notes: 'Urgent site delivery',
      items: [
        {
          id: 'item-1',
          productId: mockProductWithoutPrice.id,
          productName: mockProductWithoutPrice.name,
          productType: mockProductWithoutPrice.type,
          priceCategory: 'A',
          unitPrice: 0,
          quantity: 250,
          subtotal: 0,
          soldByPacket: true,
          packetCount: 5,
          loosePieces: 0,
          unitsPerPacket: 50
        }
      ]
    });

    expect(challanOrder.id).toBeDefined();
    expect(challanOrder.orderNumber).toMatch(/^ORD-\d+$/);
    expect(challanOrder.paymentType).toBe('delivery_challan');
    expect(challanOrder.totalAmount).toBe(0);
    expect(challanOrder.paidAmount).toBe(0);
    expect(challanOrder.paymentStatus).toBe('pending');
    expect(challanOrder.items).toHaveLength(1);
    expect(challanOrder.items[0].quantity).toBe(250);
    expect(challanOrder.items[0].packetCount).toBe(5);

    // Ensure no finance payment is recorded
    const payments = getSavedPayments();
    expect(payments).toHaveLength(0);

    // Ensure customer totalSpent is NOT incremented by a zero-rate delivery challan
    const customers = getSavedCustomers();
    const updatedCustomer = customers.find((c) => c.id === mockCustomer.id);
    expect(updatedCustomer?.totalSpent).toBe(5000); // Remained 5000, not altered
    expect(updatedCustomer?.totalOrders).toBe(3); // Incremented from 2 to 3
  });

  it('preserves product selection, packet conversion, and quantities in delivery challan', async () => {
    const created = await addOrder({
      customerId: mockCustomer.id,
      customerName: mockCustomer.name,
      companyName: mockCustomer.company,
      orderType: 'REGULAR',
      paymentType: 'delivery_challan',
      subtotal: 0,
      gstAmount: 0,
      gstRate: 0,
      gstApplied: false,
      billType: 'kachha',
      totalAmount: 0,
      totalQuantity: 125,
      items: [
        {
          id: 'item-pkg',
          productId: mockProductWithoutPrice.id,
          productName: mockProductWithoutPrice.name,
          productType: mockProductWithoutPrice.type,
          priceCategory: 'A',
          unitPrice: 0,
          quantity: 125,
          subtotal: 0,
          soldByPacket: true,
          packetCount: 2,
          loosePieces: 25,
          unitsPerPacket: 50
        }
      ]
    });

    expect(created.items[0].soldByPacket).toBe(true);
    expect(created.items[0].packetCount).toBe(2);
    expect(created.items[0].loosePieces).toBe(25);
    expect(created.items[0].quantity).toBe(125);
  });

  it('retains regular sales mode calculation and validation with valid rate', async () => {
    const regularOrder = await addOrder({
      customerId: mockCustomer.id,
      customerName: mockCustomer.name,
      companyName: mockCustomer.company,
      orderType: 'REGULAR',
      paymentType: 'debit_memo',
      subtotal: 1250,
      gstAmount: 225,
      gstRate: 18,
      gstApplied: true,
      billType: 'pakka',
      totalAmount: 1475,
      totalQuantity: 100,
      items: [
        {
          id: 'item-priced',
          productId: mockProductWithPrice.id,
          productName: mockProductWithPrice.name,
          productType: mockProductWithPrice.type,
          priceCategory: 'A',
          unitPrice: 12.5,
          quantity: 100,
          subtotal: 1250
        }
      ]
    });

    expect(regularOrder.paymentType).toBe('debit_memo');
    expect(regularOrder.totalAmount).toBe(1475);
    expect(regularOrder.paymentStatus).toBe('pending');
    expect(regularOrder.paidAmount).toBe(0);

    // Customer totalSpent is incremented for regular sales orders
    const customers = getSavedCustomers();
    const updatedCustomer = customers.find((c) => c.id === mockCustomer.id);
    expect(updatedCustomer?.totalSpent).toBe(5000 + 1475);
  });

  it('automatically records full payment when Cash Memo is selected with a rate', async () => {
    const cashOrder = await addOrder({
      customerId: mockCustomer.id,
      customerName: mockCustomer.name,
      companyName: mockCustomer.company,
      orderType: 'REGULAR',
      paymentType: 'cash_memo',
      subtotal: 250,
      gstAmount: 0,
      gstRate: 0,
      gstApplied: false,
      billType: 'kachha',
      totalAmount: 250,
      totalQuantity: 20,
      items: [
        {
          id: 'item-cash',
          productId: mockProductWithPrice.id,
          productName: mockProductWithPrice.name,
          productType: mockProductWithPrice.type,
          priceCategory: 'A',
          unitPrice: 12.5,
          quantity: 20,
          subtotal: 250
        }
      ]
    });

    expect(cashOrder.paymentStatus).toBe('paid');
    expect(cashOrder.paidAmount).toBe(250);

    const payments = getSavedPayments();
    expect(payments).toHaveLength(1);
    expect(payments[0].orderId).toBe(cashOrder.id);
    expect(payments[0].amount).toBe(250);
  });

  it('generates Delivery Challan printable document without error and displays DELIVERY CHALLAN header', () => {
    const testChallanOrder: Order = {
      id: 'ORD-TEST-CHALLAN',
      orderNumber: 'ORD-99999',
      orderType: 'REGULAR',
      customerId: mockCustomer.id,
      customerName: mockCustomer.name,
      companyName: mockCustomer.company,
      paymentType: 'delivery_challan',
      orderStatus: 'confirmed',
      paymentStatus: 'pending',
      orderDate: '2026-10-22',
      subtotal: 0,
      gstAmount: 0,
      gstRate: 0,
      gstApplied: false,
      billType: 'kachha',
      totalAmount: 0,
      paidAmount: 0,
      totalQuantity: 300,
      items: [
        {
          id: 'item-c1',
          productId: mockProductWithoutPrice.id,
          productName: mockProductWithoutPrice.name,
          productType: mockProductWithoutPrice.type,
          priceCategory: 'A',
          unitPrice: 0,
          quantity: 300,
          subtotal: 0
        }
      ]
    };

    const html = generateInvoiceHtml(testChallanOrder);
    expect(html).toContain('DELIVERY CHALLAN');
    expect(html).not.toContain('NaN');
    expect(html).toContain('ORD-99999');
    expect(html).toContain('300 pcs');
  });
});
