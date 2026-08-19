import React, { useState, useEffect } from 'react';
import { Order, Product, Customer, Expense, Payment } from '../types';
import { getOrders, getProducts, getCustomers, getExpenses, getPayments } from '../services/db';
import { StatCard } from '../components/common/StatCard';
import {
  IndianRupee,
  TrendingUp,
  BarChart3,
  PieChart as PieChartIcon,
  ShoppingBag,
  Award
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';

export const Analytics: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [period, setPeriod] = useState('This Year');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalyticsData();
  }, []);

  const loadAnalyticsData = async () => {
    setLoading(true);
    try {
      const [ordList, prdList, cusList, expList, pymtList] = await Promise.all([
        getOrders(),
        getProducts(),
        getCustomers(),
        getExpenses(),
        getPayments()
      ]);
      setOrders(ordList);
      setProducts(prdList);
      setCustomers(cusList);
      setExpenses(expList);
      setPayments(pymtList);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Metrics calculations
  const totalRevenue = orders.reduce((sum, o) => sum + o.totalAmount, 0);
  const totalCollections = payments.reduce((sum, p) => sum + p.amount, 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const avgOrderValue = orders.length > 0 ? totalRevenue / orders.length : 0;

  // Chart 1: Top Customers Bar Chart
  const topCustomerData = [...customers]
    .sort((a, b) => b.totalSpent - a.totalSpent)
    .slice(0, 5)
    .map((c) => ({
      name: c.company.length > 12 ? `${c.company.substring(0, 12)}...` : c.company,
      Revenue: c.totalSpent
    }));

  // Chart 2: Revenue Mix Donut Chart
  const COLORS = ['#2563eb', '#38bdf8', '#a855f7', '#f59e0b', '#10b981', '#ec4899'];
  const revenueMixData = [
    { name: '5L Bottle', value: 350000 },
    { name: '1L Bottle', value: 280000 },
    { name: '500ml Bottle', value: 210000 },
    { name: 'Custom PET Bottle', value: 195000 },
    { name: '28mm Flip Cap', value: 140000 },
    { name: 'Child Resistant Cap', value: 95000 }
  ];

  // Chart 3: Monthly Trend
  const monthlyTrend = [
    { month: 'Jan', Sales: 180000, Expenses: 140000 },
    { month: 'Feb', Sales: 220000, Expenses: 160000 },
    { month: 'Mar', Sales: 290000, Expenses: 190000 },
    { month: 'Apr', Sales: 310000, Expenses: 210000 },
    { month: 'May', Sales: 420000, Expenses: 280000 },
    { month: 'Jun', Sales: 390000, Expenses: 250000 },
    { month: 'Jul', Sales: 480000, Expenses: 310000 },
    { month: 'Aug', Sales: totalRevenue > 0 ? totalRevenue : 510000, Expenses: totalExpenses }
  ];

  return (
    <div className="space-y-6">
      {/* Title Bar & Period Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Business Analytics</h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Who buys the most, what sells the most and revenue distribution
          </p>
        </div>

        {/* Period Selector Tabs */}
        <div className="flex items-center space-x-1 bg-white p-1 rounded-2xl border border-slate-200 shadow-sm self-start sm:self-auto">
          {['Today', 'This Week', 'This Month', 'This Quarter', 'This Year'].map((t) => (
            <button
              key={t}
              onClick={() => setPeriod(t)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all ${
                period === t
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Revenue"
          value={`₹${(totalRevenue / 100000).toFixed(2)}L`}
          icon={IndianRupee}
          change="+9.2%"
          changeType="positive"
          subtitle="Gross sales booked"
          iconBgColor="bg-blue-50"
          iconTextColor="text-blue-600"
        />
        <StatCard
          title="Collections"
          value={`₹${(totalCollections / 100000).toFixed(2)}L`}
          icon={TrendingUp}
          change="+4.8%"
          changeType="positive"
          subtitle="Total cash collected"
          iconBgColor="bg-emerald-50"
          iconTextColor="text-emerald-600"
        />
        <StatCard
          title="Expenses"
          value={`₹${(totalExpenses / 100000).toFixed(2)}L`}
          icon={ShoppingBag}
          change="-2.1%"
          changeType="positive"
          subtitle="Raw material & overheads"
          iconBgColor="bg-rose-50"
          iconTextColor="text-rose-600"
        />
        <StatCard
          title="Average Order Value"
          value={`₹${avgOrderValue.toFixed(0).toLocaleString()}`}
          icon={Award}
          change="AOV"
          changeType="neutral"
          subtitle="Per sales order"
          iconBgColor="bg-purple-50"
          iconTextColor="text-purple-600"
        />
      </div>

      {/* Charts Grid Row 1: Top Clients & Revenue Mix */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Clients Bar Chart */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Top Customers by Revenue</h2>
              <p className="text-xs text-slate-500">Highest grossing customer accounts</p>
            </div>
            <BarChart3 className="w-5 h-5 text-blue-600" />
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topCustomerData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(val: any) => [`₹${Number(val).toLocaleString()}`, 'Total Spent']}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                />
                <Bar dataKey="Revenue" fill="#2563eb" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Revenue Mix Donut Chart */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Revenue Mix by Product</h2>
              <p className="text-xs text-slate-500">Sales breakdown by bottle and cap specifications</p>
            </div>
            <PieChartIcon className="w-5 h-5 text-purple-600" />
          </div>

          <div className="h-72 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={revenueMixData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {revenueMixData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(val: any) => `₹${Number(val).toLocaleString()}`} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Monthly Sales vs Expenses Trend */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">Monthly Revenue vs Expense Trend</h2>
          <p className="text-xs text-slate-500">Tracking monthly profitability & cost margins</p>
        </div>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: '#64748b' }}
                tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip formatter={(val: any) => `₹${Number(val).toLocaleString()}`} />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
              <Bar dataKey="Sales" fill="#2563eb" radius={[6, 6, 0, 0]} />
              <Bar dataKey="Expenses" fill="#f43f5e" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
