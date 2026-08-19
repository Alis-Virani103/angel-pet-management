import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Order, OrderStatus, PaymentStatus, PriceCategory } from '../types';
import { getOrders, updateOrderStatus } from '../services/db';
import { Badge } from '../components/common/Badge';
import {
  Search,
  Plus,
  Filter,
  Eye,
  IndianRupee,
  Truck,
  CheckCircle,
  Clock,
  ArrowUpDown,
  FileSpreadsheet
} from 'lucide-react';

interface SalesOrdersProps {
  onOpenNewOrderModal: () => void;
  onOpenRecordPaymentModal: (orderId?: string) => void;
  onOpenNewDispatchModal: () => void;
}

export const SalesOrders: React.FC<SalesOrdersProps> = ({
  onOpenNewOrderModal,
  onOpenRecordPaymentModal,
  onOpenNewDispatchModal
}) => {
  const [searchParams] = useSearchParams();
  const [orders, setOrders] = useState<Order[]>([]);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [customerFilter, setCustomerFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [tierFilter, setTierFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'amount_high'>('newest');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const list = await getOrders();
      setOrders(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (orderId: string, newStatus: OrderStatus) => {
    try {
      await updateOrderStatus(orderId, newStatus);
      loadOrders();
    } catch (e) {
      console.error(e);
    }
  };

  // Unique customer list for dropdown
  const customerNames = Array.from(new Set(orders.map((o) => o.companyName || o.customerName)));

  // Filtering
  const filteredOrders = orders.filter((o) => {
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      o.orderNumber.toLowerCase().includes(query) ||
      o.customerName.toLowerCase().includes(query) ||
      o.companyName.toLowerCase().includes(query) ||
      o.items.some((i) => i.productName.toLowerCase().includes(query));

    const matchesCustomer = customerFilter === 'all' || o.companyName === customerFilter || o.customerName === customerFilter;
    const matchesStatus = statusFilter === 'all' || o.orderStatus === statusFilter;
    const matchesPayment = paymentFilter === 'all' || o.paymentStatus === paymentFilter;
    const matchesTier = tierFilter === 'all' || o.items.some((i) => i.priceCategory === tierFilter);

    return matchesSearch && matchesCustomer && matchesStatus && matchesPayment && matchesTier;
  });

  // Sorting
  const sortedOrders = [...filteredOrders].sort((a, b) => {
    if (sortBy === 'newest') return new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime();
    if (sortBy === 'oldest') return new Date(a.orderDate).getTime() - new Date(b.orderDate).getTime();
    if (sortBy === 'amount_high') return b.totalAmount - a.totalAmount;
    return 0;
  });

  return (
    <div className="space-y-6">
      {/* Top Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Sales & Orders</h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Showing {sortedOrders.length} of {orders.length} orders
          </p>
        </div>

        <button
          onClick={onOpenNewOrderModal}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-md shadow-blue-500/20 transition-colors flex items-center space-x-2 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>New Order</span>
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          {/* Search Box */}
          <div className="lg:col-span-2 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search order ID, company, or bottle..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 text-xs font-medium text-slate-800 rounded-xl border border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          {/* Customer Filter */}
          <div>
            <select
              value={customerFilter}
              onChange={(e) => setCustomerFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 text-xs font-medium text-slate-700 rounded-xl border border-slate-200 focus:bg-white"
            >
              <option value="all">All Customers</option>
              {customerNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          {/* Order Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 text-xs font-medium text-slate-700 rounded-xl border border-slate-200 focus:bg-white"
            >
              <option value="all">Order Status</option>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="dispatched">Dispatched</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          {/* Payment Status Filter */}
          <div>
            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 text-xs font-medium text-slate-700 rounded-xl border border-slate-200 focus:bg-white"
            >
              <option value="all">Payment Status</option>
              <option value="pending">Pending</option>
              <option value="partially_paid">Partially Paid</option>
              <option value="paid">Paid</option>
            </select>
          </div>

          {/* Price Category Filter */}
          <div>
            <select
              value={tierFilter}
              onChange={(e) => setTierFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 text-xs font-medium text-slate-700 rounded-xl border border-slate-200 focus:bg-white"
            >
              <option value="all">Price Category</option>
              <option value="A">Category A</option>
              <option value="B">Category B</option>
              <option value="C">Category C</option>
            </select>
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="py-3.5 px-4">Order ID</th>
                <th className="py-3.5 px-4">Date</th>
                <th className="py-3.5 px-4">Customer</th>
                <th className="py-3.5 px-4">Bottle & Cap Spec</th>
                <th className="py-3.5 px-4">Qty</th>
                <th className="py-3.5 px-4">Total Amount</th>
                <th className="py-3.5 px-4">Payment</th>
                <th className="py-3.5 px-4">Order Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
              {sortedOrders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400 font-medium">
                    No orders match your filter criteria.
                  </td>
                </tr>
              ) : (
                sortedOrders.map((order) => {
                  const bottleItem = order.items.find((i) => i.productType === 'bottle');
                  const capItem = order.items.find((i) => i.productType === 'cap');
                  const totalQty = order.items.reduce((sum, i) => sum + i.quantity, 0);

                  return (
                    <tr key={order.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-bold">
                        <Link to={`/sales/${order.id}`} className="text-blue-600 hover:underline">
                          {order.orderNumber}
                        </Link>
                      </td>
                      <td className="py-3.5 px-4 text-slate-500">{order.orderDate}</td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{order.companyName}</div>
                        <div className="text-[11px] text-slate-400">{order.customerName}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-slate-800">
                          {bottleItem ? bottleItem.productName : 'No Bottle'}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {capItem ? `+ ${capItem.productName}` : 'No Cap'}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-semibold">{totalQty.toLocaleString()}</td>
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        ₹{order.totalAmount.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4">
                        <Badge status={order.paymentStatus} />
                      </td>
                      <td className="py-3.5 px-4">
                        <Badge status={order.orderStatus} />
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <Link
                            to={`/sales/${order.id}`}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                            title="View Order Details"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>
                          {order.paymentStatus !== 'paid' && (
                            <button
                              onClick={() => onOpenRecordPaymentModal(order.id)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                              title="Record Payment"
                            >
                              <IndianRupee className="w-4 h-4" />
                            </button>
                          )}
                          {order.orderStatus !== 'completed' && order.orderStatus !== 'dispatched' && (
                            <button
                              onClick={onOpenNewDispatchModal}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-sky-600 hover:bg-sky-50 transition-colors"
                              title="Create Dispatch"
                            >
                              <Truck className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
