import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Order, Payment, Expense, PurchaseOrder, Customer, Settings } from '../types';
import { getOrders, getPayments, getExpenses, getPurchases, getCustomers, getSettings, deleteExpense } from '../services/db';
import { StatCard } from '../components/common/StatCard';
import { Badge } from '../components/common/Badge';
import {
  IndianRupee,
  TrendingUp,
  CreditCard,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  Trash2,
  AlertTriangle,
  Loader2,
  Search,
  Printer,
  CalendarDays,
  RefreshCw,
  Filter,
  BookOpen
} from 'lucide-react';
import { useTranslation } from '../i18n';

interface FinanceProps {
  onOpenRecordPaymentModal: () => void;
  onOpenAddExpenseModal: () => void;
}

type StatementFilter = 'all' | 'sales' | 'purchases';
type DateFilter = 'all' | 'today' | 'week' | 'month' | 'custom';
type PartyType = 'customer' | 'supplier';

export type DayLedgerType = 'Sale' | 'Customer Payment' | 'Purchase' | 'Supplier Payment' | 'Expense';

export interface DayLedgerRow {
  id: string;
  date: string;
  description: string;
  party: string;
  transactionType: DayLedgerType;
  debit: number;
  credit: number;
  balance: number;
  detailsPath?: string;
}

interface PartyLedgerRow {
  date: string;
  party?: string;
  transaction: string;
  reference: string;
  debit: number;
  credit: number;
  balance: number;
  detailsPath?: string;
}

interface StatementRow {
  type: 'SALE' | 'PURCHASE';
  id: string;
  date: string;
  party: string;
  total: number;
  paid: number;
  outstanding: number;
  status: string;
  detailsPath: string;
}

const formatCurrency = (value: number | undefined | null) => {
  const num = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};
const toDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
const ALL_PARTIES_ID = '__all_parties__';

