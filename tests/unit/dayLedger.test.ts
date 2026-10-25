import { describe, expect, it } from 'vitest';
import { Expense, Order, Payment, PurchaseOrder } from '../../src/types';
import {
  applySalesRunningBalance,
  buildDayLedger,
  buildDayLedgerEntries,
  compareDayLedgerRows,
  salesBalanceImpact,
  summarizeDayLedger
} from '../../src/utils/dayLedger';

const order = (overrides: Partial<Order> & Pick<Order, 'id' | 'totalAmount' | 'orderDate'>): Order => ({
  orderNumber: overrides.id,
  customerId: 'C1',
  customerName: 'Acme',
  companyName: 'Acme Ltd',
  items: [{ productId: 'P1', productName: '100ml Bottle', productType: 'bottle', priceCategory: 'A', unitPrice: 1, quantity: 1, subtotal: 1 }],
  subtotal: overrides.totalAmount,
  gstAmount: 0,
  gstRate: 0,
  orderStatus: 'confirmed',
  paymentStatus: 'pending',
  paidAmount: 0,
  ...overrides
} as Order);

const payment = (overrides: Partial<Payment> & Pick<Payment, 'id' | 'amount' | 'paymentDate'>): Payment => ({
  receiptNumber: overrides.id,
  orderId: 'ORD-1',
  orderNumber: 'ORD-1',
  customerId: 'C1',
  customerName: 'Acme',
  paymentMethod: 'cash',
  ...overrides
} as Payment);

const purchase = (overrides: Partial<PurchaseOrder> & Pick<PurchaseOrder, 'id' | 'totalAmount' | 'purchaseDate'>): PurchaseOrder => ({
  purchaseNumber: overrides.id,
  supplierName: 'Polymer Co',
  items: [{ rawMaterialId: 'RM1', rawMaterialName: 'HDPE', category: 'granules', unit: 'kg', unitCost: 1, quantity: 1, subtotal: 1 }],
  subtotal: overrides.totalAmount,
  gstAmount: 0,
  gstRate: 0,
  totalQuantity: 1,
  status: 'received',
  paymentStatus: 'pending',
  paidAmount: 0,
  createdAt: overrides.purchaseDate,
  ...overrides
} as PurchaseOrder);

const expense = (overrides: Partial<Expense> & Pick<Expense, 'id' | 'amount' | 'expenseDate'>): Expense => ({
  category: 'utilities',
  description: 'Electricity',
  status: 'paid',
  paymentMethod: 'cash',
  ...overrides
} as Expense);

