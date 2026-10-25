import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Dispatch, Order, PaymentStatus, PriceCategory } from '../types';
import { getGstExemptOrders, getDispatches } from '../services/db';
import { getOrderQuantity } from '../utils/orderUtils';
import { getOrderDeliveryProgress } from '../utils/dispatchUtils';
import { formatNumberDisplay } from '../utils/packetUtils';
import { Badge } from '../components/common/Badge';
import { formatDate } from '../utils/dateUtils';
import {
  Search,
  Eye,
  IndianRupee,
  Truck,
  Building2,
  Printer,
  X,
  ShieldAlert
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';

interface GstExemptSalesProps {
  onOpenRecordPaymentModal: (orderId?: string) => void;
  onOpenNewDispatchModal: (orderId?: string) => void;
}

export const GstExemptSales: React.FC<GstExemptSalesProps> = ({
  onOpenRecordPaymentModal,
  onOpenNewDispatchModal
}) => {
  const { can, isAdmin } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [customerFilter, setCustomerFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [dateFromFilter, setDateFromFilter] = useState('');
  const [dateToFilter, setDateToFilter] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'amount_high'>('newest');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [printOrder, setPrintOrder] = useState<Order | null>(null);
  const [printDispatch, setPrintDispatch] = useState<Dispatch | null>(null);
  const [viewChallan, setViewChallan] = useState(false);
  const challanPrintRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    setLoading(true);
    setError('');
    try {
      const [list, dispatchList] = await Promise.all([getGstExemptOrders(), getDispatches()]);
      setOrders(list);
      setDispatches(dispatchList);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load records.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleViewChallan = (order: Order) => {
    const orderDispatches = dispatches
      .filter((dispatch) => dispatch.orderId === order.id || dispatch.orderNumber === order.orderNumber)
      .sort((a, b) => `${a.dispatchDate}-${a.createdAt}`.localeCompare(`${b.dispatchDate}-${b.createdAt}`));
    setPrintOrder(order);
    setPrintDispatch(orderDispatches[orderDispatches.length - 1] || null);
    setViewChallan(true);
  };

  const handlePrintFromModal = () => {
    setViewChallan(false);
    setTimeout(() => window.print(), 120);
  };

  const printProgress = printOrder ? getOrderDeliveryProgress(printOrder, dispatches) : null;

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

    // Date range filtering
    let matchesDateRange = true;
    if (dateFromFilter) {
      const fromDate = new Date(dateFromFilter);
      const orderDate = new Date(o.orderDate);
      matchesDateRange = matchesDateRange && orderDate >= fromDate;
    }
    if (dateToFilter) {
      const toDate = new Date(dateToFilter);
      const orderDate = new Date(o.orderDate);
      matchesDateRange = matchesDateRange && orderDate <= toDate;
    }

    return matchesSearch && matchesCustomer && matchesStatus && matchesPayment && matchesDateRange;
  });

  // Sorting
  const sortedOrders = [...filteredOrders].sort((a, b) => {
    if (sortBy === 'newest') return new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime();
    if (sortBy === 'oldest') return new Date(a.orderDate).getTime() - new Date(b.orderDate).getTime();
    if (sortBy === 'amount_high') return b.totalAmount - a.totalAmount;
    return 0;
  });

  if (!isAdmin) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-white p-10 text-center">
        <ShieldAlert className="w-10 h-10 text-rose-400 mx-auto mb-3" />
        <h1 className="text-lg font-bold text-slate-900">Administrator Access Required</h1>
        <p className="mt-2 text-sm text-slate-500">
          GST-Exempt Sales records are restricted to system administrators.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">GST-Exempt Sales & Invoices</h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-700 border border-amber-200">
              <ShieldAlert className="w-3 h-3" />
              Admin Only
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Showing {sortedOrders.length} of {orders.length} GST-exempt (kachha bill) orders
          </p>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 text-xs text-amber-800 font-medium flex items-start gap-2">
        <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
        <span>
          This page shows all orders explicitly recorded as GST-exempt (kachha bill / <code>gstApplied: false</code>).
          Non-GST orders appear in the normal Sales & Orders list for 24 hours after creation, then move here.
          Legacy orders without an explicit GST flag are not shown here. These records remain part of the Finance ledger.
          Do not delete or modify these records.
        </span>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl px-4 py-3 text-xs text-rose-800 font-semibold">
          {error}
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          {/* Search */}
          <div className="relative lg:col-span-2">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search order ID, company, or product..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 text-xs font-medium text-slate-800 rounded-xl border border-slate-200 focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
            />
          </div>

          {/* Customer Filter */}
          <select
            value={customerFilter}
            onChange={(e) => setCustomerFilter(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 text-xs font-medium text-slate-700 rounded-xl border border-slate-200 focus:bg-white"
          >
            <option value="all">All Customers</option>
            {customerNames.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>

          {/* Order Status Filter */}
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
            <option value="cancelled">Cancelled</option>
          </select>

          {/* Payment Status Filter */}
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

          {/* Date From Filter */}
          <input
            type="date"
            value={dateFromFilter}
            onChange={(e) => setDateFromFilter(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 text-xs font-medium text-slate-700 rounded-xl border border-slate-200 focus:bg-white"
            placeholder="From Date"
          />
        </div>

        {/* Second row for Date To filter */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {/* Date To Filter */}
          <input
            type="date"
            value={dateToFilter}
            onChange={(e) => setDateToFilter(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 text-xs font-medium text-slate-700 rounded-xl border border-slate-200 focus:bg-white"
            placeholder="To Date"
          />

          {/* Clear Filters Button */}
          {(dateFromFilter || dateToFilter) && (
            <button
              onClick={() => {
                setDateFromFilter('');
                setDateToFilter('');
              }}
              className="px-3 py-2 bg-slate-100 text-xs font-medium text-slate-700 rounded-xl border border-slate-200 hover:bg-slate-200 transition-colors"
            >
              Clear Date Filters
            </button>
          )}
        </div>

        {/* Sort */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Sort:</span>
          {(['newest', 'oldest', 'amount_high'] as const).map((opt) => (
            <button
              key={opt}
              onClick={() => setSortBy(opt)}
              className={`px-3 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                sortBy === opt
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {opt === 'newest' ? 'Newest First' : opt === 'oldest' ? 'Oldest First' : 'Highest Amount'}
            </button>
          ))}
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-3xl border border-amber-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-400 text-sm font-medium">Loading GST-exempt records…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-amber-50/70 border-b border-amber-100 text-[11px] font-bold text-amber-700 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Date</th>
                  <th className="py-3.5 px-4">Order #</th>
                  <th className="py-3.5 px-4">Customer</th>
                  <th className="py-3.5 px-4">Items</th>
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
                      {orders.length === 0
                        ? 'No GST-exempt orders found. Orders explicitly recorded as kachha bill (gstApplied: false) will appear here.'
                        : 'No orders match your filter criteria.'}
                    </td>
                  </tr>
                ) : (
                  sortedOrders.map((order) => {
                    const totalQty = getOrderQuantity(order);

                    return (
                      <tr key={order.id} className="hover:bg-amber-50/40 transition-colors">
                        <td className="py-3.5 px-4 text-slate-500">{formatDate(order.orderDate)}</td>
                        <td className="py-3.5 px-4 font-bold text-slate-800 text-[11px]">{order.orderNumber}</td>
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900">{order.customerName}</div>
                          <div className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
                            <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>{order.companyName}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-medium text-slate-800">
                            {order.items.map((item) => item.productName).join(', ') || 'No Items'}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-semibold">{totalQty.toLocaleString()}</td>
                        <td className="py-3.5 px-4 font-bold text-slate-900">
                          ₹{order.totalAmount.toLocaleString()}
                          <div className="text-[10px] text-amber-600 font-semibold">No GST</div>
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
                            {order.orderStatus !== 'cancelled' && (
                              <button
                                onClick={() => handleViewChallan(order)}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                                title={dispatches.some((d) => d.orderId === order.id || d.orderNumber === order.orderNumber) ? 'View / Print latest sub-challan' : 'View / Print delivery challan'}
                                aria-label={`View delivery challan for ${order.orderNumber}`}
                              >
                                <Printer className="w-4 h-4" />
                              </button>
                            )}
                            {order.paymentStatus !== 'paid' && can('finance', 'create') && can('finance', 'view') && (
                              <button
                                onClick={() => onOpenRecordPaymentModal(order.id)}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                                title="Record Payment"
                              >
                                <IndianRupee className="w-4 h-4" />
                              </button>
                            )}
                            {order.orderStatus !== 'completed' && order.orderStatus !== 'dispatched' && order.orderStatus !== 'cancelled' && can('dispatch', 'create') && (
                              <button
                                onClick={() => onOpenNewDispatchModal(order.id)}
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
        )}
      </div>

      {/* ── VIEW CHALLAN MODAL ──────────────────────────────────────────── */}
      {viewChallan && printOrder && printProgress && (
        <div
          className="print-challan-overlay fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(4px)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setViewChallan(false); }}
        >
          <div
            className="print-challan-modal relative bg-white rounded-2xl shadow-2xl flex flex-col"
            style={{ width: '820px', maxWidth: '100%', maxHeight: '92vh' }}
          >
            {/* Modal Header */}
            <div className="print-challan-header flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  {printDispatch ? 'Sub-Delivery Challan' : 'Delivery Challan'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {printDispatch?.dispatchNumber || printOrder.orderNumber} &nbsp;·&nbsp; {formatDate(printDispatch?.dispatchDate || printOrder.orderDate)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrintFromModal}
                  className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-sm shadow-blue-500/20 transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print Challan
                </button>
                <button
                  onClick={() => setViewChallan(false)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                  aria-label="Close preview"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Challan Preview Body */}
            <div className="print-challan-body overflow-y-auto flex-1 bg-slate-100 p-6">
              <div
                ref={challanPrintRef}
                className="print-challan-sheet"
                style={{
                  fontFamily: "'Arial', 'Helvetica Neue', sans-serif",
                  width: '210mm',
                  minHeight: '297mm',
                  margin: '0 auto',
                  padding: '14mm 16mm',
                  boxSizing: 'border-box',
                  color: '#0f172a',
                  background: '#fff',
                  boxShadow: '0 4px 32px rgba(0,0,0,0.13)',
                  borderRadius: '6px'
                }}
              >
                {/* Challan Header */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-start', borderBottom: '2.5px solid #2563eb', paddingBottom: '14px', marginBottom: '16px' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{
                      display: 'inline-block',
                      background: '#eff6ff',
                      border: '1px solid #bfdbfe',
                      borderRadius: '6px',
                      padding: '6px 14px',
                      fontSize: '13px',
                      fontWeight: 800,
                      color: '#1e3a8a',
                      letterSpacing: '0.5px'
                    }}>
                      {printDispatch ? 'SUB-DELIVERY CHALLAN' : 'DELIVERY CHALLAN'}
                    </div>
                    <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
                      Date: {formatDate(printDispatch?.dispatchDate || printOrder.orderDate)}
                    </div>
                  </div>
                </div>

                {/* Info Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '18px' }}>
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '12px', borderRadius: '8px' }}>
                    <div style={{ fontSize: '8px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '1px' }}>Bill To</div>
                    <div style={{ fontWeight: 800, marginTop: '5px', fontSize: '13px', color: '#0f172a' }}>{printOrder.companyName || printOrder.customerName}</div>
                    <div style={{ fontSize: '10px', marginTop: '3px', color: '#475569' }}>Attn: {printOrder.customerName}</div>
                  </div>
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '12px', borderRadius: '8px' }}>
                    <div style={{ fontSize: '8px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '1px' }}>Delivery Details</div>
                    <div style={{ fontSize: '10px', marginTop: '5px', color: '#475569' }}>
                      {printDispatch ? 'Sub-delivery quantities' : 'Initial delivery quantities'}
                    </div>
                    {printDispatch && (
                      <div style={{ fontSize: '10px', marginTop: '4px', color: '#0f172a', fontWeight: 600 }}>
                        🚛 Vehicle: {printDispatch.vehicleNumber || '—'} &nbsp;|&nbsp; Driver: {printDispatch.driverName || '—'}
                      </div>
                    )}
                    <style>{`
                      @media print {
                        body * { visibility: hidden !important; }
                        .print-challan-overlay, .print-challan-overlay * { visibility: visible !important; }
                        .print-challan-overlay { position: absolute !important; inset: 0 !important; display: block !important; padding: 0 !important; background: #fff !important; }
                        .print-challan-modal { width: 100% !important; max-width: none !important; max-height: none !important; display: block !important; box-shadow: none !important; }
                        .print-challan-header { display: none !important; }
                        .print-challan-body { overflow: visible !important; padding: 0 !important; background: #fff !important; }
                        .print-challan-sheet { margin: 0 auto !important; box-shadow: none !important; border-radius: 0 !important; }
                      }
                    `}</style>
                  </div>
                </div>

                {/* Items Table */}
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                  <thead>
                    <tr style={{ background: '#1e3a8a', color: '#fff' }}>
                      {['Product', 'Ordered (pcs)', 'Delivered (pcs)', 'Current Delivery', 'Remaining (pcs)'].map((heading) => (
                        <th key={heading} style={{
                          padding: '10px 8px',
                          textAlign: heading === 'Product' ? 'left' : 'center',
                          fontWeight: 700,
                          fontSize: '10px',
                          letterSpacing: '0.3px'
                        }}>{heading}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {printOrder.items.map((orderItem, index) => {
                      const progress = printProgress.items.find((item) => item.productId === orderItem.productId);
                      const dispatchItem = printDispatch?.items.find((item) => item.productId === orderItem.productId);
                      const currentPieces = dispatchItem?.quantity ?? (printDispatch ? 0 : orderItem.quantity);
                      const displayUnit = dispatchItem?.deliveryUnit || (orderItem.soldByPacket && orderItem.packetCount !== undefined && orderItem.unitsPerPacket ? 'packets' : 'pieces');
                      const displayQuantity = dispatchItem?.packetQuantity ?? (displayUnit === 'packets' ? orderItem.packetCount : currentPieces);
                      const unitText = displayUnit === 'packets' && (dispatchItem?.unitsPerPacket || orderItem.unitsPerPacket)
                        ? `${displayQuantity === 1 ? 'packet' : 'packets'} × ${dispatchItem?.unitsPerPacket || orderItem.unitsPerPacket} pcs + ${dispatchItem?.loosePieces || orderItem.loosePieces || 0} loose`
                        : 'pieces';
                      if (printDispatch && !dispatchItem) return null;
                      const isFullyDelivered = progress && progress.remainingQuantity === 0;
                      return (
                        <tr key={orderItem.productId} style={{ background: index % 2 === 0 ? '#fff' : '#f8fafc' }}>
                          <td style={{ padding: '10px 8px', borderBottom: '1px solid #e2e8f0', fontWeight: 700 }}>
                            {orderItem.productName}
                            <div style={{ fontSize: '9px', fontWeight: 400, color: '#94a3b8', marginTop: '2px' }}>{unitText}</div>
                          </td>
                          <td style={{ padding: '10px 8px', borderBottom: '1px solid #e2e8f0', textAlign: 'center', color: '#475569' }}>
                            {formatNumberDisplay(orderItem.quantity)}
                          </td>
                          <td style={{ padding: '10px 8px', borderBottom: '1px solid #e2e8f0', textAlign: 'center', color: '#475569' }}>
                            {formatNumberDisplay(progress?.deliveredQuantity || 0)}
                          </td>
                          <td style={{ padding: '10px 8px', borderBottom: '1px solid #e2e8f0', textAlign: 'center', fontWeight: 700, color: '#0f172a' }}>
                            {formatNumberDisplay(displayQuantity)} {displayUnit}
                            {displayUnit === 'packets' && <span style={{ fontWeight: 400, color: '#64748b' }}> + {formatNumberDisplay(dispatchItem?.loosePieces ?? orderItem.loosePieces ?? 0)} loose</span>}
                            {displayUnit === 'packets' && <div style={{ fontSize: '9px', fontWeight: 400, color: '#94a3b8' }}>({formatNumberDisplay(currentPieces)} pcs)</div>}
                          </td>
                          <td style={{ padding: '10px 8px', borderBottom: '1px solid #e2e8f0', textAlign: 'center' }}>
                            <span style={{
                              display: 'inline-block',
                              padding: '2px 8px',
                              borderRadius: '20px',
                              background: isFullyDelivered ? '#dcfce7' : '#fef9c3',
                              color: isFullyDelivered ? '#15803d' : '#854d0e',
                              fontWeight: 700,
                              fontSize: '10px'
                            }}>
                              {formatNumberDisplay(progress?.remainingQuantity || 0)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Summary row */}
                <div style={{
                  marginTop: '16px',
                  padding: '10px 14px',
                  background: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  borderRadius: '8px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#1e40af'
                }}>
                  <span>Total Ordered: {formatNumberDisplay(printProgress.totalOrderedQuantity)} pcs</span>
                  <span>Total Delivered: {formatNumberDisplay(printProgress.totalDeliveredQuantity)} pcs</span>
                  <span>Remaining: {formatNumberDisplay(printProgress.totalRemainingQuantity)} pcs</span>
                </div>

                <div style={{ marginTop: '14px', fontSize: '9px', color: '#94a3b8', lineHeight: 1.5 }}>
                  Delivery quantities are recorded in pieces for inventory and fulfillment tracking.
                </div>

                {/* Signature section */}
                <div style={{ marginTop: '60px', display: 'flex', justifyContent: 'space-between', fontSize: '10px', borderTop: '1px dashed #cbd5e1', paddingTop: '16px' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ width: '160px', borderBottom: '1px solid #cbd5e1', marginBottom: '6px' }}></div>
                    <span style={{ color: '#64748b' }}>Authorized Signatory</span>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ width: '160px', borderBottom: '1px solid #cbd5e1', marginBottom: '6px' }}></div>
                    <span style={{ color: '#64748b' }}>Receiver's Signature & Stamp</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
