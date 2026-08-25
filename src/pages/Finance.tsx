import React, { useState, useEffect } from 'react';
import { Order, Payment, Expense } from '../types';
import { getOrders, getPayments, getExpenses, deleteExpense } from '../services/db';
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
  Loader2
} from 'lucide-react';

interface FinanceProps {
  onOpenRecordPaymentModal: () => void;
  onOpenAddExpenseModal: () => void;
}

export const Finance: React.FC<FinanceProps> = ({
  onOpenRecordPaymentModal,
  onOpenAddExpenseModal
}) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [activeTab, setActiveTab] = useState<'collections' | 'expenses'>('collections');
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
      const [ordList, pymtList, expList] = await Promise.all([
        getOrders(),
        getPayments(),
        getExpenses()
      ]);
      setOrders(ordList);
      setPayments(pymtList);
      setExpenses(expList);
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

  const totalSales = orders.reduce((sum, o) => sum + o.totalAmount, 0);
  const totalCollections = payments.reduce((sum, p) => sum + p.amount, 0);
  const pendingCollections = Math.max(0, totalSales - totalCollections);
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const netBalance = totalCollections - totalExpenses;

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
          <div className="inline-flex p-1 bg-slate-100/80 rounded-lg border border-slate-200/60 gap-1 text-xs">
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

        {activeTab === 'collections' ? (
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