describe('Day ledger remaining-sales balance', () => {
  it('adds sales and subtracts customer payments and expenses', () => {
    expect(salesBalanceImpact({ transactionType: 'Sale', debit: 25650.72, credit: 0 })).toBe(25650.72);
    expect(salesBalanceImpact({ transactionType: 'Customer Payment', debit: 0, credit: 7503 })).toBe(-7503);
    expect(salesBalanceImpact({ transactionType: 'Expense', debit: 1380, credit: 0 })).toBe(-1380);
  });

  it('does not add purchases or supplier payments to the sales balance', () => {
    expect(salesBalanceImpact({ transactionType: 'Purchase', debit: 9000, credit: 0 })).toBe(0);
    expect(salesBalanceImpact({ transactionType: 'Supplier Payment', debit: 0, credit: 4000 })).toBe(0);
  });

  it('matches the company formula: 25650.72 - 7503 - 1380 = 16767.72', () => {
    const { rangedRows, summary, openingBalance } = buildDayLedger({
      orders: [order({ id: 'ORD-1', totalAmount: 25650.72, orderDate: '2026-10-01' })],
      payments: [payment({ id: 'PAY-1', amount: 7503, paymentDate: '2026-10-02' })],
      purchases: [purchase({
        id: 'PO-1',
        totalAmount: 9000,
        purchaseDate: '2026-10-02',
        paidAmount: 4000,
        paymentRecords: [{ id: 'SP-1', purchaseId: 'PO-1', purchaseNumber: 'PO-1', supplierName: 'Polymer Co', amount: 4000, paymentDate: '2026-10-03' }]
      })],
      expenses: [expense({ id: 'EXP-1', amount: 1380, expenseDate: '2026-10-01' })]
    });

    const byId = Object.fromEntries(rangedRows.map((row) => [row.id, row]));
    expect(openingBalance).toBe(0);
    expect(byId['sale-ORD-1'].balance).toBe(25650.72);
    expect(byId['expense-EXP-1'].balance).toBe(24270.72);
    expect(byId['purchase-PO-1'].balance).toBe(24270.72);
    expect(byId['cust-pay-PAY-1'].balance).toBe(16767.72);
    expect(byId['sup-pay-SP-1'].balance).toBe(16767.72);
    expect(summary.totalSales).toBe(25650.72);
    expect(summary.customerPaymentsReceived).toBe(7503);
    expect(summary.businessExpenses).toBe(1380);
    expect(summary.netBalance).toBe(16767.72);
    expect(summary.closingBalance).toBe(16767.72);
    expect(summary.supplierPayables).toBe(5000);
  });

  it('walks chronological rows from a zero opening balance', () => {
    const { rangedRows, summary } = buildDayLedger({
      orders: [order({ id: 'ORD-1', totalAmount: 1000, orderDate: '2026-10-01' })],
      payments: [payment({ id: 'PAY-1', amount: 400, paymentDate: '2026-10-02' })],
      purchases: [purchase({
        id: 'PO-1',
        totalAmount: 500,
        purchaseDate: '2026-10-02',
        paymentRecords: [{ id: 'SP-1', purchaseId: 'PO-1', purchaseNumber: 'PO-1', supplierName: 'Polymer Co', amount: 150, paymentDate: '2026-10-03' }]
      })],
      expenses: [expense({ id: 'EXP-1', amount: 200, expenseDate: '2026-10-01' })]
    });

    const byId = Object.fromEntries(rangedRows.map((row) => [row.id, row]));
    expect(byId['sale-ORD-1'].balance).toBe(1000);
    expect(byId['expense-EXP-1'].balance).toBe(800);
    expect(byId['purchase-PO-1'].balance).toBe(800);
    expect(byId['cust-pay-PAY-1'].balance).toBe(400);
    expect(byId['sup-pay-SP-1'].balance).toBe(400);
    expect(summary.netBalance).toBe(400);
  });

  it('carries opening remaining-sales balance into a selected date range', () => {
    const { rangedRows, summary, openingBalance } = buildDayLedger({
      orders: [order({ id: 'ORD-1', totalAmount: 1000, orderDate: '2026-09-30' })],
      payments: [
        payment({ id: 'PAY-OLD', amount: 300, paymentDate: '2026-09-30' }),
        payment({ id: 'PAY-NEW', amount: 100, paymentDate: '2026-10-02' })
      ],
      purchases: [],
      expenses: [expense({ id: 'EXP-1', amount: 50, expenseDate: '2026-10-03' })]
    }, { start: '2026-10-01', end: '2026-10-31' });

    expect(openingBalance).toBe(700);
    expect(rangedRows).toHaveLength(2);
    expect(rangedRows[0].id).toBe('cust-pay-PAY-NEW');
    expect(rangedRows[0].balance).toBe(600);
    expect(rangedRows[1].id).toBe('expense-EXP-1');
    expect(rangedRows[1].balance).toBe(550);
    expect(summary.netBalance).toBe(550);
    expect(summary.closingBalance).toBe(550);
  });

  it('orders same-date rows as Sale, Purchase, Expense, Customer Payment, Supplier Payment, then id', () => {
    const entries = buildDayLedgerEntries({
      orders: [order({ id: 'ORD-B', totalAmount: 10, orderDate: '2026-10-01' })],
      payments: [payment({ id: 'PAY-A', amount: 10, paymentDate: '2026-10-01' })],
      purchases: [purchase({
        id: 'PO-A',
        totalAmount: 10,
        purchaseDate: '2026-10-01',
        paymentRecords: [{ id: 'SP-Z', purchaseId: 'PO-A', purchaseNumber: 'PO-A', supplierName: 'Polymer Co', amount: 10, paymentDate: '2026-10-01' }]
      })],
      expenses: [expense({ id: 'EXP-A', amount: 10, expenseDate: '2026-10-01' })]
    });
    expect(entries.map((row) => row.transactionType)).toEqual([
      'Sale',
      'Purchase',
      'Expense',
      'Customer Payment',
      'Supplier Payment'
    ]);
    expect(compareDayLedgerRows(
      { id: 'sale-a', date: '2026-10-01', transactionType: 'Sale' },
      { id: 'sale-b', date: '2026-10-01', transactionType: 'Sale' }
    )).toBeLessThan(0);
  });

  it('ignores cancelled documents and duplicate ids, and excludes AS order payments', () => {
    const entries = buildDayLedgerEntries({
      orders: [
        order({ id: 'ORD-X', totalAmount: 10, orderDate: '2026-10-01', orderStatus: 'cancelled' }),
        order({ id: 'ORD-AS', orderNumber: 'AS-1', totalAmount: 99, orderDate: '2026-10-01', orderType: 'AS' }),
        order({ id: 'ORD-1', totalAmount: 50, orderDate: '2026-10-01' }),
        order({ id: 'ORD-1', totalAmount: 50, orderDate: '2026-10-01' })
      ],
      payments: [
        payment({ id: 'PAY-AS', amount: 99, paymentDate: '2026-10-01', orderId: 'ORD-AS', orderNumber: 'AS-1' }),
        payment({ id: 'PAY-1', amount: 10, paymentDate: '2026-10-01' }),
        payment({ id: 'PAY-1', amount: 10, paymentDate: '2026-10-01' })
      ],
      purchases: [purchase({ id: 'PO-X', totalAmount: 10, purchaseDate: '2026-10-01', status: 'cancelled' })],
      expenses: [expense({ id: 'EXP-P', amount: 25, expenseDate: '2026-10-01', status: 'pending' })]
    });
    expect(entries.map((row) => row.id)).toEqual(['sale-ORD-1', 'expense-EXP-P', 'cust-pay-PAY-1']);
  });

  it('does not count supplier paymentRecords and leftover paidAmount twice', () => {
    const entries = buildDayLedgerEntries({
      orders: [],
      payments: [],
      purchases: [purchase({
        id: 'PO-1',
        totalAmount: 100,
        purchaseDate: '2026-10-01',
        paidAmount: 40,
        paymentRecords: [
          { id: 'SP-1', purchaseId: 'PO-1', purchaseNumber: 'PO-1', supplierName: 'Polymer Co', amount: 40, paymentDate: '2026-10-01' },
          { id: 'SP-1', purchaseId: 'PO-1', purchaseNumber: 'PO-1', supplierName: 'Polymer Co', amount: 40, paymentDate: '2026-10-01' }
        ]
      })],
      expenses: []
    });
    expect(entries.filter((row) => row.transactionType === 'Supplier Payment')).toHaveLength(1);
    expect(entries.find((row) => row.transactionType === 'Supplier Payment')?.credit).toBe(40);
  });

  it('applies an explicit opening remaining-sales balance', () => {
    const rows = applySalesRunningBalance([
      { id: 'e1', date: '2026-10-01', description: 'Electricity', party: '—', transactionType: 'Expense', debit: 25, credit: 0 }
    ], 100);
    expect(rows[0].balance).toBe(75);
    expect(summarizeDayLedger(rows, 100).netBalance).toBe(75);
  });
});
