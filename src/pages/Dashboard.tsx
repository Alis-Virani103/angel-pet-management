import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { StatCard } from '../components/common/StatCard';
import { Badge } from '../components/common/Badge';
import { Order, Product, Customer } from '../types';
import { getOrders, getProducts, getCustomers, getPayments } from '../services/db';
import {
  IndianRupee,
  ShoppingCart,
  Clock,
  Boxes,
  AlertTriangle,
  Users,
  Plus,
  ArrowRight,
  TrendingUp,
  PackageCheck
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

interface DashboardProps {
  onOpenNewOrderModal: () => void;
  onOpenAddCustomerModal: () => void;
  onOpenRecordPaymentModal: () => void;
  onOpenNewDispatchModal: () => void;
  onOpenAddFinishedGoodsModal: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  onOpenNewOrderModal,
  onOpenAddCustomerModal,
  onOpenRecordPaymentModal,
  onOpenNewDispatchModal,
  onOpenAddFinishedGoodsModal
}) => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [totalCollected, setTotalCollected] = useState(0);
  const [period, setPeriod] = useState('This Year');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [ordList, prdList, cusList, pymtList] = await Promise.all([
        getOrders(),
        getProducts(),
        getCustomers(),
        getPayments()
      ]);
      setOrders(ordList);
      setProducts(prdList);
      setCustomers(cusList);

      const collectedSum = pymtList.reduce((sum, p) => sum + p.amount, 0);
      setTotalCollected(collectedSum);
    } catch (e) {
      console.error('Error loading dashboard:', e);
    } finally {
      setLoading(false);
    }
  };

  // Calculations
  const totalSales = orders.reduce((sum, o) => sum + o.totalAmount, 0);
  const totalOrdersCount = orders.length;
  const pendingOrdersCount = orders.filter((o) => o.orderStatus === 'pending' || o.orderStatus === 'confirmed').length;
  const finishedGoodsUnits = products.reduce((sum, p) => sum + p.currentStock, 0);
  const lowStockItems = products.filter((p) => p.currentStock <= p.minimumStock);
  const outstandingPayments = Math.max(0, totalSales - totalCollected);

  // Sales Trend Chart Data
  const chartData = [
    { month: 'Jan', Sales: 120000 },
    { month: 'Feb', Sales: 185000 },
    { month: 'Mar', Sales: 240000 },
    { month: 'Apr', Sales: 210000 },
    { month: 'May', Sales: 310000 },
    { month: 'Jun', Sales: 290000 },
    { month: 'Jul', Sales: 420000 },
    { month: 'Aug', Sales: totalSales > 0 ? totalSales : 380000 }
  ];

  // Top Customers by total spent
  const sortedCustomers = [...customers].sort((a, b) => b.totalSpent - a.totalSpent).slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Header Banner & Action Buttons */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Good Morning, Admin</h1>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Here's what's happening at Angel Pet packaging plant today.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onOpenNewOrderModal}
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-xs transition-colors shadow-sm shadow-blue-500/20 flex items-center space-x-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Order</span>
          </button>
          <button
            onClick={onOpenAddCustomerModal}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-semibold text-xs transition-colors flex items-center space-x-1.5"
          >
            <Users className="w-3.5 h-3.5" />
            <span>Add Customer</span>
          </button>
          <button
            onClick={onOpenAddFinishedGoodsModal}
            className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-semibold text-xs transition-colors flex items-center space-x-1.5"
          >
            <Boxes className="w-3.5 h-3.5" />
            <span>Add Goods</span>
          </button>
          <button
            onClick={onOpenRecordPaymentModal}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-xs transition-colors flex items-center space-x-1.5"
          >
            <IndianRupee className="w-3.5 h-3.5" />
            <span>Record Payment</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard
          title="Total Sales"
          value={`₹${(totalSales / 100000).toFixed(1)}L`}
          icon={IndianRupee}
          change="+12.4%"
          changeType="positive"
          subtitle="Total revenue booked"
          iconBgColor="bg-blue-50"
          iconTextColor="text-blue-600"
          onClick={() => navigate('/sales')}
        />
        <StatCard
          title="Total Orders"
          value={totalOrdersCount}
          icon={ShoppingCart}
          change="+6.1%"
          changeType="positive"
          subtitle="Orders placed to date"
          iconBgColor="bg-sky-50"
          iconTextColor="text-sky-600"
          onClick={() => navigate('/sales')}
        />
        <StatCard
          title="Pending Orders"
          value={pendingOrdersCount}
          icon={Clock}
          change="Needs Action"
          changeType="neutral"
          subtitle="Awaiting confirmation"
          iconBgColor="bg-amber-50"
          iconTextColor="text-amber-600"
          onClick={() => navigate('/sales')}
        />
        <StatCard
          title="Finished Goods"
          value={finishedGoodsUnits.toLocaleString()}
          icon={Boxes}
          change="Ready to sell"
          changeType="positive"
          subtitle="Units available in stock"
          iconBgColor="bg-purple-50"
          iconTextColor="text-purple-600"
          onClick={() => navigate('/finished-goods')}
        />
        <StatCard
          title="Low Stock Items"
          value={lowStockItems.length}
          icon={AlertTriangle}
          change={lowStockItems.length > 0 ? 'Reorder Needed' : 'Healthy'}
          changeType={lowStockItems.length > 0 ? 'negative' : 'positive'}
          subtitle="Below safety threshold"
          iconBgColor="bg-rose-50"
          iconTextColor="text-rose-600"
          onClick={() => navigate('/finished-goods')}
        />
        <StatCard
          title="Outstanding"
          value={`₹${(outstandingPayments / 100000).toFixed(1)}L`}
          icon={TrendingUp}
          change="To Collect"
          changeType="neutral"
          subtitle="Pending customer balance"
          iconBgColor="bg-emerald-50"
          iconTextColor="text-emerald-600"
          onClick={() => navigate('/finance')}
        />
      </div>

      {/* Main Charts & Inventory Alert Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales Overview Chart (2 Columns) */}
        <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Sales Overview</h2>
              <p className="text-xs text-slate-500">Revenue performance over selected timeframe</p>
            </div>

            {/* Time period filter buttons */}
            <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl">
              {['Today', 'This Week', 'This Month', 'This Quarter', 'This Year'].map((t) => (
                <button
                  key={t}
                  onClick={() => setPeriod(t)}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all ${
                    period === t
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(value: any) => [`₹${Number(value).toLocaleString()}`, 'Sales Revenue']}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                />
                <Area type="monotone" dataKey="Sales" stroke="#2563eb" strokeWidth={3} fill="url(#salesGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Inventory Alerts List (1 Column) */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Inventory Alerts</h2>
              <p className="text-xs text-slate-500">Products at or below minimum stock</p>
            </div>
            <Link to="/finished-goods" className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center">
              View All <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Link>
          </div>

          <div className="divide-y divide-slate-100 flex-1 overflow-y-auto max-h-64">
            {lowStockItems.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400 font-medium">
                <PackageCheck className="w-8 h-8 mx-auto text-emerald-400 mb-2" />
                All product stock levels are healthy!
              </div>
            ) : (
              lowStockItems.map((item) => (
                <div key={item.id} className="py-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-800">{item.name}</p>
                    <p className="text-[11px] text-slate-500">
                      Stock: <span className="font-bold text-rose-600">{item.currentStock.toLocaleString()}</span> / Min: {item.minimumStock.toLocaleString()} {item.unit}
                    </p>
                  </div>
                  <Badge status="low_stock" />
                </div>
              ))
            )}
          </div>

          <button
            onClick={onOpenAddFinishedGoodsModal}
            className="w-full mt-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 transition-colors flex items-center justify-center space-x-1.5"
          >
            <Boxes className="w-3.5 h-3.5 text-purple-600" />
            <span>Restock Finished Goods</span>
          </button>
        </div>
      </div>

      {/* Tables Row: Recent Orders & Top Customers */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Orders (2 Columns) */}
        <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Recent Sales Orders</h2>
              <p className="text-xs text-slate-500">Latest active manufacturing orders</p>
            </div>
            <Link to="/sales" className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center">
              View All Orders <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-3">Order ID</th>
                  <th className="py-3 px-3">Customer</th>
                  <th className="py-3 px-3">Item Spec</th>
                  <th className="py-3 px-3">Qty</th>
                  <th className="py-3 px-3">Amount</th>
                  <th className="py-3 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700 font-medium">
                {orders.slice(0, 5).map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-3">
                      <Link to={`/sales/${order.id}`} className="font-bold text-blue-600 hover:underline">
                        {order.orderNumber}
                      </Link>
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-semibold text-slate-900">{order.companyName}</div>
                      <div className="text-[11px] text-slate-400">{order.customerName}</div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="truncate max-w-[180px]">
                        {order.items.map((i) => i.productName).join(' + ')}
                      </div>
                    </td>
                    <td className="py-3 px-3 font-semibold">
                      {order.items.reduce((sum, i) => sum + i.quantity, 0).toLocaleString()}
                    </td>
                    <td className="py-3 px-3 font-bold text-slate-900">
                      ₹{order.totalAmount.toLocaleString()}
                    </td>
                    <td className="py-3 px-3">
                      <Badge status={order.orderStatus} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top Customers (1 Column) */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">Top Customers</h2>
                <p className="text-xs text-slate-500">Ranked by revenue contribution</p>
              </div>
              <Link to="/customers" className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center">
                All Clients <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Link>
            </div>

            <div className="divide-y divide-slate-100">
              {sortedCustomers.map((cus, idx) => (
                <div
                  key={cus.id}
                  onClick={() => navigate(`/customers/${cus.id}`)}
                  className="py-3 flex items-center justify-between hover:bg-slate-50 px-2 rounded-xl cursor-pointer transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 font-bold text-xs flex items-center justify-center">
                      #{idx + 1}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">{cus.company}</p>
                      <p className="text-[11px] text-slate-400">{cus.totalOrders} orders placed</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-slate-900">₹{(cus.totalSpent / 100000).toFixed(2)}L</p>
                    <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium">
                      Tier {cus.priceCategory}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={onOpenNewOrderModal}
            className="w-full mt-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-colors shadow-sm shadow-blue-500/20 flex items-center justify-center space-x-1.5"
          >
            <ShoppingCart className="w-4 h-4" />
            <span>Create Sales Order</span>
          </button>
        </div>
      </div>
    </div>
  );
};
