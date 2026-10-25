import { Expense, Order, Payment, PurchaseOrder } from '../types';

export type DayLedgerType = 'Sale' | 'Customer Payment' | 'Purchase' | 'Supplier Payment' | 'Expense';

export interface DayLedgerEntry {
  id: string;
  date: string;
  description: string;
  party: string;
  transactionType: DayLedgerType;
  debit: number;
  credit: number;
  detailsPath?: string;
}

export interface DayLedgerRow extends DayLedgerEntry {
  balance: number;
}

export interface DayLedgerSources {
  orders: Order[];
  payments: Payment[];
  purchases: PurchaseOrder[];
  expenses: Expense[];
}

export interface DayLedgerDateBounds {
  start?: string;
  end?: string;
}

export interface DayLedgerSummary {
  totalDebit: number;
  totalCredit: number;
  openingBalance: number;
  closingBalance: number;
  totalSales: number;
  customerPaymentsReceived: number;
  businessExpenses: number;
  netBalance: number;
  customerReceivables: number;
  purchaseDebit: number;
  supplierPaymentsCredit: number;
  supplierPayables: number;
}

const TYPE_PRIORITY: Record<DayLedgerType, number> = {
  Sale: 1,
  Purchase: 2,
  Expense: 3,
  'Customer Payment': 4,
  'Supplier Payment': 5
};

/**
 * Remaining-sales impact for the company Day Ledger.
 * Net Balance = Total Sales − Customer Payments Received − Business Expenses − Raw Material Purchases.
 * Supplier payments are listed in the book but do not change this balance (purchases already deducted).
 */
export function salesBalanceImpact(row: Pick<DayLedgerEntry, 'transactionType' | 'debit' | 'credit'>): number {
  if (row.transactionType === 'Sale') return row.debit || 0;
  if (row.transactionType === 'Customer Payment') return -(row.credit || 0);
  if (row.transactionType === 'Expense') return -(row.debit || 0);
  if (row.transactionType === 'Purchase') return -(row.debit || 0);
  return 0;
}

export function compareDayLedgerRows(
  first: Pick<DayLedgerEntry, 'id' | 'date' | 'transactionType'>,
  second: Pick<DayLedgerEntry, 'id' | 'date' | 'transactionType'>
): number {
  if (!first.date && second.date) return 1;
  if (first.date && !second.date) return -1;
  const dateCmp = (first.date || '').localeCompare(second.date || '');
  if (dateCmp !== 0) return dateCmp;
  const typeCmp = (TYPE_PRIORITY[first.transactionType] || 9) - (TYPE_PRIORITY[second.transactionType] || 9);
  if (typeCmp !== 0) return typeCmp;
  return (first.id || '').localeCompare(second.id || '');
}

function excludedCommercialOrder(order: Order): boolean {
  return order.orderStatus === 'cancelled' || order.orderType === 'AS';
}

export function buildDayLedgerEntries(sources: DayLedgerSources): DayLedgerEntry[] {
  const raw: DayLedgerEntry[] = [];
  const seenIds = new Set<string>();
  const pushUnique = (entry: DayLedgerEntry) => {
    if (!entry.id || seenIds.has(entry.id)) return;
    seenIds.add(entry.id);
    raw.push(entry);
  };

  const excludedOrderKeys = new Set<string>();
  sources.orders.forEach((order) => {
    if (!excludedCommercialOrder(order)) return;
    if (order.id) excludedOrderKeys.add(order.id);
    if (order.orderNumber) excludedOrderKeys.add(order.orderNumber);
  });

  sources.orders
    .filter((order) => !excludedCommercialOrder(order))
    .forEach((order) => {
      const party = order.customerName || order.companyName || 'Customer';
      const desc = order.items && order.items.length > 0
        ? `Sale - ${order.items.map((i) => i.productName).filter(Boolean).slice(0, 2).join(', ')}${order.items.length > 2 ? '...' : ''}`
        : 'Sales';
      pushUnique({
        id: `sale-${order.id}`,
        date: order.orderDate || '',
        description: desc,
        party,
        transactionType: 'Sale',
        debit: order.totalAmount || 0,
        credit: 0,
        detailsPath: `/sales/${order.id}`
      });
    });

  sources.payments.forEach((payment) => {
    if (
      (payment.orderId && excludedOrderKeys.has(payment.orderId)) ||
      (payment.orderNumber && excludedOrderKeys.has(payment.orderNumber))
    ) {
      return;
    }
    pushUnique({
      id: `cust-pay-${payment.id}`,
      date: payment.paymentDate || '',
      description: 'Payment Received',
      party: payment.customerName || 'Customer',
      transactionType: 'Customer Payment',
      debit: 0,
      credit: payment.amount || 0,
      detailsPath: payment.orderId ? `/sales/${payment.orderId}` : undefined
    });
  });

  sources.purchases
    .filter((purchase) => purchase.status !== 'cancelled')
    .forEach((purchase) => {
      const party = purchase.supplierName || 'Supplier';
      const desc = purchase.items && purchase.items.length > 0
        ? `Raw Material Purchase - ${purchase.items.map((i) => i.rawMaterialName).filter(Boolean).slice(0, 2).join(', ')}${purchase.items.length > 2 ? '...' : ''}`
        : 'Raw Material Purchase';
      pushUnique({
        id: `purchase-${purchase.id}`,
        date: purchase.purchaseDate || '',
        description: desc,
        party,
        transactionType: 'Purchase',
        debit: purchase.totalAmount || 0,
        credit: 0,
        detailsPath: `/purchases/${purchase.id}`
      });

      const recordedPayments = purchase.paymentRecords || [];
      const seenPaymentIds = new Set<string>();
      recordedPayments.forEach((payment) => {
        if (!payment.id || seenPaymentIds.has(payment.id)) return;
        seenPaymentIds.add(payment.id);
        pushUnique({
          id: `sup-pay-${payment.id}`,
          date: payment.paymentDate || purchase.purchaseDate || '',
          description: 'Supplier Payment',
          party,
          transactionType: 'Supplier Payment',
          debit: 0,
          credit: payment.amount || 0,
          detailsPath: `/purchases/${purchase.id}`
        });
      });

      const recordedTotal = recordedPayments.reduce((sum, payment) => sum + (payment.amount || 0), 0);
      const legacyPaid = Math.max(0, (purchase.paidAmount || 0) - recordedTotal);
      if (legacyPaid > 0) {
        pushUnique({
          id: `sup-pay-legacy-${purchase.id}`,
          date: purchase.purchaseDate || '',
          description: 'Supplier Payment',
          party,
          transactionType: 'Supplier Payment',
          debit: 0,
          credit: legacyPaid,
          detailsPath: `/purchases/${purchase.id}`
        });
      }
    });

  sources.expenses.forEach((expense) => {
    pushUnique({
      id: `expense-${expense.id}`,
      date: expense.expenseDate || '',
      description: expense.description || 'Factory Expense',
      party: '—',
      transactionType: 'Expense',
      debit: expense.amount || 0,
      credit: 0
    });
  });

  return raw.sort(compareDayLedgerRows);
}

