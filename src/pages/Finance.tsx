import React, { useState, useEffect } from 'react';
import { Order, Payment, Expense } from '../types';
import { getOrders, getPayments, getExpenses } from '../services/db';
import { StatCard } from '../components/common/StatCard';
import { Badge } from '../components/common/Badge';
import {
  IndianRupee,
  TrendingUp,
  CreditCard,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  Receipt,
  FileSpreadsheet
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
      console.error(e);
    } finally {
      setLoading(false);
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Finance & Accounting</h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Cash flows, customer collections, outstanding balances, and factory expenses
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onOpenAddExpenseModal}
            className="px-3.5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl transition-colors flex items-center space-x-1.5"
          >
            <Plus className="w-4 h-4 text-rose-400" />
            <span>Add Expense</span>
          </button>
          <button
            onClick={onOpenRecordPaymentModal}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-md shadow-emerald-500/20 transition-colors flex items-center space-x-2"
          >
            <IndianRupee className="w-4 h-4" />
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
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-4">
        <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
          <button
            onClick={() => setActiveTab('collections')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
              activeTab === 'collections'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20'
                : 'text-slate-500 hover:bg-slate-100'
            }`}
          >
            Customer Payment Receipts ({payments.length})
          </button>
          <button
            onClick={() => setActiveTab('expenses')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
              activeTab === 'expenses'
                ? 'bg-rose-600 text-white shadow-md shadow-rose-500/20'
                : 'text-slate-500 hover:bg-slate-100'
            }`}
          >
            Expense Vouchers ({expenses.length})
          </button>
        </div>

        {activeTab === 'collections' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Receipt No</th>
                  <th className="py-3.5 px-4">Order ID</th>
                  <th className="py-3.5 px-4">Customer Name</th>
                  <th className="py-3.5 px-4">Amount Received</th>
                  <th className="py-3.5 px-4">Payment Method</th>
                  <th className="py-3.5 px-4">Date</th>
                  <th className="py-3.5 px-4">Reference Notes</th>
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
                    <tr key={pymt.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-emerald-600">{pymt.receiptNumber}</td>
                      <td className="py-3.5 px-4 font-bold text-blue-600">{pymt.orderNumber}</td>
                      <td className="py-3.5 px-4 font-bold text-slate-900">{pymt.customerName}</td>
                      <td className="py-3.5 px-4 font-bold text-emerald-600">
                        ₹{pymt.amount.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 capitalize text-slate-600">{pymt.paymentMethod.replace('_', ' ')}</td>
                      <td className="py-3.5 px-4 text-slate-500">{pymt.paymentDate}</td>
                      <td className="py-3.5 px-4 text-slate-500">{pymt.notes || '—'}</td>
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
                <tr className="bg-slate-50/50 border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Voucher ID</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4">Expense Description</th>
                  <th className="py-3.5 px-4">Amount</th>
                  <th className="py-3.5 px-4">Payment Method</th>
                  <th className="py-3.5 px-4">Date</th>
                  <th className="py-3.5 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                {expenses.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      No expense vouchers recorded yet.
                    </td>
                  </tr>
                ) : (
                  expenses.map((exp) => (
                    <tr key={exp.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-rose-600">{exp.id}</td>
                      <td className="py-3.5 px-4 capitalize text-slate-700 font-semibold">{exp.category.replace('_', ' ')}</td>
                      <td className="py-3.5 px-4 text-slate-800">{exp.description}</td>
                      <td className="py-3.5 px-4 font-bold text-rose-600">₹{exp.amount.toLocaleString()}</td>
                      <td className="py-3.5 px-4 capitalize text-slate-600">{exp.paymentMethod.replace('_', ' ')}</td>
                      <td className="py-3.5 px-4 text-slate-500">{exp.expenseDate}</td>
                      <td className="py-3.5 px-4">
                        <Badge status={exp.status} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
