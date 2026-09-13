import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Order, Payment, Expense, PurchaseOrder, Customer } from '../types';
import { getOrders, getPayments, getExpenses, getPurchases, getCustomers, deleteExpense } from '../services/db';
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
  RefreshCw
} from 'lucide-react';

interface FinanceProps {
  onOpenRecordPaymentModal: () => void;
  onOpenAddExpenseModal: () => void;
}

type StatementFilter = 'all' | 'sales' | 'purchases';
type DateFilter = 'all' | 'today' | 'week' | 'month' | 'custom';
type PartyType = 'customer' | 'supplier';

interface PartyLedgerRow {
  date: string;
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

const formatCurrency = (value: number) => `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const toDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const Finance: React.FC<FinanceProps> = ({
  onOpenRecordPaymentModal,
  onOpenAddExpenseModal
}) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [purchases, setPurchases] = useState<PurchaseOrder[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [activeTab, setActiveTab] = useState<'statement' | 'party' | 'collections' | 'expenses'>('party');
  const [partyType, setPartyType] = useState<PartyType>('customer');
  const [selectedPartyId, setSelectedPartyId] = useState('');
  const [partySearch, setPartySearch] = useState('');
  const [partyDateFilter, setPartyDateFilter] = useState<'all' | 'today' | 'month' | 'custom'>('all');
  const [partyStartDate, setPartyStartDate] = useState('');
  const [partyEndDate, setPartyEndDate] = useState('');
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
      const [ordList, pymtList, expList, purchaseList, customerList] = await Promise.all([
        getOrders(),
        getPayments(),
        getExpenses(),
        getPurchases(),
        getCustomers()
      ]);
      setOrders(ordList);
      setPayments(pymtList);
      setExpenses(expList);
      setPurchases(purchaseList);
      setCustomers(customerList);
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

  const activeOrders = orders.filter((order) => order.orderStatus !== 'cancelled');
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

  const statementRows: StatementRow[] = [
    ...orders
      .filter((order) => order.orderStatus !== 'cancelled')
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

  const today = toDateKey(new Date());
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const weekStartKey = toDateKey(weekStart);
  const monthStart = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`;
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
    ? customers
        .filter((customer) => {
          const query = partySearch.trim().toLowerCase();
          return !query || customer.company.toLowerCase().includes(query) || customer.name.toLowerCase().includes(query) || customer.phone.toLowerCase().includes(query);
        })
        .map((customer) => ({ id: customer.id, name: customer.company || customer.name, contact: customer.name, phone: customer.phone }))
    : Array.from(new Set(purchases.map((purchase) => purchase.supplierName).filter(Boolean)))
        .filter((supplier) => supplier.toLowerCase().includes(partySearch.trim().toLowerCase()))
        .map((supplier) => ({ id: supplier, name: supplier, contact: '', phone: '' }));

  const selectedCustomer = partyType === 'customer' ? customers.find((customer) => customer.id === selectedPartyId) : undefined;
  const selectedSupplier = partyType === 'supplier' ? selectedPartyId : '';
  const partyLedgerBase: Array<Omit<PartyLedgerRow, 'balance'>> = [];