export const Finance: React.FC<FinanceProps> = ({
  onOpenRecordPaymentModal,
  onOpenAddExpenseModal
}) => {
  const { t } = useTranslation();
  const [orders, setOrders] = useState<Order[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [purchases, setPurchases] = useState<PurchaseOrder[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [activeTab, setActiveTab] = useState<'ledger' | 'party' | 'statement' | 'collections' | 'expenses'>('ledger');
  
  // Day-to-Day Ledger filter states
  const [dayLedgerDateFilter, setDayLedgerDateFilter] = useState<DateFilter>('all');
  const [dayLedgerStartDate, setDayLedgerStartDate] = useState('');
  const [dayLedgerEndDate, setDayLedgerEndDate] = useState('');
  const [dayLedgerTypeFilter, setDayLedgerTypeFilter] = useState<string>('all');
  const [dayLedgerPartyFilter, setDayLedgerPartyFilter] = useState<string>('all');
  const [dayLedgerSearch, setDayLedgerSearch] = useState('');

  // Party-wise Statement filter states
  const [showPartyFilters, setShowPartyFilters] = useState(false);
  const [partyType, setPartyType] = useState<PartyType>('customer');
  const [selectedPartyId, setSelectedPartyId] = useState('');
  const [partySearch, setPartySearch] = useState('');
  const [partyDateFilter, setPartyDateFilter] = useState<'all' | 'today' | 'month' | 'custom'>('all');
  const [partyStartDate, setPartyStartDate] = useState('');
  const [partyEndDate, setPartyEndDate] = useState('');

  // Statement filter states
  const [statementFilter, setStatementFilter] = useState<StatementFilter>('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [statementSearch, setStatementSearch] = useState('');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [loading, setLoading] = useState(true);

  // Deletion modal state
  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    loadFinanceData();
  }, []);

  const loadFinanceData = async () => {
    setLoading(true);
    try {
      const [ordList, pymtList, expList, purchaseList, customerList, settingsData] = await Promise.all([
        getOrders(),
        getPayments(),
        getExpenses(),
        getPurchases(),
        getCustomers(),
        getSettings()
      ]);
      setOrders(ordList);
      setPayments(pymtList);
      setExpenses(expList);
      setPurchases(purchaseList);
      setCustomers(customerList);
      setSettings(settingsData);
      setSelectedPartyId((current) => current || customerList[0]?.id || purchaseList[0]?.supplierName || '');
    } catch (e) {
      console.error('Error loading finance data:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!expenseToDelete) return;
    setIsDeleting(true);
    try {
      await deleteExpense(expenseToDelete.id);
      setExpenseToDelete(null);
      await loadFinanceData();
    } catch (e) {
      console.error('Failed to delete expense:', e);
    } finally {
      setIsDeleting(false);
    }
  };

  const activeOrders = orders.filter((order) => order.orderStatus !== 'cancelled' && order.orderType !== 'AS');
  const activeOrderIds = new Set(activeOrders.flatMap((order) => [order.id, order.orderNumber]));
  const totalSales = activeOrders.reduce((sum, o) => sum + o.totalAmount, 0);
  const totalCollections = payments.filter((payment) => activeOrderIds.has(payment.orderId)).reduce((sum, p) => sum + p.amount, 0);
  const pendingCollections = Math.max(0, totalSales - totalCollections);
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const netBalance = totalCollections - totalExpenses;

  const paymentTotalsByOrder = payments.reduce<Record<string, number>>((totals, payment) => {
    totals[payment.orderId] = (totals[payment.orderId] || 0) + payment.amount;
    return totals;
  }, {});

  // ── Build Company-Level Day-to-Day Ledger from Real System Data ──────────
  const rawDayLedger: Array<Omit<DayLedgerRow, 'balance'>> = [];

  // 1. Sales Transactions
  orders
    .filter((order) => order.orderStatus !== 'cancelled' && order.orderType !== 'AS')
    .forEach((order) => {
      const party = order.companyName || order.customerName || 'Customer';
      const desc = order.items && order.items.length > 0
        ? `Sale - ${order.items.map((i) => i.productName).filter(Boolean).slice(0, 2).join(', ')}${order.items.length > 2 ? '...' : ''}`
        : 'Sales';
      rawDayLedger.push({
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

  // 2. Customer Payments
  payments.forEach((payment) => {
    const party = payment.customerName || 'Customer';
    rawDayLedger.push({
      id: `cust-pay-${payment.id}`,
      date: payment.paymentDate || '',
      description: 'Payment Received',
      party,
      transactionType: 'Customer Payment',
      debit: 0,
      credit: payment.amount || 0,
      detailsPath: payment.orderId ? `/sales/${payment.orderId}` : undefined
    });
  });

  // 3. Purchases & Supplier Payments
  purchases
    .filter((purchase) => purchase.status !== 'cancelled')
    .forEach((purchase) => {
      const party = purchase.supplierName || 'Supplier';
      const desc = purchase.items && purchase.items.length > 0
        ? `Raw Material Purchase - ${purchase.items.map((i) => i.rawMaterialName).filter(Boolean).slice(0, 2).join(', ')}${purchase.items.length > 2 ? '...' : ''}`
        : 'Raw Material Purchase';
      rawDayLedger.push({
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
      recordedPayments.forEach((payment) => {
        rawDayLedger.push({
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

      const recordedTotal = recordedPayments.reduce((sum, payment) => sum + payment.amount, 0);
      const legacyPaid = Math.max(0, (purchase.paidAmount || 0) - recordedTotal);
      if (legacyPaid > 0) {
        rawDayLedger.push({
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

  // 4. Expenses
  expenses.forEach((expense) => {
    rawDayLedger.push({
        id: `expense-${expense.id}`,
        date: expense.expenseDate || '',
        description: expense.description || 'Factory Expense',
        party: '—',
        transactionType: 'Expense',
        debit: expense.amount || 0,
        credit: 0
      });
    });

  // Sort chronologically ascending
  const sortedDayLedger = [...rawDayLedger].sort((first, second) => {
    if (!first.date && second.date) return 1;
    if (first.date && !second.date) return -1;
    const dateCmp = (first.date || '').localeCompare(second.date || '');
    if (dateCmp !== 0) return dateCmp;
    const typePriority: Record<DayLedgerType, number> = {
      Sale: 1,
      Purchase: 2,
      Expense: 3,
      'Customer Payment': 4,
      'Supplier Payment': 5
    };
    return (typePriority[first.transactionType] || 9) - (typePriority[second.transactionType] || 9);
  });

  // Calculate Running Balance across the master chronological timeline
  let runningLedgerBal = 0;
  const masterDayLedgerWithBalance: DayLedgerRow[] = sortedDayLedger.map((row) => {
    runningLedgerBal += row.debit - row.credit;
    return {
      ...row,
      balance: runningLedgerBal
    };
  });

  const today = toDateKey(new Date());
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const weekStartKey = toDateKey(weekStart);
  const monthStart = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`;

  // Filtered Day-to-Day Ledger Rows
  const filteredDayLedgerRows = masterDayLedgerWithBalance
    .filter((row) => {
      if (dayLedgerTypeFilter !== 'all' && row.transactionType !== dayLedgerTypeFilter) return false;
      if (dayLedgerPartyFilter !== 'all' && row.party !== dayLedgerPartyFilter) return false;
      if (dayLedgerDateFilter === 'today') return row.date === today;
      if (dayLedgerDateFilter === 'week') return row.date >= weekStartKey && row.date <= today;
      if (dayLedgerDateFilter === 'month') return row.date >= monthStart && row.date <= today;
      if (dayLedgerDateFilter === 'custom') {
        return (!dayLedgerStartDate || row.date >= dayLedgerStartDate) && (!dayLedgerEndDate || row.date <= dayLedgerEndDate);
      }
      return true;
    })
    .filter((row) => {
      const query = dayLedgerSearch.trim().toLowerCase();
      if (!query) return true;
      return (
        row.description.toLowerCase().includes(query) ||
        row.party.toLowerCase().includes(query) ||
        row.transactionType.toLowerCase().includes(query) ||
        row.date.toLowerCase().includes(query)
      );
    });

  const dayLedgerTotalDebit = filteredDayLedgerRows.reduce((sum, row) => sum + row.debit, 0);
  const dayLedgerTotalCredit = filteredDayLedgerRows.reduce((sum, row) => sum + row.credit, 0);
  const dayLedgerClosingBalance = dayLedgerTotalDebit - dayLedgerTotalCredit;

  const dayLedgerPartyOptions = Array.from(
    new Set(
      masterDayLedgerWithBalance
        .map((row) => row.party)
        .filter((party) => party && party !== '—')
    )
  ).sort((a, b) => a.localeCompare(b));

  const getBadgeForType = (type: DayLedgerType) => {
    switch (type) {
      case 'Sale':
        return <span className="inline-flex px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200/60">{t('Sale')}</span>;
      case 'Customer Payment':
        return <span className="inline-flex px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">{t('Customer Payment')}</span>;
      case 'Purchase':
        return <span className="inline-flex px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/60">{t('Purchase')}</span>;
      case 'Supplier Payment':
        return <span className="inline-flex px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200/60">{t('Supplier Payment')}</span>;
      case 'Expense':
        return <span className="inline-flex px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200/60">{t('Expense')}</span>;
      default:
        return <span className="inline-flex px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-50 text-slate-700 border border-slate-200/60">{type}</span>;
    }
  };

  const statementRows: StatementRow[] = [
    ...orders
      .filter((order) => order.orderStatus !== 'cancelled' && order.orderType !== 'AS')
      .map((order) => {
        const paid = paymentTotalsByOrder[order.id] || paymentTotalsByOrder[order.orderNumber] || 0;
        return {
          type: 'SALE' as const,
          id: order.orderNumber,
          date: order.orderDate,
          party: order.companyName || order.customerName,
          total: order.totalAmount,
          paid,
          outstanding: Math.max(0, order.totalAmount - paid),
          status: order.orderStatus,
          detailsPath: `/sales/${order.id}`
        };
      }),
    ...purchases
      .filter((purchase) => purchase.status !== 'cancelled')
      .map((purchase) => ({
        type: 'PURCHASE' as const,
        id: purchase.purchaseNumber,
        date: purchase.purchaseDate,
        party: purchase.supplierName,
        total: purchase.totalAmount,
        paid: purchase.paidAmount || 0,
        outstanding: Math.max(0, purchase.totalAmount - (purchase.paidAmount || 0)),
        status: purchase.status,
        detailsPath: `/purchases/${purchase.id}`
      }))
  ];

  const filteredStatementRows = statementRows
    .filter((row) => statementFilter === 'all' || (statementFilter === 'sales' ? row.type === 'SALE' : row.type === 'PURCHASE'))
    .filter((row) => {
      if (dateFilter === 'all') return true;
      if (dateFilter === 'today') return row.date === today;
      if (dateFilter === 'week') return row.date >= weekStartKey && row.date <= today;
      if (dateFilter === 'month') return row.date >= monthStart && row.date <= today;
      return (!customStartDate || row.date >= customStartDate) && (!customEndDate || row.date <= customEndDate);
    })
    .filter((row) => {
      const query = statementSearch.trim().toLowerCase();
      return !query || row.id.toLowerCase().includes(query) || row.party.toLowerCase().includes(query);
    })
    .sort((first, second) => second.date.localeCompare(first.date));

  const salesRows = filteredStatementRows.filter((row) => row.type === 'SALE');
  const purchaseRows = filteredStatementRows.filter((row) => row.type === 'PURCHASE');
  const statementTotals = {
    sales: salesRows.reduce((sum, row) => sum + row.total, 0),
    salesPaid: salesRows.reduce((sum, row) => sum + row.paid, 0),
    purchases: purchaseRows.reduce((sum, row) => sum + row.total, 0),
    purchasesPaid: purchaseRows.reduce((sum, row) => sum + row.paid, 0)
  };

  const partyOptions = partyType === 'customer'
    ? [{ id: ALL_PARTIES_ID, name: t('All Customers'), contact: '', phone: '' }, ...customers
        .filter((customer) => {
          const query = partySearch.trim().toLowerCase();
          return !query || customer.company.toLowerCase().includes(query) || customer.name.toLowerCase().includes(query) || customer.phone.toLowerCase().includes(query);
        })
        .map((customer) => ({ id: customer.id, name: customer.company || customer.name, contact: customer.name, phone: customer.phone }))]
    : [{ id: ALL_PARTIES_ID, name: t('All Suppliers'), contact: '', phone: '' }, ...Array.from(new Set(purchases.map((purchase) => purchase.supplierName).filter(Boolean)))
        .filter((supplier) => supplier.toLowerCase().includes(partySearch.trim().toLowerCase()))
        .map((supplier) => ({ id: supplier, name: supplier, contact: '', phone: '' }))];

  const selectedCustomer = partyType === 'customer' ? customers.find((customer) => customer.id === selectedPartyId) : undefined;
  const selectedSupplier = partyType === 'supplier' && selectedPartyId !== ALL_PARTIES_ID ? selectedPartyId : '';
  const isAllParties = selectedPartyId === ALL_PARTIES_ID;
  const partyLedgerBase: Array<Omit<PartyLedgerRow, 'balance'>> = [];

  if (partyType === 'customer' && isAllParties) {
    const customerOrders = orders.filter((order) => order.orderStatus !== 'cancelled' && order.orderType !== 'AS');
    customerOrders.forEach((order) => {
      partyLedgerBase.push({
        date: order.orderDate,
        party: order.companyName || order.customerName,
        transaction: 'Sale',
        reference: order.orderNumber,
        debit: order.totalAmount,
        credit: 0,
        detailsPath: `/sales/${order.id}`
      });
    });
    payments
      .filter((payment) => customerOrders.some((order) => order.id === payment.orderId || order.orderNumber === payment.orderId) || customers.some((customer) => customer.id === payment.customerId || customer.company === payment.customerName || customer.name === payment.customerName))
      .forEach((payment) => {
        const customer = customers.find((candidate) => candidate.id === payment.customerId || candidate.company === payment.customerName);
        const order = customerOrders.find((candidate) => candidate.id === payment.orderId || candidate.orderNumber === payment.orderId);
        partyLedgerBase.push({
          date: payment.paymentDate,
          party: customer?.company || customer?.name || order?.companyName || order?.customerName || 'Customer',
          transaction: 'Payment',
          reference: payment.receiptNumber,
          debit: 0,
          credit: payment.amount,
          detailsPath: `/sales/${payment.orderId}`
        });
      });
  } else if (partyType === 'customer' && selectedCustomer) {
    const customerOrders = orders.filter((order) =>
      order.orderStatus !== 'cancelled' &&
      order.orderType !== 'AS' &&
      (order.customerId === selectedCustomer.id || order.companyName === selectedCustomer.company || order.customerName === selectedCustomer.name)
    );
    customerOrders.forEach((order) => {
      partyLedgerBase.push({
        date: order.orderDate,
        transaction: 'Sale',
        reference: order.orderNumber,
        debit: order.totalAmount,
        credit: 0,
        detailsPath: `/sales/${order.id}`
      });
    });
    payments
      .filter((payment) => customerOrders.some((order) => order.id === payment.orderId || order.orderNumber === payment.orderId) || payment.customerId === selectedCustomer.id || payment.customerName === selectedCustomer.company)
      .forEach((payment) => {
        partyLedgerBase.push({
          date: payment.paymentDate,
          transaction: 'Payment',
          reference: payment.receiptNumber,
          debit: 0,
          credit: payment.amount,
          detailsPath: `/sales/${payment.orderId}`
        });
      });
  } else if (partyType === 'supplier' && selectedPartyId === ALL_PARTIES_ID) {
    purchases
      .filter((purchase) => purchase.status !== 'cancelled')
      .forEach((purchase) => {
        partyLedgerBase.push({
          date: purchase.purchaseDate,
          party: purchase.supplierName,
          transaction: 'Purchase',
          reference: purchase.purchaseNumber,
          debit: purchase.totalAmount,
          credit: 0,
          detailsPath: `/purchases/${purchase.id}`
        });
        const recordedPayments = purchase.paymentRecords || [];
        recordedPayments.forEach((payment) => {
          partyLedgerBase.push({
            date: payment.paymentDate,
            party: purchase.supplierName,
            transaction: 'Payment',
            reference: payment.id,
            debit: 0,
            credit: payment.amount,
            detailsPath: `/purchases/${purchase.id}`
          });
        });
        const recordedTotal = recordedPayments.reduce((sum, payment) => sum + payment.amount, 0);
        const legacyPaid = Math.max(0, (purchase.paidAmount || 0) - recordedTotal);
        if (legacyPaid > 0) {
          partyLedgerBase.push({
            date: '',
            party: purchase.supplierName,
            transaction: 'Payment',
            reference: `PAY-${purchase.purchaseNumber}`,
            debit: 0,
            credit: legacyPaid,
            detailsPath: `/purchases/${purchase.id}`
          });
        }
      });
  } else if (partyType === 'supplier' && selectedSupplier) {
    purchases
      .filter((purchase) => purchase.status !== 'cancelled' && purchase.supplierName === selectedSupplier)
      .forEach((purchase) => {
        partyLedgerBase.push({
          date: purchase.purchaseDate,
          transaction: 'Purchase',
          reference: purchase.purchaseNumber,
          debit: purchase.totalAmount,
          credit: 0,
          detailsPath: `/purchases/${purchase.id}`
        });
        const recordedPayments = purchase.paymentRecords || [];
        recordedPayments.forEach((payment) => {
          partyLedgerBase.push({
            date: payment.paymentDate,
            transaction: 'Payment',
            reference: payment.id,
            debit: 0,
            credit: payment.amount,
            detailsPath: `/purchases/${purchase.id}`
          });
        });
        const recordedTotal = recordedPayments.reduce((sum, payment) => sum + payment.amount, 0);
        const legacyPaid = Math.max(0, (purchase.paidAmount || 0) - recordedTotal);
        if (legacyPaid > 0) {
          partyLedgerBase.push({
            date: '',
            transaction: 'Payment',
            reference: `PAY-${purchase.purchaseNumber}`,
            debit: 0,
            credit: legacyPaid,
            detailsPath: `/purchases/${purchase.id}`
          });
        }
      });
  }

  const filteredPartyLedger = partyLedgerBase
    .filter((row) => {
      if (partyDateFilter === 'all') return true;
      if (partyDateFilter === 'today') return row.date === today;
      if (partyDateFilter === 'month') return row.date >= monthStart && row.date <= today;
      return (!partyStartDate || row.date >= partyStartDate) && (!partyEndDate || row.date <= partyEndDate);
    })
    .sort((first, second) => {
      if (!first.date && second.date) return 1;
      if (first.date && !second.date) return -1;
      return first.date.localeCompare(second.date) || (first.transaction === 'Sale' || first.transaction === 'Purchase' ? -1 : 1);
    });
  let runningBalance = 0;
  const partyLedgerRows: PartyLedgerRow[] = filteredPartyLedger.map((row) => {
    runningBalance += row.debit - row.credit;
    return { ...row, balance: runningBalance };
  });
  const partySummary = {
    debit: partyLedgerRows.reduce((sum, row) => sum + row.debit, 0),
    credit: partyLedgerRows.reduce((sum, row) => sum + row.credit, 0),
    balance: partyLedgerRows[partyLedgerRows.length - 1]?.balance || 0
  };

  return (
    <div className="space-y-6">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200/60">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">{t('Finance & Accounting')}</h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Cash flows, customer collections, outstanding balances, and factory expenses
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={onOpenAddExpenseModal}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs rounded-lg transition-colors flex items-center space-x-1.5 shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5 text-rose-400" />
            <span>Add Expense</span>
          </button>
          <button
            onClick={onOpenRecordPaymentModal}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs rounded-lg transition-colors flex items-center space-x-1.5 shadow-2xs"
          >
            <IndianRupee className="w-3.5 h-3.5" />
            <span>Record Payment</span>
          </button>
        </div>
      </div>

      {/* Financial KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          title="Total Sales"
          value={`₹${(totalSales / 100000).toFixed(2)}L`}
          icon={IndianRupee}
          subtitle="Gross Invoiced"
          iconBgColor="bg-blue-50"
          iconTextColor="text-blue-600"
        />
        <StatCard
          title="Amount Collected"
          value={`₹${(totalCollections / 100000).toFixed(2)}L`}
          icon={TrendingUp}
          change="Received"
          changeType="positive"
          subtitle="Bank & UPI Receipts"
          iconBgColor="bg-emerald-50"
          iconTextColor="text-emerald-600"
        />
        <StatCard
          title="Pending Collection"
          value={`₹${(pendingCollections / 100000).toFixed(2)}L`}
          icon={CreditCard}
          change="Outstanding"
          changeType="negative"
          subtitle="Receivables from clients"
          iconBgColor="bg-amber-50"
          iconTextColor="text-amber-600"
        />
        <StatCard
          title="Factory Expenses"
          value={`₹${(totalExpenses / 100000).toFixed(2)}L`}
          icon={ArrowDownRight}
          change="Paid Out"
          changeType="neutral"
          subtitle="Materials & Utilities"
          iconBgColor="bg-rose-50"
          iconTextColor="text-rose-600"
        />
        <StatCard
          title="Net Cash Balance"
          value={`₹${(netBalance / 100000).toFixed(2)}L`}
          icon={ArrowUpRight}
          change={netBalance >= 0 ? 'Surplus' : 'Deficit'}
          changeType={netBalance >= 0 ? 'positive' : 'negative'}
          subtitle="Collections minus expenses"
          iconBgColor="bg-purple-50"
          iconTextColor="text-purple-600"
        />
      </div>

      {/* Tab Switcher & Data Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="inline-flex flex-wrap p-1 bg-slate-100/80 rounded-lg border border-slate-200/60 gap-1 text-xs">
            <button
              onClick={() => setActiveTab('ledger')}
              className={`px-3.5 py-1.5 font-semibold rounded-md transition-all flex items-center gap-1.5 ${
                activeTab === 'ledger'
                  ? 'bg-white text-slate-900 shadow-2xs border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5 text-blue-600" />
              <span>{t('Day-to-Day Ledger')}</span>
            </button>
            <button
              onClick={() => setActiveTab('party')}
              className={`px-3.5 py-1.5 font-semibold rounded-md transition-all ${
                activeTab === 'party'
                  ? 'bg-white text-slate-900 shadow-2xs border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t('Party-wise Statement')}
            </button>
            <button
              onClick={() => setActiveTab('statement')}
              className={`px-3.5 py-1.5 font-semibold rounded-md transition-all ${
                activeTab === 'statement'
                  ? 'bg-white text-slate-900 shadow-2xs border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t('Sales & Purchase Statement')}
            </button>
            <button
              onClick={() => setActiveTab('collections')}
              className={`px-3.5 py-1.5 font-semibold rounded-md transition-all ${
                activeTab === 'collections'
                  ? 'bg-white text-slate-900 shadow-2xs border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t('Customer Payment Receipts')} ({payments.length})
            </button>
            <button
              onClick={() => setActiveTab('expenses')}
              className={`px-3.5 py-1.5 font-semibold rounded-md transition-all ${
                activeTab === 'expenses'
                  ? 'bg-white text-slate-900 shadow-2xs border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t('Expense Vouchers')} ({expenses.length})
            </button>
          </div>

          {activeTab === 'party' && (
            <button
              onClick={() => setShowPartyFilters(!showPartyFilters)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200/80 text-slate-700 font-semibold text-xs rounded-lg transition-colors border border-slate-200/80 shadow-2xs"
            >
              <Filter className="w-3.5 h-3.5 text-slate-500" />
              <span>{showPartyFilters ? t('Hide Filters') : t('Show Filters')}</span>
            </button>
          )}
        </div>

        {activeTab === 'ledger' ? (
          <div className="space-y-4">
            {/* Day-to-Day Ledger Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-100/80">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{t('Total Debit')}</div>
                <div className="text-lg font-bold text-blue-700 mt-1">{formatCurrency(dayLedgerTotalDebit)}</div>
                <div className="text-[11px] text-slate-500 mt-0.5">Sales, Purchases & Expenses</div>
              </div>
              <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-100/80">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{t('Total Credit')}</div>
                <div className="text-lg font-bold text-emerald-700 mt-1">{formatCurrency(dayLedgerTotalCredit)}</div>
                <div className="text-[11px] text-slate-500 mt-0.5">Customer & Supplier Payments</div>
              </div>
              <div className="p-4 rounded-xl bg-purple-50/70 border border-purple-100/80">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{t('Closing Balance')}</div>
                <div className={`text-lg font-bold mt-1 ${dayLedgerClosingBalance >= 0 ? 'text-purple-700' : 'text-rose-700'}`}>
                  {formatCurrency(dayLedgerClosingBalance)}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">Net Cumulative Ledger Position</div>
              </div>
            </div>

            {/* Filters Toolbar */}
            <div className="flex flex-col lg:flex-row gap-2.5 lg:items-center lg:justify-between bg-slate-50/60 p-3 rounded-xl border border-slate-200/70">
              <div className="flex flex-wrap items-center gap-2 flex-1">
                <div className="relative min-w-[200px] flex-1 sm:flex-initial">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={dayLedgerSearch}
                    onChange={(e) => setDayLedgerSearch(e.target.value)}
                    placeholder="Search description, party..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-white rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <select
                  value={dayLedgerDateFilter}
                  onChange={(e) => setDayLedgerDateFilter(e.target.value as DateFilter)}
                  className="px-2.5 py-1.5 bg-white text-xs font-medium rounded-lg border border-slate-200 text-slate-700"
                >
                  <option value="all">All Dates</option>
                  <option value="today">Today</option>
                  <option value="week">This Week</option>
                  <option value="month">This Month</option>
                  <option value="custom">Custom Range</option>
                </select>

                <select
                  value={dayLedgerTypeFilter}
                  onChange={(e) => setDayLedgerTypeFilter(e.target.value)}
                  className="px-2.5 py-1.5 bg-white text-xs font-medium rounded-lg border border-slate-200 text-slate-700"
                >
                  <option value="all">{t('All Transaction Types')}</option>
                  <option value="Sale">{t('Sale')}</option>
                  <option value="Customer Payment">{t('Customer Payment')}</option>
                  <option value="Purchase">{t('Purchase')}</option>
                  <option value="Supplier Payment">{t('Supplier Payment')}</option>
                  <option value="Expense">{t('Expense')}</option>
                </select>

                <select
                  value={dayLedgerPartyFilter}
                  onChange={(e) => setDayLedgerPartyFilter(e.target.value)}
                  className="px-2.5 py-1.5 bg-white text-xs font-medium rounded-lg border border-slate-200 text-slate-700 max-w-[180px] truncate"
                >
                  <option value="all">{t('All Parties')}</option>
                  {dayLedgerPartyOptions.map((party) => (
                    <option key={party} value={party}>
                      {party}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 self-end lg:self-auto">
                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-lg transition-colors shadow-2xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>{t('Print Ledger')}</span>
                </button>
                <button
                  onClick={loadFinanceData}
                  className="p-1.5 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"
                  title="Refresh data"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {dayLedgerDateFilter === 'custom' && (
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <CalendarDays className="w-4 h-4 text-slate-400" />
                <label className="flex items-center gap-1">
                  From:
                  <input
                    type="date"
                    value={dayLedgerStartDate}
                    onChange={(e) => setDayLedgerStartDate(e.target.value)}
                    className="px-2 py-1 bg-white border border-slate-200 rounded-md text-xs"
                  />
                </label>
                <label className="flex items-center gap-1">
                  To:
                  <input
                    type="date"
                    value={dayLedgerEndDate}
                    onChange={(e) => setDayLedgerEndDate(e.target.value)}
                    className="px-2 py-1 bg-white border border-slate-200 rounded-md text-xs"
                  />
                </label>
              </div>
            )}

            {/* Day-to-Day Ledger Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-y border-slate-200/70 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Description</th>
                    <th className="py-3 px-4">Party</th>
                    <th className="py-3 px-4">Transaction Type</th>
                    <th className="py-3 px-4 text-right">Debit</th>
                    <th className="py-3 px-4 text-right">Credit</th>
                    <th className="py-3 px-4 text-right">Running Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                  {filteredDayLedgerRows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        {t('No ledger transactions found for the selected period.')}
                      </td>
                    </tr>
                  ) : (
                    filteredDayLedgerRows.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-4 text-slate-500 whitespace-nowrap">{row.date || '—'}</td>
                        <td className="py-3 px-4 font-semibold text-slate-900">
                          {row.detailsPath ? (
                            <Link to={row.detailsPath} className="hover:text-blue-600 transition-colors">
                              {row.description}
                            </Link>
                          ) : (
                            row.description
                          )}
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-800">{row.party}</td>
                        <td className="py-3 px-4">{getBadgeForType(row.transactionType)}</td>
                        <td className="py-3 px-4 text-right font-semibold text-blue-700 whitespace-nowrap">
                          {row.debit > 0 ? formatCurrency(row.debit) : '—'}
                        </td>
                        <td className="py-3 px-4 text-right font-semibold text-emerald-700 whitespace-nowrap">
                          {row.credit > 0 ? formatCurrency(row.credit) : '—'}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-slate-900 whitespace-nowrap">
                          {formatCurrency(row.balance)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : activeTab === 'party' ? (
          <div className="space-y-4">
            {showPartyFilters && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{t('Party Type')}</div>
                  <select value={partyType} onChange={(event) => { const nextType = event.target.value as PartyType; const firstSupplier = purchases.find((purchase) => purchase.supplierName)?.supplierName || ''; setPartyType(nextType); setSelectedPartyId(nextType === 'customer' ? customers[0]?.id || '' : firstSupplier); }} className="mt-2 w-full px-3 py-2 bg-white text-xs font-semibold rounded-lg border border-slate-200">
                    <option value="customer">{t('Customer')}</option>
                    <option value="supplier">{t('Supplier')}</option>
                  </select>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 sm:col-span-2 lg:col-span-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{t('Party')}</div>
                    <div className="relative w-48">
                      <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input value={partySearch} onChange={(event) => setPartySearch(event.target.value)} placeholder="Search party" className="w-full pl-8 pr-2 py-1.5 text-xs bg-white rounded-lg border border-slate-200" />
                    </div>
                  </div>
                  <select value={selectedPartyId} onChange={(event) => setSelectedPartyId(event.target.value)} className="mt-2 w-full px-3 py-2 bg-white text-xs font-semibold rounded-lg border border-slate-200">
                    <option value="">{t('Select')} {partyType === 'customer' ? t('Customer') : t('Supplier')}</option>
                    {partyOptions.map((party) => <option key={party.id} value={party.id}>{party.name}{party.contact ? ` - ${party.contact}` : ''}</option>)}
                  </select>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{t('Date Range')}</div>
                  <select value={partyDateFilter} onChange={(event) => setPartyDateFilter(event.target.value as typeof partyDateFilter)} className="mt-2 w-full px-3 py-2 bg-white text-xs font-semibold rounded-lg border border-slate-200">
                    <option value="all">All Dates</option>
                    <option value="today">Today</option>
                    <option value="month">This Month</option>
                    <option value="custom">Custom Range</option>
                  </select>
                </div>
              </div>
            )}

            {selectedPartyId && (
              <div className="p-4 rounded-xl border border-slate-200 bg-white flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Party Details</div>
                <div className="text-base font-bold text-slate-900 mt-1">{isAllParties ? `All ${partyType === 'customer' ? 'Customers' : 'Suppliers'}` : partyType === 'customer' ? selectedCustomer?.company || selectedCustomer?.name : selectedSupplier}</div>
                <div className="text-xs text-slate-500 mt-1">{isAllParties ? `Combined ${partyType === 'customer' ? 'customer' : 'supplier'} transactions` : partyType === 'customer' ? `${selectedCustomer?.name || ''}${selectedCustomer?.phone ? ` · ${selectedCustomer.phone}` : ''}` : 'Supplier'} · {partyType === 'customer' ? 'Customer' : 'Supplier'}</div>
                </div>
                <button onClick={() => window.print()} className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800"><Printer className="w-3.5 h-3.5" /> {t('Print Statement')}</button>
              </div>
            )}

            {partyDateFilter === 'custom' && (
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500"><CalendarDays className="w-4 h-4" /><label>From <input type="date" value={partyStartDate} onChange={(event) => setPartyStartDate(event.target.value)} className="ml-1 px-2 py-1.5 border border-slate-200 rounded-lg" /></label><label>To <input type="date" value={partyEndDate} onChange={(event) => setPartyEndDate(event.target.value)} className="ml-1 px-2 py-1.5 border border-slate-200 rounded-lg" /></label></div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead><tr className="bg-slate-50/80 border-y border-slate-200/70 text-[11px] font-semibold text-slate-500 uppercase tracking-wider"><th className="py-3 px-4">Date</th>{isAllParties && <th className="py-3 px-4">Party</th>}<th className="py-3 px-4">Transaction</th><th className="py-3 px-4 text-right">Debit</th><th className="py-3 px-4 text-right">Credit</th><th className="py-3 px-4 text-right">Balance</th></tr></thead>
                <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                  {!selectedPartyId || partyLedgerRows.length === 0 ? <tr><td colSpan={isAllParties ? 6 : 5} className="py-12 text-center text-slate-400">{selectedPartyId ? 'No transactions found for the selected period.' : 'Select a party with transactions to view its statement.'}</td></tr> : partyLedgerRows.map((row) => <tr key={`${row.party || ''}-${row.transaction}-${row.reference}-${row.date}`} className="hover:bg-slate-50/60"><td className="py-3 px-4 text-slate-500 whitespace-nowrap">{row.date || 'Date unavailable'}</td>{isAllParties && <td className="py-3 px-4 font-semibold text-slate-900">{row.party}</td>}<td className="py-3 px-4 font-semibold text-slate-900">{row.transaction}</td><td className="py-3 px-4 text-right font-semibold text-blue-700">{row.debit ? formatCurrency(row.debit) : '—'}</td><td className="py-3 px-4 text-right font-semibold text-emerald-700">{row.credit ? formatCurrency(row.credit) : '—'}</td><td className="py-3 px-4 text-right font-bold text-slate-900">{formatCurrency(row.balance)}</td></tr>)}
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-blue-50 border border-blue-100"><div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{partyType === 'customer' ? 'Total Sales' : 'Total Purchases'}</div><div className="text-lg font-bold text-blue-700 mt-1">{formatCurrency(partySummary.debit)}</div></div>
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100"><div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{partyType === 'customer' ? 'Total Received' : 'Total Paid'}</div><div className="text-lg font-bold text-emerald-700 mt-1">{formatCurrency(partySummary.credit)}</div></div>
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-100"><div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{partyType === 'customer' ? 'Outstanding Receivable' : 'Outstanding Payable'}</div><div className="text-lg font-bold text-amber-700 mt-1">{formatCurrency(partySummary.balance)}</div></div>
            </div>
          </div>
        ) : activeTab === 'statement' ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
              {[
                ['Total Sales', statementTotals.sales, 'text-blue-700', 'bg-blue-50'],
                ['Sales Collected', statementTotals.salesPaid, 'text-emerald-700', 'bg-emerald-50'],
                ['Sales Outstanding', statementTotals.sales - statementTotals.salesPaid, 'text-amber-700', 'bg-amber-50'],
                ['Total Purchases', statementTotals.purchases, 'text-indigo-700', 'bg-indigo-50'],
                ['Purchase Paid', statementTotals.purchasesPaid, 'text-emerald-700', 'bg-emerald-50'],
                ['Purchase Outstanding', statementTotals.purchases - statementTotals.purchasesPaid, 'text-rose-700', 'bg-rose-50'],
                ['Net Cash Flow', statementTotals.salesPaid - statementTotals.purchasesPaid, statementTotals.salesPaid - statementTotals.purchasesPaid >= 0 ? 'text-emerald-700' : 'text-rose-700', statementTotals.salesPaid - statementTotals.purchasesPaid >= 0 ? 'bg-emerald-50' : 'bg-rose-50']
              ].map(([label, amount, textColor, background]) => (
                <div key={String(label)} className={`p-3 rounded-xl ${background} border border-slate-100`}>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</div>
                  <div className={`mt-1 text-sm font-bold ${textColor}`}>{formatCurrency(Number(amount))}</div>
                </div>
              ))}
            </div>

            <div className="flex flex-col xl:flex-row gap-3 xl:items-center xl:justify-between">
              <div className="flex flex-wrap items-center gap-1.5">
                {(['all', 'sales', 'purchases'] as StatementFilter[]).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setStatementFilter(filter)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors ${statementFilter === filter ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={statementSearch}
                    onChange={(event) => setStatementSearch(event.target.value)}
                    placeholder="Search ID, customer or supplier"
                    className="w-full sm:w-64 pl-9 pr-3 py-2 bg-slate-50 text-xs rounded-lg border border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <select
                  value={dateFilter}
                  onChange={(event) => setDateFilter(event.target.value as DateFilter)}
                  className="px-3 py-2 bg-slate-50 text-xs rounded-lg border border-slate-200 text-slate-700"
                >
                  <option value="all">All Dates</option>
                  <option value="today">Today</option>
                  <option value="week">This Week</option>
                  <option value="month">This Month</option>
                  <option value="custom">Custom Date Range</option>
                </select>
                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50"
                  title={t('Print statement')}
                >
                  <Printer className="w-3.5 h-3.5" /> {t('Print')}
                </button>
                <button
                  onClick={loadFinanceData}
                  className="inline-flex items-center justify-center p-2 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50"
                  title="Refresh statement"
                  aria-label="Refresh statement"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {dateFilter === 'custom' && (
              <div className="flex flex-col sm:flex-row gap-2 sm:items-center text-xs">
                <CalendarDays className="w-4 h-4 text-slate-400" />
                <label className="text-slate-500">From <input type="date" value={customStartDate} onChange={(event) => setCustomStartDate(event.target.value)} className="ml-1 px-2 py-1.5 border border-slate-200 rounded-lg" /></label>
                <label className="text-slate-500">To <input type="date" value={customEndDate} onChange={(event) => setCustomEndDate(event.target.value)} className="ml-1 px-2 py-1.5 border border-slate-200 rounded-lg" /></label>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-y border-slate-200/70 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">ID</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Customer / Supplier</th>
                    <th className="py-3 px-4 text-right">Total</th>
                    <th className="py-3 px-4 text-right">Paid</th>
                    <th className="py-3 px-4 text-right">Outstanding</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                  {filteredStatementRows.length === 0 ? (
                    <tr><td colSpan={8} className="py-12 text-center text-slate-400">No sales or purchases match the selected filters.</td></tr>
                  ) : filteredStatementRows.map((row) => (
                    <tr key={`${row.type}-${row.id}`} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4"><span className={`inline-flex px-2 py-1 rounded-md text-[10px] font-bold ${row.type === 'SALE' ? 'bg-blue-50 text-blue-700' : 'bg-indigo-50 text-indigo-700'}`}>{row.type}</span></td>
                      <td className="py-3 px-4 font-semibold"><Link to={row.detailsPath} className="text-blue-600 hover:underline">{row.id}</Link></td>
                      <td className="py-3 px-4 text-slate-500 whitespace-nowrap">{row.date}</td>
                      <td className="py-3 px-4 font-semibold text-slate-900">{row.party}</td>
                      <td className="py-3 px-4 text-right font-semibold text-slate-900 whitespace-nowrap">{formatCurrency(row.total)}</td>
                      <td className="py-3 px-4 text-right font-semibold text-emerald-700 whitespace-nowrap">{formatCurrency(row.paid)}</td>
                      <td className="py-3 px-4 text-right font-semibold text-rose-600 whitespace-nowrap">{formatCurrency(row.outstanding)}</td>
                      <td className="py-3 px-4"><Badge status={row.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : activeTab === 'collections' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-y border-slate-200/70 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Customer Name</th>
                  <th className="py-3 px-4">Amount Received</th>
                  <th className="py-3 px-4">Payment Method</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Reference Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                {payments.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400">
                      No customer payment records found.
                    </td>
                  </tr>
                ) : (
                  payments.map((pymt) => (
                    <tr key={pymt.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 font-medium text-slate-900">{pymt.customerName}</td>
                      <td className="py-3 px-4 font-semibold text-emerald-700">
                        ₹{pymt.amount.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 capitalize text-slate-600">{pymt.paymentMethod.replace('_', ' ')}</td>
                      <td className="py-3 px-4 text-slate-500">{pymt.paymentDate}</td>
                      <td className="py-3 px-4 text-slate-500">{pymt.notes || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-y border-slate-200/70 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Voucher ID</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Expense Description</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Payment Method</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                {expenses.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      No expense vouchers recorded yet.
                    </td>
                  </tr>
                ) : (
                  expenses.map((exp) => (
                    <tr key={exp.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 font-mono font-semibold text-rose-600">{exp.id}</td>
                      <td className="py-3 px-4 capitalize text-slate-700 font-medium">{exp.category.replace('_', ' ')}</td>
                      <td className="py-3 px-4 text-slate-800">{exp.description}</td>
                      <td className="py-3 px-4 font-semibold text-slate-900">₹{exp.amount.toLocaleString()}</td>
                      <td className="py-3 px-4 capitalize text-slate-600">{exp.paymentMethod.replace('_', ' ')}</td>
                      <td className="py-3 px-4 text-slate-500">{exp.expenseDate}</td>
                      <td className="py-3 px-4">
                        <Badge status={exp.status} />
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => setExpenseToDelete(exp)}
                          title="Delete expense record"
                          className="inline-flex items-center justify-center p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                          aria-label={`Delete expense ${exp.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {expenseToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-xl max-w-md w-full p-5 shadow-lg border border-slate-200 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-rose-50 text-rose-600 rounded-lg shrink-0 border border-rose-100">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Delete Expense Record</h3>
                <p className="text-xs text-slate-600 mt-1">
                  Are you sure you want to delete this expense?
                </p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/70 text-xs space-y-1.5">
              <div className="flex justify-between text-slate-600">
                <span className="font-medium">Voucher ID:</span>
                <span className="font-mono font-semibold text-rose-600">{expenseToDelete.id}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span className="font-medium">Description:</span>
                <span className="text-slate-900 truncate max-w-[210px]">{expenseToDelete.description}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span className="font-medium">Amount:</span>
                <span className="font-semibold text-slate-900">₹{expenseToDelete.amount.toLocaleString()}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setExpenseToDelete(null)}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors border border-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteConfirm}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 transition-colors shadow-2xs flex items-center gap-1.5 disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>Delete Expense</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Printable Company Day-to-Day Ledger */}
      <div id="angel-print-ledger" className="hidden">
        <div className="p-8 text-slate-900 bg-white font-sans">
          {/* Header with Company details */}
          <div className="flex items-start justify-between border-b-2 border-slate-900 pb-4 mb-4">
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900 uppercase">
                {settings?.companyName || 'ANGEL PET'}
              </h1>
              <p className="text-xs text-slate-600 mt-1 max-w-md">{settings?.address || 'Registered Office / Factory Address'}</p>
              <p className="text-xs text-slate-600 mt-0.5">
                {settings?.phone ? `Phone: ${settings.phone} ` : ''}
                {settings?.email ? `| Email: ${settings.email}` : ''}
              </p>
              {settings?.gstin && <p className="text-xs font-semibold text-slate-700 mt-0.5">GSTIN: {settings.gstin}</p>}
            </div>
            <div className="text-right">
              <div className="inline-block px-3 py-1 bg-slate-900 text-white text-xs font-bold uppercase tracking-wider rounded">
                Company Day-to-Day Ledger
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Generated: {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
              </p>
              <p className="text-xs font-medium text-slate-700 mt-0.5">
                {dayLedgerDateFilter === 'today'
                  ? `Date: ${today}`
                  : dayLedgerDateFilter === 'custom' && (dayLedgerStartDate || dayLedgerEndDate)
                  ? `Period: ${dayLedgerStartDate || 'Start'} to ${dayLedgerEndDate || 'End'}`
                  : dayLedgerDateFilter === 'month'
                  ? `Period: This Month`
                  : dayLedgerDateFilter === 'week'
                  ? `Period: This Week`
                  : 'Period: All Recorded Transactions'}
              </p>
            </div>
          </div>

          {/* Filter indicators if any */}
          {(dayLedgerTypeFilter !== 'all' || dayLedgerPartyFilter !== 'all') && (
            <div className="mb-4 p-2 bg-slate-100 rounded text-xs flex gap-4 text-slate-700 font-medium">
              {dayLedgerTypeFilter !== 'all' && (
                <div>
                  <strong>Type Filter:</strong> {dayLedgerTypeFilter}
                </div>
              )}
              {dayLedgerPartyFilter !== 'all' && (
                <div>
                  <strong>Party Filter:</strong> {dayLedgerPartyFilter}
                </div>
              )}
            </div>
          )}

          {/* Ledger Table */}
          <table className="w-full text-left border-collapse mb-6 text-xs">
            <thead>
              <tr className="bg-slate-100 border-y border-slate-300 text-[11px] font-bold text-slate-800 uppercase">
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Description</th>
                <th className="py-2.5 px-3">Party</th>
                <th className="py-2.5 px-3">Transaction Type</th>
                <th className="py-2.5 px-3 text-right">Debit (₹)</th>
                <th className="py-2.5 px-3 text-right">Credit (₹)</th>
                <th className="py-2.5 px-3 text-right">Balance (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredDayLedgerRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No ledger transactions recorded in this period.
                  </td>
                </tr>
              ) : (
                filteredDayLedgerRows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100">
                    <td className="py-2 px-3 whitespace-nowrap text-slate-700">{row.date || '—'}</td>
                    <td className="py-2 px-3 font-medium text-slate-900">{row.description}</td>
                    <td className="py-2 px-3 text-slate-800">{row.party}</td>
                    <td className="py-2 px-3 font-semibold text-slate-700">{row.transactionType}</td>
                    <td className="py-2 px-3 text-right font-semibold text-slate-900">
                      {row.debit > 0 ? formatCurrency(row.debit) : '—'}
                    </td>
                    <td className="py-2 px-3 text-right font-semibold text-slate-900">
                      {row.credit > 0 ? formatCurrency(row.credit) : '—'}
                    </td>
                    <td className="py-2 px-3 text-right font-bold text-slate-900">
                      {formatCurrency(row.balance)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100 border-t-2 border-slate-900 font-bold text-slate-900">
                <td colSpan={4} className="py-3 px-3 uppercase tracking-wider text-right">Total:</td>
                <td className="py-3 px-3 text-right text-blue-900">{formatCurrency(dayLedgerTotalDebit)}</td>
                <td className="py-3 px-3 text-right text-emerald-900">{formatCurrency(dayLedgerTotalCredit)}</td>
                <td className="py-3 px-3 text-right text-slate-900">{formatCurrency(dayLedgerClosingBalance)}</td>
              </tr>
            </tfoot>
          </table>

          {/* Summary Block */}
          <div className="grid grid-cols-3 gap-4 border border-slate-300 p-4 rounded mb-8 text-xs bg-slate-50">
            <div>
              <span className="text-slate-500 font-medium block">Total Debit:</span>
              <span className="text-base font-bold text-slate-900">{formatCurrency(dayLedgerTotalDebit)}</span>
            </div>
            <div>
              <span className="text-slate-500 font-medium block">Total Credit:</span>
              <span className="text-base font-bold text-slate-900">{formatCurrency(dayLedgerTotalCredit)}</span>
            </div>
            <div>
              <span className="text-slate-500 font-medium block">Closing Balance:</span>
              <span className="text-base font-bold text-slate-900">{formatCurrency(dayLedgerClosingBalance)}</span>
            </div>
          </div>

          {/* Signatures */}
          <div className="flex justify-between items-end pt-12 text-xs text-slate-600">
            <div>
              <p className="border-t border-slate-400 pt-1 w-48 text-center">Prepared By</p>
            </div>
            <div>
              <p className="border-t border-slate-400 pt-1 w-48 text-center font-semibold text-slate-800">
                Authorized Signatory
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

