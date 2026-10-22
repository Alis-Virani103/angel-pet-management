import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Customer, Order, Product } from '../../src/types';
import { getProductPriceForCategory, getPriceCategoryLabel, calculateEffectiveItemRate } from '../../src/utils/pricingUtils';

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

import { addOrder } from '../../src/services/db';

describe('Category D (Manual / Custom Rate) Workflow', () => {
  const mockCustomer: Customer = {
    id: 'CUST-CATD-01',
    name: 'Custom Client',
    company: 'Custom Enterprises',
    phone: '9898989898',
    address: 'Custom Estate',
    customerType: 'Direct Customer',
    priceCategory: 'D',
    status: 'active',
    totalOrders: 0,
    totalSpent: 0
  };

  const mockProduct: Product = {
    id: 'PROD-D-001',
    name: 'Special Container 500ml',
    type: 'jar',
    unit: 'pcs',
    currentStock: 500,
    minimumStock: 50,
    priceA: 20,
    priceB: 18,
    priceC: 16
    // Notice: no pre-configured priceD, rates are entered manually in Category D
  };

  const getSavedOrders = (): Order[] => {
    return JSON.parse(localStorage.getItem('angel_pet_orders') || '[]');
  };

  const getSavedCustomers = (): Customer[] => {
    return JSON.parse(localStorage.getItem('angel_pet_customers') || '[]');
  };

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('angel_pet_customers', JSON.stringify([mockCustomer]));
    localStorage.setItem('angel_pet_orders', JSON.stringify([]));
    localStorage.setItem('angel_pet_products', JSON.stringify([mockProduct]));
  });

  it('correctly labels Category D in pricing utils', () => {
    expect(getPriceCategoryLabel('D')).toBe('Category D (Manual / Custom)');
  });

  it('supports product-level priceD when configured, and returns null when not set', () => {
    expect(getProductPriceForCategory(mockProduct, 'D')).toBeNull();

    const productWithPriceD: Product = {
      ...mockProduct,
      priceD: 17.25
    };
    expect(getProductPriceForCategory(productWithPriceD, 'D')).toBe(17.25);
  });

  it('creates an order with Category D and a manually entered rate', async () => {
    const manualRate = 19.5;
    const quantity = 100;
    const lineSubtotal = manualRate * quantity; // 1950

    const order = await addOrder({
      customerId: mockCustomer.id,
      customerName: mockCustomer.name,
      companyName: mockCustomer.company,
      orderType: 'REGULAR',
      paymentType: 'debit_memo',
      subtotal: lineSubtotal,
      gstAmount: 0,
      gstRate: 0,
      gstApplied: false,
      billType: 'kachha',
      totalAmount: lineSubtotal,
      totalQuantity: quantity,
      items: [
        {
          id: 'item-cat-d',
          productId: mockProduct.id,
          productName: mockProduct.name,
          productType: mockProduct.type,
          priceCategory: 'D',
          unitPrice: manualRate,
          quantity: quantity,
          subtotal: lineSubtotal
        }
      ]
    });

    expect(order.id).toBeDefined();
    expect(order.totalAmount).toBe(1950);
    expect(order.items[0].priceCategory).toBe('D');
    expect(order.items[0].unitPrice).toBe(19.5);
    expect(order.items[0].subtotal).toBe(1950);

    // Verify saved order in localStorage
    const saved = getSavedOrders();
    expect(saved).toHaveLength(1);
    expect(saved[0].items[0].unitPrice).toBe(19.5);

    // Verify customer totalSpent updated
    const customers = getSavedCustomers();
    const updatedCus = customers.find((c) => c.id === mockCustomer.id);
    expect(updatedCus?.totalSpent).toBe(1950);
    expect(updatedCus?.totalOrders).toBe(1);
  });
});