  if (partyType === 'customer' && selectedCustomer) {
    const customerOrders = orders.filter((order) =>
      order.orderStatus !== 'cancelled' &&
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
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Finance & Accounting</h1>
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
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="inline-flex flex-wrap p-1 bg-slate-100/80 rounded-lg border border-slate-200/60 gap-1 text-xs">
            <button
              onClick={() => setActiveTab('party')}
              className={`px-3.5 py-1.5 font-semibold rounded-md transition-all ${
                activeTab === 'party'
                  ? 'bg-white text-slate-900 shadow-2xs border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Party-wise Statement
            </button>
            <button
              onClick={() => setActiveTab('statement')}
              className={`px-3.5 py-1.5 font-semibold rounded-md transition-all ${
                activeTab === 'statement'
                  ? 'bg-white text-slate-900 shadow-2xs border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sales &amp; Purchase Statement
            </button>
            <button
              onClick={() => setActiveTab('collections')}
              className={`px-3.5 py-1.5 font-semibold rounded-md transition-all ${
                activeTab === 'collections'
                  ? 'bg-white text-slate-900 shadow-2xs border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Customer Payment Receipts ({payments.length})
            </button>
            <button
              onClick={() => setActiveTab('expenses')}
              className={`px-3.5 py-1.5 font-semibold rounded-md transition-all ${
                activeTab === 'expenses'
                  ? 'bg-white text-slate-900 shadow-2xs border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Expense Vouchers ({expenses.length})
            </button>
          </div>
        </div>

        {activeTab === 'party' ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Party Type</div>
                <select value={partyType} onChange={(event) => { const nextType = event.target.value as PartyType; const firstSupplier = purchases.find((purchase) => purchase.supplierName)?.supplierName || ''; setPartyType(nextType); setSelectedPartyId(nextType === 'customer' ? customers[0]?.id || '' : firstSupplier); }} className="mt-2 w-full px-3 py-2 bg-white text-xs font-semibold rounded-lg border border-slate-200">
                  <option value="customer">Customer</option>
                  <option value="supplier">Supplier</option>
                </select>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 sm:col-span-2 lg:col-span-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Party</div>
                  <div className="relative w-48">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input value={partySearch} onChange={(event) => setPartySearch(event.target.value)} placeholder="Search party" className="w-full pl-8 pr-2 py-1.5 text-xs bg-white rounded-lg border border-slate-200" />
                  </div>
                </div>
                <select value={selectedPartyId} onChange={(event) => setSelectedPartyId(event.target.value)} className="mt-2 w-full px-3 py-2 bg-white text-xs font-semibold rounded-lg border border-slate-200">
                  <option value="">Select {partyType}</option>
                  {partyOptions.map((party) => <option key={party.id} value={party.id}>{party.name}{party.contact ? ` - ${party.contact}` : ''}</option>)}
                </select>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Date Range</div>
                <select value={partyDateFilter} onChange={(event) => setPartyDateFilter(event.target.value as typeof partyDateFilter)} className="mt-2 w-full px-3 py-2 bg-white text-xs font-semibold rounded-lg border border-slate-200">
                  <option value="all">All Dates</option>
                  <option value="today">Today</option>
                  <option value="month">This Month</option>
                  <option value="custom">Custom Range</option>
                </select>
              </div>
            </div>

            {selectedPartyId && (
              <div className="p-4 rounded-xl border border-slate-200 bg-white flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Party Details</div>
                  <div className="text-base font-bold text-slate-900 mt-1">{partyType === 'customer' ? selectedCustomer?.company || selectedCustomer?.name : selectedSupplier}</div>
                  <div className="text-xs text-slate-500 mt-1">{partyType === 'customer' ? `${selectedCustomer?.name || ''}${selectedCustomer?.phone ? ` · ${selectedCustomer.phone}` : ''}` : 'Supplier'} · {partyType === 'customer' ? 'Customer' : 'Supplier'}</div>
                </div>
                <button onClick={() => window.print()} className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800"><Printer className="w-3.5 h-3.5" /> Print Statement</button>
              </div>
            )}

            {partyDateFilter === 'custom' && (
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500"><CalendarDays className="w-4 h-4" /><label>From <input type="date" value={partyStartDate} onChange={(event) => setPartyStartDate(event.target.value)} className="ml-1 px-2 py-1.5 border border-slate-200 rounded-lg" /></label><label>To <input type="date" value={partyEndDate} onChange={(event) => setPartyEndDate(event.target.value)} className="ml-1 px-2 py-1.5 border border-slate-200 rounded-lg" /></label></div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-blue-50 border border-blue-100"><div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{partyType === 'customer' ? 'Total Sales' : 'Total Purchases'}</div><div className="text-lg font-bold text-blue-700 mt-1">{formatCurrency(partySummary.debit)}</div></div>
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100"><div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{partyType === 'customer' ? 'Total Received' : 'Total Paid'}</div><div className="text-lg font-bold text-emerald-700 mt-1">{formatCurrency(partySummary.credit)}</div></div>
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-100"><div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{partyType === 'customer' ? 'Outstanding Receivable' : 'Outstanding Payable'}</div><div className="text-lg font-bold text-amber-700 mt-1">{formatCurrency(partySummary.balance)}</div></div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead><tr className="bg-slate-50/80 border-y border-slate-200/70 text-[11px] font-semibold text-slate-500 uppercase tracking-wider"><th className="py-3 px-4">Date</th><th className="py-3 px-4">Transaction</th><th className="py-3 px-4">Reference</th><th className="py-3 px-4 text-right">Debit</th><th className="py-3 px-4 text-right">Credit</th><th className="py-3 px-4 text-right">Balance</th></tr></thead>
                <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                  {!selectedPartyId || partyLedgerRows.length === 0 ? <tr><td colSpan={6} className="py-12 text-center text-slate-400">Select a party with transactions to view its statement.</td></tr> : partyLedgerRows.map((row) => <tr key={`${row.transaction}-${row.reference}-${row.date}`} className="hover:bg-slate-50/60"><td className="py-3 px-4 text-slate-500 whitespace-nowrap">{row.date || 'Date unavailable'}</td><td className="py-3 px-4 font-semibold text-slate-900">{row.transaction}</td><td className="py-3 px-4">{row.detailsPath ? <Link to={row.detailsPath} className="text-blue-600 hover:underline">{row.reference}</Link> : row.reference}</td><td className="py-3 px-4 text-right font-semibold text-blue-700">{row.debit ? formatCurrency(row.debit) : '—'}</td><td className="py-3 px-4 text-right font-semibold text-emerald-700">{row.credit ? formatCurrency(row.credit) : '—'}</td><td className="py-3 px-4 text-right font-bold text-slate-900">{formatCurrency(row.balance)}</td></tr>)}
                </tbody>
              </table>
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
                  title="Print statement"
                >
                  <Printer className="w-3.5 h-3.5" /> Print
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
                  <th className="py-3 px-4">Receipt No</th>
                  <th className="py-3 px-4">Order ID</th>
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
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      No payment receipts recorded yet.
                    </td>
                  </tr>
                ) : (
                  payments.map((pymt) => (
                    <tr key={pymt.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 font-mono font-semibold text-emerald-600">{pymt.receiptNumber}</td>
                      <td className="py-3 px-4 font-semibold text-blue-600">{pymt.orderNumber}</td>
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
    </div>
  );
};

