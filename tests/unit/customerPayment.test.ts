import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Order, Payment } from '../../src/types';

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
import { addPayment, checkPaymentStatus } from '../../src/services/db';

describe('Customer Payment Recording & Idempotency', () => {
  const baseOrder: Order = {
    id: 'ORD-TEST-001',
    orderNumber: 'ORD-TEST-001',
    orderType: 'REGULAR',
    customerId: 'CUST-001',
    customerName: 'Test Corp',
    companyName: 'Test Corp',
    items: [],
    totalAmount: 1000,
    paidAmount: 0,
    paymentStatus: 'pending',
    orderStatus: 'confirmed',
    orderDate: '2026-10-22'
  };

  const getSavedOrders = (): Order[] => {
    return JSON.parse(localStorage.getItem('angel_pet_orders') || '[]');
  };

  const getSavedPayments = (): Payment[] => {
    return JSON.parse(localStorage.getItem('angel_pet_payments') || '[]');
  };

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('angel_pet_orders', JSON.stringify([baseOrder]));
    localStorage.setItem('angel_pet_payments', JSON.stringify([]));
  });

  it('records payment and updates order balance atomically', async () => {
    const payment = await addPayment({
      orderId: 'ORD-TEST-001',
      orderNumber: 'ORD-TEST-001',
      customerId: 'CUST-001',
      customerName: 'Test Corp',
      amount: 400,
      paymentMethod: 'bank_transfer',
      paymentDate: '2026-10-22',
      notes: 'Initial installment'
    });

    expect(payment).toBeDefined();
    expect(payment.amount).toBe(400);
    expect(payment.receiptNumber).toMatch(/^REC-/);

    // Verify order paid amount and status in storage
    const updatedOrder = getSavedOrders().find((o) => o.id === 'ORD-TEST-001');
    expect(updatedOrder?.paidAmount).toBe(400);
    expect(updatedOrder?.paymentStatus).toBe('partially_paid');

    // Verify payment in payments list
    const payments = getSavedPayments();
    expect(payments).toHaveLength(1);
    expect(payments[0].id).toBe(payment.id);
  });

  it('marks order as paid when payment equals total amount', async () => {
    await addPayment({
      orderId: 'ORD-TEST-001',
      orderNumber: 'ORD-TEST-001',
      customerId: 'CUST-001',
      customerName: 'Test Corp',
      amount: 1000,
      paymentMethod: 'upi',
      paymentDate: '2026-10-22'
    });

    const updatedOrder = getSavedOrders().find((o) => o.id === 'ORD-TEST-001');
    expect(updatedOrder?.paidAmount).toBe(1000);
    expect(updatedOrder?.paymentStatus).toBe('paid');
  });

  it('prevents duplicate payment on retry with the same receiptNumber', async () => {
    const receiptNumber = 'REC-TEST-IDEMPOTENT-001';

    // First attempt (simulating timeout or success)
    const firstPayment = await addPayment({
      id: receiptNumber,
      receiptNumber,
      orderId: 'ORD-TEST-001',
      orderNumber: 'ORD-TEST-001',
      customerId: 'CUST-001',
      customerName: 'Test Corp',
      amount: 500,
      paymentMethod: 'bank_transfer',
      paymentDate: '2026-10-22'
    });

    expect(firstPayment.id).toBe(receiptNumber);

    // Check payment status before retrying
    const statusBeforeRetry = await checkPaymentStatus(receiptNumber, 'ORD-TEST-001');
    expect(statusBeforeRetry.recorded).toBe(true);
    expect(statusBeforeRetry.payment?.amount).toBe(500);

    // Second attempt (retry with the same receiptNumber)
    const secondPayment = await addPayment({
      id: receiptNumber,
      receiptNumber,
      orderId: 'ORD-TEST-001',
      orderNumber: 'ORD-TEST-001',
      customerId: 'CUST-001',
      customerName: 'Test Corp',
      amount: 500,
      paymentMethod: 'bank_transfer',
      paymentDate: '2026-10-22'
    });

    expect(secondPayment.id).toBe(receiptNumber);

    // CRITICAL: Ensure exactly 1 payment record exists and balance is deducted only ONCE
    const payments = getSavedPayments();
    expect(payments).toHaveLength(1);

    const updatedOrder = getSavedOrders().find((o) => o.id === 'ORD-TEST-001');
    expect(updatedOrder?.paidAmount).toBe(500); // NOT 1000
    expect(updatedOrder?.paymentStatus).toBe('partially_paid');
  });

  it('rejects payment if amount exceeds outstanding balance', async () => {
    await expect(
      addPayment({
        orderId: 'ORD-TEST-001',
        orderNumber: 'ORD-TEST-001',
        customerId: 'CUST-001',
        customerName: 'Test Corp',
        amount: 1500,
        paymentMethod: 'cash',
        paymentDate: '2026-10-22'
      })
    ).rejects.toThrow('Payment amount cannot exceed the outstanding balance.');
  });

  it('rejects payment for Cash Memo, AS, and Cancelled orders', async () => {
    const cashMemoOrder: Order = { ...baseOrder, id: 'ORD-CM-001', paymentType: 'cash_memo' };
    const asOrder: Order = { ...baseOrder, id: 'ORD-AS-001', orderType: 'AS' };
    const cancelledOrder: Order = { ...baseOrder, id: 'ORD-CAN-001', orderStatus: 'cancelled' };

    localStorage.setItem(
      'angel_pet_orders',
      JSON.stringify([baseOrder, cashMemoOrder, asOrder, cancelledOrder])
    );

    await expect(
      addPayment({
        orderId: 'ORD-CM-001',
        orderNumber: 'ORD-CM-001',
        customerId: 'CUST-001',
        customerName: 'Test Corp',
        amount: 100,
        paymentMethod: 'cash',
        paymentDate: '2026-10-22'
      })
    ).rejects.toThrow('Cash Memo orders are already paid in full.');

    await expect(
      addPayment({
        orderId: 'ORD-AS-001',
        orderNumber: 'ORD-AS-001',
        customerId: 'CUST-001',
        customerName: 'Test Corp',
        amount: 100,
        paymentMethod: 'cash',
        paymentDate: '2026-10-22'
      })
    ).rejects.toThrow('Payment not applicable for AS Order.');

    await expect(
      addPayment({
        orderId: 'ORD-CAN-001',
        orderNumber: 'ORD-CAN-001',
        customerId: 'CUST-001',
        customerName: 'Test Corp',
        amount: 100,
        paymentMethod: 'cash',
        paymentDate: '2026-10-22'
      })
    ).rejects.toThrow('Cancelled orders cannot receive payments.');
  });

  it('rejects invalid or non-positive payment amounts', async () => {
    await expect(
      addPayment({
        orderId: 'ORD-TEST-001',
        orderNumber: 'ORD-TEST-001',
        customerId: 'CUST-001',
        customerName: 'Test Corp',
        amount: 0,
        paymentMethod: 'cash',
        paymentDate: '2026-10-22'
      })
    ).rejects.toThrow('Payment amount must be greater than zero.');

    await expect(
      addPayment({
        orderId: 'ORD-TEST-001',
        orderNumber: 'ORD-TEST-001',
        customerId: 'CUST-001',
        customerName: 'Test Corp',
        amount: -50,
        paymentMethod: 'cash',
        paymentDate: '2026-10-22'
      })
    ).rejects.toThrow('Payment amount must be greater than zero.');
  });

  it('checkPaymentStatus reports recorded: false for non-existent payments', async () => {
    const status = await checkPaymentStatus('REC-NON-EXISTENT', 'ORD-TEST-001');
    expect(status.recorded).toBe(false);
    expect(status.payment).toBeUndefined();
  });
});
