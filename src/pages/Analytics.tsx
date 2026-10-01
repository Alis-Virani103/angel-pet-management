import React, { useState, useEffect, useMemo } from 'react';
import { Order, Product, Customer, Expense, Payment, OrderItem } from '../types';
import { getOrders, getProducts, getCustomers, getExpenses, getPayments } from '../services/db';
import { StatCard } from '../components/common/StatCard';
import {
  IndianRupee,
  TrendingUp,
  BarChart3,
  PieChart as PieChartIcon,
  ShoppingBag,
  Award,
  Search,
  Users,
  Package,
  X
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
  Legend,
  LineChart,
  Line
} from 'recharts';

interface ClientAnalytics extends Customer {
  totalOrders: number;
  totalRevenue: number;
  totalQuantity: number;
  totalPaid: number;
  outstanding: number;
  avgOrderValue: number;
  lastOrderDate: string;
}

interface ProductAnalyticsData {
  product: Product;
  totalQuantity: number;
  totalRevenue: number;
  orderCount: number;
  lastSaleDate: string;
  avgSellingPrice: number;
}

export const Analytics: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [period, setPeriod] = useState('This Year');
  const [loading, setLoading] = useState(true);
  const [selectedCustomer, setSelectedCustomer] = useState<ClientAnalytics | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [productSearch, setProductSearch] = useState('');

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

  // Date filtering function
  const filterByPeriod = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const startOfQuarter = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
    
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    switch (period) {
      case 'Today':
        return date >= today && date < new Date(today.getTime() + 24 * 60 * 60 * 1000);
      case 'This Week':
        return date >= startOfWeek && date < new Date(startOfWeek.getTime() + 7 * 24 * 60 * 60 * 1000);
      case 'This Month':
        return date >= startOfMonth && date < new Date(startOfMonth.getFullYear(), startOfMonth.getMonth() + 1, 1);
      case 'This Quarter':
        return date >= startOfQuarter && date < new Date(startOfQuarter.getFullYear(), startOfQuarter.getMonth() + 3, 1);
      case 'This Year':
        return date >= startOfYear && date < new Date(startOfYear.getFullYear() + 1, 0, 1);
      default:
        return true;
    }
  };

  // Filter data based on selected period (AS Orders excluded from commercial financial & sales analytics)
  const filteredOrders = useMemo(() => {
    return orders.filter(order => order.orderType !== 'AS' && filterByPeriod(order.orderDate));
  }, [orders, period]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter(expense => filterByPeriod(expense.expenseDate));
  }, [expenses, period]);

  const filteredPayments = useMemo(() => {
    return payments.filter(payment => filterByPeriod(payment.paymentDate));
  }, [payments, period]);

  // Metrics calculations (using filtered data)
  const totalRevenue = filteredOrders.reduce((sum, o) => sum + o.totalAmount, 0);
  const totalCollections = filteredPayments.reduce((sum, p) => sum + p.amount, 0);
  const totalExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  const avgOrderValue = filteredOrders.length > 0 ? totalRevenue / filteredOrders.length : 0;

  // Client-wise analytics
  const clientAnalytics: ClientAnalytics[] = useMemo(() => {
    return customers.map(customer => {
      const customerOrders = filteredOrders.filter(o => o.customerId === customer.id);
      const customerPayments = filteredPayments.filter(p => {
        // Find orders for this customer
        const customerOrderIds = customerOrders.map(o => o.id);
        return customerOrderIds.includes(p.orderId);
      });
      
      const totalRevenue = customerOrders.reduce((sum, o) => sum + o.totalAmount, 0);
      const totalPaid = customerPayments.reduce((sum, p) => sum + p.amount, 0);
      const outstanding = totalRevenue - totalPaid;
      const totalQuantity = customerOrders.reduce((sum, o) => sum + (o.totalQuantity || 0), 0);
      const avgOrderValue = customerOrders.length > 0 ? totalRevenue / customerOrders.length : 0;
      const lastOrderDate = customerOrders.length > 0 
        ? customerOrders.sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime())[0].orderDate
        : 'N/A';

      return {
        ...customer,
        totalOrders: customerOrders.length,
        totalRevenue,
        totalQuantity,
        totalPaid,
        outstanding,
        avgOrderValue,
        lastOrderDate
      };
    }).sort((a, b) => b.totalRevenue - a.totalRevenue);
  }, [customers, filteredOrders, filteredPayments]);

  // Product-wise analytics
  const productAnalytics = useMemo(() => {
    const productMap = new Map<string, {
      product: Product;
      totalQuantity: number;
      totalRevenue: number;
      orderCount: number;
      lastSaleDate: string;
    }>();

    filteredOrders.forEach(order => {
      order.items.forEach(item => {
        const existing = productMap.get(item.productId);
        const itemRevenue = item.subtotal;
        const itemQuantity = item.quantity;
        const itemDate = order.orderDate;

        if (existing) {
          existing.totalQuantity += itemQuantity;
          existing.totalRevenue += itemRevenue;
          existing.orderCount += 1;
          if (itemDate > existing.lastSaleDate) {
            existing.lastSaleDate = itemDate;
          }
        } else {
          const product = products.find(p => p.id === item.productId);
          if (product) {
            productMap.set(item.productId, {
              product,
              totalQuantity: itemQuantity,
              totalRevenue: itemRevenue,
              orderCount: 1,
              lastSaleDate: itemDate
            });
          }
        }
      });
    });

    return Array.from(productMap.values())
      .map(data => ({
        ...data,
        avgSellingPrice: data.orderCount > 0 ? data.totalRevenue / data.orderCount : 0
      }))
      .sort((a, b) => b.totalRevenue - a.totalRevenue);
  }, [filteredOrders, products]);

  // Client × Product analysis
  const clientProductAnalysis = useMemo(() => {
    if (!selectedCustomer) return [];

    const productMap = new Map<string, { quantity: number; revenue: number }>();

    filteredOrders
      .filter(o => o.customerId === selectedCustomer.id)
      .forEach(order => {
        order.items.forEach(item => {
          const existing = productMap.get(item.productId);
          if (existing) {
            existing.quantity += item.quantity;
            existing.revenue += item.subtotal;
          } else {
            productMap.set(item.productId, {
              quantity: item.quantity,
              revenue: item.subtotal
            });
          }
        });
      });

    return Array.from(productMap.entries()).map(([productId, data]) => {
      const product = products.find(p => p.id === productId);
      return {
        product,
        ...data
      };
    }).filter((item): item is { product: Product; quantity: number; revenue: number } => item.product !== undefined).sort((a, b) => b.revenue - a.revenue);
  }, [selectedCustomer, filteredOrders, products]);

  // Product × Client analysis
  const productClientAnalysis = useMemo(() => {
    if (!selectedProduct) return [];

    const customerMap = new Map<string, { quantity: number; revenue: number }>();

    filteredOrders.forEach(order => {
      order.items.forEach(item => {
        if (item.productId === selectedProduct.id) {
          const existing = customerMap.get(order.customerId);
          if (existing) {
            existing.quantity += item.quantity;
            existing.revenue += item.subtotal;
          } else {
            customerMap.set(order.customerId, {
              quantity: item.quantity,
              revenue: item.subtotal
            });
          }
        }
      });
    });

    return Array.from(customerMap.entries()).map(([customerId, data]) => {
      const customer = customers.find(c => c.id === customerId);
      return {
        customer,
        ...data
      };
    }).filter((item): item is { customer: Customer; quantity: number; revenue: number } => item.customer !== undefined).sort((a, b) => b.revenue - a.revenue);
  }, [selectedProduct, filteredOrders, customers]);

  // Filtered customers and products for search
  const filteredCustomers = useMemo(() => {
    if (!customerSearch) return clientAnalytics;
    return clientAnalytics.filter(c => 
      c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
      c.company.toLowerCase().includes(customerSearch.toLowerCase())
    );
  }, [clientAnalytics, customerSearch]);

  const filteredProducts: ProductAnalyticsData[] = useMemo(() => {
    if (!productSearch) return productAnalytics;
    return productAnalytics.filter(p => 
      p.product.name.toLowerCase().includes(productSearch.toLowerCase()) ||
      p.product.type.toLowerCase().includes(productSearch.toLowerCase())
    );
  }, [productAnalytics, productSearch]);

  // Chart 1: Top Customers Bar Chart (using real data)
  const topCustomerData = clientAnalytics
    .slice(0, 5)
    .map((c) => ({
      name: c.company.length > 12 ? `${c.company.substring(0, 12)}...` : c.company,
      Revenue: c.totalRevenue
    }));

  // Chart 2: Revenue Mix Donut Chart (using real data)
  const COLORS = ['#2563eb', '#38bdf8', '#a855f7', '#f59e0b', '#10b981', '#ec4899'];
  const revenueMixData = productAnalytics
    .slice(0, 6)
    .map((p) => ({
      name: p.product.name.length > 15 ? `${p.product.name.substring(0, 15)}...` : p.product.name,
      value: p.totalRevenue
    }));

  // Chart 3: Monthly Trend (using real data)
  const monthlyTrend = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentYear = new Date().getFullYear();
    
    const monthlyData = months.map((month, index) => {
      const monthOrders = filteredOrders.filter(o => {
        const orderDate = new Date(o.orderDate);
        return orderDate.getFullYear() === currentYear && orderDate.getMonth() === index;
      });
      
      const monthExpenses = filteredExpenses.filter(e => {
        const expenseDate = new Date(e.expenseDate);
        return expenseDate.getFullYear() === currentYear && expenseDate.getMonth() === index;
      });

      const sales = monthOrders.reduce((sum, o) => sum + o.totalAmount, 0);
      const expenses = monthExpenses.reduce((sum, e) => sum + e.amount, 0);

      return { month, Sales: sales, Expenses: expenses };
    });

    // Fill only months with data up to current month
    const currentMonth = new Date().getMonth();
    return monthlyData.slice(0, currentMonth + 1);
  }, [filteredOrders, filteredExpenses]);

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

      {/* Client-wise Analysis Section */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Users className="w-5 h-5 text-blue-600" />
            <div>
              <h2 className="text-base font-bold text-slate-900">Client-wise Analysis</h2>
              <p className="text-xs text-slate-500">Detailed customer performance metrics</p>
            </div>
          </div>
          
          {/* Customer Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search customer..."
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
              className="pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-64"
            />
          </div>
        </div>

        {/* Customer Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCustomers.slice(0, 9).map((customer) => (
            <div
              key={customer.id}
              className="p-4 border border-slate-200 rounded-2xl hover:border-blue-300 hover:shadow-md transition-all cursor-pointer"
              onClick={() => setSelectedCustomer(customer)}
            >
              <div className="space-y-3">
                <div>
                  <h3 className="font-semibold text-slate-900 text-sm">{customer.name}</h3>
                  <p className="text-xs text-slate-500">{customer.company}</p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-slate-500">Orders</p>
                    <p className="font-semibold text-slate-900">{customer.totalOrders}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Revenue</p>
                    <p className="font-semibold text-slate-900">₹{customer.totalRevenue.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Quantity</p>
                    <p className="font-semibold text-slate-900">{customer.totalQuantity.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Outstanding</p>
                    <p className={`font-semibold ${customer.outstanding > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                      ₹{customer.outstanding.toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Product-wise Analysis Section */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Package className="w-5 h-5 text-purple-600" />
            <div>
              <h2 className="text-base font-bold text-slate-900">Product-wise Analysis</h2>
              <p className="text-xs text-slate-500">Product performance and sales metrics</p>
            </div>
          </div>
          
          {/* Product Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search product..."
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              className="pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent w-64"
            />
          </div>
        </div>

        {/* Product Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProducts.slice(0, 9).map((data) => (
            <div
              key={data.product.id}
              className="p-4 border border-slate-200 rounded-2xl hover:border-purple-300 hover:shadow-md transition-all cursor-pointer"
              onClick={() => setSelectedProduct(data.product)}
            >
              <div className="space-y-3">
                <div>
                  <h3 className="font-semibold text-slate-900 text-sm">{data.product.name}</h3>
                  <p className="text-xs text-slate-500">Type: {data.product.type}</p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-slate-500">Quantity Sold</p>
                    <p className="font-semibold text-slate-900">{data.totalQuantity.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Orders</p>
                    <p className="font-semibold text-slate-900">{data.orderCount}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Revenue</p>
                    <p className="font-semibold text-slate-900">₹{data.totalRevenue.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Avg Price</p>
                    <p className="font-semibold text-slate-900">₹{data.avgSellingPrice.toFixed(2)}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Customer Detail Modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">{selectedCustomer.name}</h2>
                  <p className="text-sm text-slate-500">{selectedCustomer.company}</p>
                </div>
                <button
                  onClick={() => setSelectedCustomer(null)}
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>

              {/* Customer Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-blue-50 rounded-2xl">
                  <p className="text-xs text-slate-600">Total Orders</p>
                  <p className="text-2xl font-bold text-blue-600">{selectedCustomer.totalOrders}</p>
                </div>
                <div className="p-4 bg-emerald-50 rounded-2xl">
                  <p className="text-xs text-slate-600">Total Revenue</p>
                  <p className="text-2xl font-bold text-emerald-600">₹{selectedCustomer.totalRevenue.toLocaleString()}</p>
                </div>
                <div className="p-4 bg-purple-50 rounded-2xl">
                  <p className="text-xs text-slate-600">Total Quantity</p>
                  <p className="text-2xl font-bold text-purple-600">{selectedCustomer.totalQuantity.toLocaleString()}</p>
                </div>
                <div className="p-4 bg-rose-50 rounded-2xl">
                  <p className="text-xs text-slate-600">Outstanding</p>
                  <p className="text-2xl font-bold text-rose-600">₹{selectedCustomer.outstanding.toLocaleString()}</p>
                </div>
              </div>

              {/* Additional Stats */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="p-4 bg-slate-50 rounded-2xl">
                  <p className="text-xs text-slate-600">Amount Paid</p>
                  <p className="text-lg font-bold text-slate-900">₹{selectedCustomer.totalPaid.toLocaleString()}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl">
                  <p className="text-xs text-slate-600">Avg Order Value</p>
                  <p className="text-lg font-bold text-slate-900">₹{selectedCustomer.avgOrderValue.toFixed(0).toLocaleString()}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl">
                  <p className="text-xs text-slate-600">Last Order</p>
                  <p className="text-lg font-bold text-slate-900">{selectedCustomer.lastOrderDate !== 'N/A' ? new Date(selectedCustomer.lastOrderDate).toLocaleDateString('en-IN') : 'N/A'}</p>
                </div>
              </div>

              {/* Client × Product Analysis */}
              <div>
                <h3 className="text-lg font-bold text-slate-900 mb-4">Products Purchased</h3>
                {clientProductAnalysis.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600">Product</th>
                          <th className="text-right py-3 px-4 text-xs font-semibold text-slate-600">Quantity</th>
                          <th className="text-right py-3 px-4 text-xs font-semibold text-slate-600">Revenue</th>
                        </tr>
                      </thead>
                      <tbody>
                        {clientProductAnalysis.map((item) => (
                          <tr key={item.product.id} className="border-b border-slate-100">
                            <td className="py-3 px-4 text-sm text-slate-900">{item.product.name}</td>
                            <td className="py-3 px-4 text-sm text-slate-900 text-right">{item.quantity.toLocaleString()}</td>
                            <td className="py-3 px-4 text-sm text-slate-900 text-right">₹{item.revenue.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">No product data available</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Product Detail Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">{selectedProduct.name}</h2>
                  <p className="text-sm text-slate-500">Type: {selectedProduct.type}</p>
                </div>
                <button
                  onClick={() => setSelectedProduct(null)}
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>

              {/* Product Stats */}
              {(() => {
                const productData = productAnalytics.find(p => p.product.id === selectedProduct.id);
                if (!productData) return null;
                return (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="p-4 bg-purple-50 rounded-2xl">
                        <p className="text-xs text-slate-600">Quantity Sold</p>
                        <p className="text-2xl font-bold text-purple-600">{productData.totalQuantity.toLocaleString()}</p>
                      </div>
                      <div className="p-4 bg-emerald-50 rounded-2xl">
                        <p className="text-xs text-slate-600">Total Revenue</p>
                        <p className="text-2xl font-bold text-emerald-600">₹{productData.totalRevenue.toLocaleString()}</p>
                      </div>
                      <div className="p-4 bg-blue-50 rounded-2xl">
                        <p className="text-xs text-slate-600">Number of Orders</p>
                        <p className="text-2xl font-bold text-blue-600">{productData.orderCount}</p>
                      </div>
                      <div className="p-4 bg-rose-50 rounded-2xl">
                        <p className="text-xs text-slate-600">Avg Selling Price</p>
                        <p className="text-2xl font-bold text-rose-600">₹{productData.avgSellingPrice.toFixed(2)}</p>
                      </div>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-2xl">
                      <p className="text-xs text-slate-600">Last Sale Date</p>
                      <p className="text-lg font-bold text-slate-900">{productData.lastSaleDate ? new Date(productData.lastSaleDate).toLocaleDateString('en-IN') : 'N/A'}</p>
                    </div>

                    {/* Product × Client Analysis */}
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 mb-4">Customers Who Purchased</h3>
                      {productClientAnalysis.length > 0 ? (
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead>
                              <tr className="border-b border-slate-200">
                                <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600">Customer</th>
                                <th className="text-right py-3 px-4 text-xs font-semibold text-slate-600">Quantity</th>
                                <th className="text-right py-3 px-4 text-xs font-semibold text-slate-600">Revenue</th>
                              </tr>
                            </thead>
                            <tbody>
                              {productClientAnalysis.map((item) => (
                                <tr key={item.customer.id} className="border-b border-slate-100">
                                  <td className="py-3 px-4 text-sm text-slate-900">
                                    {item.customer.name}
                                    <span className="text-xs text-slate-500 block">{item.customer.company}</span>
                                  </td>
                                  <td className="py-3 px-4 text-sm text-slate-900 text-right">{item.quantity.toLocaleString()}</td>
                                  <td className="py-3 px-4 text-sm text-slate-900 text-right">₹{item.revenue.toLocaleString()}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="text-sm text-slate-500">No customer data available</p>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