export function applySalesRunningBalance(
  entries: DayLedgerEntry[],
  openingBalance = 0
): DayLedgerRow[] {
  let balance = openingBalance;
  return entries.map((row) => {
    balance += salesBalanceImpact(row);
    return { ...row, balance };
  });
}

export function openingSalesBalanceBeforeRange(
  sortedEntries: DayLedgerEntry[],
  bounds: DayLedgerDateBounds,
  explicitOpening = 0
): number {
  if (!bounds.start) return explicitOpening;
  const priorImpact = sortedEntries
    .filter((row) => row.date && row.date < bounds.start!)
    .reduce((sum, row) => sum + salesBalanceImpact(row), 0);
  return explicitOpening + priorImpact;
}

export function inDateRange(row: DayLedgerEntry, bounds: DayLedgerDateBounds): boolean {
  if (bounds.start && (!row.date || row.date < bounds.start)) return false;
  if (bounds.end && (!row.date || row.date > bounds.end)) return false;
  return true;
}

export function summarizeDayLedger(rows: DayLedgerRow[], openingBalance = 0): DayLedgerSummary {
  const totalSales = rows.filter((row) => row.transactionType === 'Sale').reduce((sum, row) => sum + row.debit, 0);
  const customerPaymentsReceived = rows
    .filter((row) => row.transactionType === 'Customer Payment')
    .reduce((sum, row) => sum + row.credit, 0);
  const businessExpenses = rows.filter((row) => row.transactionType === 'Expense').reduce((sum, row) => sum + row.debit, 0);
  const purchaseDebit = rows.filter((row) => row.transactionType === 'Purchase').reduce((sum, row) => sum + row.debit, 0);
  const supplierPaymentsCredit = rows
    .filter((row) => row.transactionType === 'Supplier Payment')
    .reduce((sum, row) => sum + row.credit, 0);
  const netBalance = openingBalance + totalSales - customerPaymentsReceived - businessExpenses - purchaseDebit;
  const closingBalance = rows.length > 0 ? rows[rows.length - 1].balance : openingBalance;

  return {
    totalDebit: rows.reduce((sum, row) => sum + row.debit, 0),
    totalCredit: rows.reduce((sum, row) => sum + row.credit, 0),
    openingBalance,
    closingBalance,
    totalSales,
    customerPaymentsReceived,
    businessExpenses,
    netBalance,
    customerReceivables: totalSales - customerPaymentsReceived,
    purchaseDebit,
    supplierPaymentsCredit,
    supplierPayables: purchaseDebit - supplierPaymentsCredit
  };
}

export function buildDayLedger(
  sources: DayLedgerSources,
  bounds: DayLedgerDateBounds = {},
  explicitOpening = 0
): { rows: DayLedgerRow[]; summary: DayLedgerSummary; openingBalance: number; rangedRows: DayLedgerRow[] } {
  const sorted = buildDayLedgerEntries(sources);
  const openingBalance = openingSalesBalanceBeforeRange(sorted, bounds, explicitOpening);
  const rangedEntries = sorted.filter((row) => inDateRange(row, bounds));
  const rangedRows = applySalesRunningBalance(rangedEntries, openingBalance);
  const summary = summarizeDayLedger(rangedRows, openingBalance);
  return { rows: rangedRows, summary, openingBalance, rangedRows };
}
