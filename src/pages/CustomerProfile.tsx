import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Customer, Order } from '../types';
import { getCustomers, getOrders } from '../services/db';
import { Badge } from '../components/common/Badge';
import {
  ArrowLeft,
  Building,
  User,
  Phone,
  MapPin,
  ShoppingCart,
  IndianRupee,
  Calendar,
  Plus
} from 'lucide-react';

interface CustomerProfileProps {
  onOpenNewOrderModal: () => void;
}

export const CustomerProfile: React.FC<CustomerProfileProps> = ({ onOpenNewOrderModal }) => {
  const { customerId } = useParams<{ customerId: string }>();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [customerOrders, setCustomerOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCustomerData();
  }, [customerId]);

  const loadCustomerData = async () => {
    setLoading(true);
    try {
      const [cusList, ordList] = await Promise.all([getCustomers(), getOrders()]);
      const found = cusList.find((c) => c.id === customerId);
      if (found) {
        setCustomer(found);
        const filteredOrd = ordList.filter(
          (o) => o.customerId === found.id || o.companyName === found.company
        );
        setCustomerOrders(filteredOrd);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-xs text-slate-400 font-medium">Loading customer profile...</div>;
  }

  if (!customer) {
    return (
      <div className="p-8 text-center space-y-3">
        <p className="text-sm font-semibold text-slate-700">Customer not found.</p>
        <Link to="/customers" className="text-xs text-blue-600 font-semibold hover:underline">
          Back to Customer Directory
        </Link>
      </div>
    );
  }

  const totalSpent = customerOrders.reduce((sum, o) => sum + o.totalAmount, 0) || customer.totalSpent;
  const avgOrderValue = customerOrders.length > 0 ? totalSpent / customerOrders.length : 0;

  return (
    <div className="space-y-6">
      {/* Back Button & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center space-x-3">
          <Link
            to="/customers"
            className="p-2 rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center space-x-3">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{customer.company}</h1>
              <span className="bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-full text-xs font-bold">
                Category {customer.priceCategory}
              </span>
              <Badge status={customer.status} size="md" />
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">Contact: {customer.name} • {customer.phone}</p>
          </div>
        </div>

        <button
          onClick={onOpenNewOrderModal}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-md shadow-blue-500/20 transition-colors flex items-center space-x-2 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>New Order for Customer</span>
        </button>
      </div>

      {/* Spend & Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Spent</div>
          <div className="text-2xl font-bold text-slate-900 mt-2">₹{totalSpent.toLocaleString()}</div>
          <div className="text-[11px] text-slate-400 mt-1">Lifetime order volume</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Orders</div>
          <div className="text-2xl font-bold text-slate-900 mt-2">{customerOrders.length || customer.totalOrders}</div>
          <div className="text-[11px] text-slate-400 mt-1">Orders booked</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Average Order Value</div>
          <div className="text-2xl font-bold text-slate-900 mt-2">₹{avgOrderValue.toFixed(0).toLocaleString()}</div>
          <div className="text-[11px] text-slate-400 mt-1">Per transaction</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Customer Type</div>
          <div className="text-2xl font-bold text-slate-900 mt-2">{customer.customerType}</div>
          <div className="text-[11px] text-slate-400 mt-1">Client Classification</div>
        </div>
      </div>

      {/* Info Card & Order History */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Info Box */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-slate-900">Account Details</h2>
          <div className="space-y-3 text-xs text-slate-700">
            <div className="flex items-start space-x-2">
              <Building className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-slate-800 block">Company Name</span>
                <span>{customer.company}</span>
              </div>
            </div>
            <div className="flex items-start space-x-2">
              <User className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-slate-800 block">Primary Contact</span>
                <span>{customer.name}</span>
              </div>
            </div>
            <div className="flex items-start space-x-2">
              <Phone className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-slate-800 block">Phone</span>
                <span>{customer.phone}</span>
              </div>
            </div>
            <div className="flex items-start space-x-2">
              <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-slate-800 block">Billing / Delivery Address</span>
                <span>{customer.address || 'GIDC Industrial Area'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Order History Table */}
        <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-slate-900">Order History</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-3">Order ID</th>
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3">Items</th>
                  <th className="py-3 px-3">Total Amount</th>
                  <th className="py-3 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700 font-medium">
                {customerOrders.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      No order history found for this customer.
                    </td>
                  </tr>
                ) : (
                  customerOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-3 font-bold">
                        <Link to={`/sales/${order.id}`} className="text-blue-600 hover:underline">
                          {order.orderNumber}
                        </Link>
                      </td>
                      <td className="py-3 px-3 text-slate-500">{order.orderDate}</td>
                      <td className="py-3 px-3">{order.items.map((i) => i.productName).join(', ')}</td>
                      <td className="py-3 px-3 font-bold text-slate-900">₹{order.totalAmount.toLocaleString()}</td>
                      <td className="py-3 px-3">
                        <Badge status={order.orderStatus} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
