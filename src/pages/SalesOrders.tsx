import React, { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Dispatch, Order, PaymentStatus, PriceCategory } from '../types';
import { getDispatches, getOrders } from '../services/db';
import { getOrderQuantity } from '../utils/orderUtils';
import { getOrderDeliveryProgress } from '../utils/dispatchUtils';
import { formatNumberDisplay } from '../utils/packetUtils';
import { isRegularOrder, isWithin24HourVisibilityWindow, isGstExemptOrder } from '../utils/gstUtils';
import { formatDate } from '../utils/dateUtils';
import { Badge } from '../components/common/Badge';
import {
  Search,
  Plus,
  Eye,
  IndianRupee,
  Truck,
  Building2,
  Printer,
  X,
  Info
} from 'lucide-react';
import { useTranslation } from '../i18n';
import { useAuth } from '../auth/AuthContext';

interface SalesOrdersProps {
  onOpenNewOrderModal: () => void;
  onOpenRecordPaymentModal: (orderId?: string) => void;
  onOpenNewDispatchModal: (orderId?: string) => void;
}

export const SalesOrders: React.FC<SalesOrdersProps> = ({
  onOpenNewOrderModal,
  onOpenRecordPaymentModal,
  onOpenNewDispatchModal
}) => {
  const { t } = useTranslation();
  const { can } = useAuth();
  const [searchParams] = useSearchParams();
  const [orders, setOrders] = useState<Order[]>([]);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [customerFilter, setCustomerFilter] = useState('all');
  const [orderTypeFilter, setOrderTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [tierFilter, setTierFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'amount_high'>('newest');
  const [loading, setLoading] = useState(true);
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [printOrder, setPrintOrder] = useState<Order | null>(null);
  const [printDispatch, setPrintDispatch] = useState<Dispatch | null>(null);
  const [viewChallan, setViewChallan] = useState(false);
  const challanPrintRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const [list, dispatchList] = await Promise.all([getOrders(), getDispatches()]);
      setOrders(list);
      setDispatches(dispatchList);
    } catch (e) {
      console.error(e);
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

  // Unique customer list for dropdown (only regular orders)
  const customerNames = Array.from(new Set(orders.filter(isRegularOrder).map((o) => o.companyName || o.customerName)));

  // Filtering — GST-exempt orders are hidden from this page after 24 hours; they appear on the GST-Exempt Sales page (admin only).
  const filteredOrders = orders.filter((o) => {
    // Hide GST-exempt orders that are older than 24 hours
    if (!isRegularOrder(o) && !isWithin24HourVisibilityWindow(o)) return false;

    const query = searchQuery.toLowerCase();
    const orderType = o.orderType || 'REGULAR';
    const matchesSearch =
      o.orderNumber.toLowerCase().includes(query) ||
      o.customerName.toLowerCase().includes(query) ||
      o.companyName.toLowerCase().includes(query) ||
      o.items.some((i) => i.productName.toLowerCase().includes(query));

    const matchesOrderType = orderTypeFilter === 'all' || orderType === orderTypeFilter;
    const matchesCustomer = customerFilter === 'all' || o.companyName === customerFilter || o.customerName === customerFilter;
    const matchesStatus = statusFilter === 'all' || o.orderStatus === statusFilter;
    const matchesPayment = paymentFilter === 'all' || (orderType === 'AS' ? false : o.paymentStatus === paymentFilter);
    const matchesTier = tierFilter === 'all' || o.items.some((i) => i.priceCategory === tierFilter);

    return matchesSearch && matchesOrderType && matchesCustomer && matchesStatus && matchesPayment && matchesTier;
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
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{t('Sales & Orders')}</h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Showing {sortedOrders.length} of {orders.length} orders
          </p>
        </div>

        {can('salesOrders', 'create') && <button
          onClick={onOpenNewOrderModal}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-md shadow-blue-500/20 transition-colors flex items-center space-x-2 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>{t('New Order')}</span>
        </button>}
      </div>

      {/* Info Banner for 24-hour visibility */}
      {orders.some((o) => isGstExemptOrder(o) && isWithin24HourVisibilityWindow(o)) && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3 text-xs text-blue-800 font-medium flex items-start gap-2">
          <Info className="w-4 h-4 shrink-0 mt-0.5 text-blue-600" />
          <span>
            Some non-GST orders are visible for 24 hours after creation. After this period, they will move to the Admin History section.
          </span>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder={t('Search order ID, company, or bottle...')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 text-xs font-medium text-slate-800 rounded-xl border border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          {/* Order Type Filter */}
          <div>
            <select
              value={orderTypeFilter}
              onChange={(e) => setOrderTypeFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 text-xs font-semibold text-slate-700 rounded-xl border border-slate-200 focus:bg-white"
            >
              <option value="all">{t('All Order Types')}</option>
              <option value="REGULAR">{t('Regular Order')}</option>
              <option value="AS">{t('AS Order')}</option>
            </select>
          </div>

          {/* Customer Filter */}
          <div>
            <select
              value={customerFilter}
              onChange={(e) => setCustomerFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 text-xs font-medium text-slate-700 rounded-xl border border-slate-200 focus:bg-white"
            >
              <option value="all">{t('All Customers')}</option>
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
              <option value="all">{t('Order Status')}</option>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="dispatched">Dispatched</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {/* Payment Status Filter */}
          <div>
            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 text-xs font-medium text-slate-700 rounded-xl border border-slate-200 focus:bg-white"
            >
              <option value="all">{t('Payment Status')}</option>
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
              <option value="all">{t('Price Category')}</option>
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
                <th className="py-3.5 px-4">Date</th>
                <th className="py-3.5 px-4">Type</th>
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
                    No orders match your filter criteria.
                  </td>
                </tr>
              ) : (
                sortedOrders.map((order) => {
                  const totalQty = getOrderQuantity(order);
                  const isAS = order.orderType === 'AS';

                  return (
                    <tr key={order.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 text-slate-500">{formatDate(order.orderDate)}</td>
                      <td className="py-3.5 px-4">
                        {isAS ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                            AS Order
                          </span>
                        ) : isGstExemptOrder(order) ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                            No GST
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-700">
                            Regular
                          </span>
                        )}
                      </td>
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
                      </td>
                      <td className="py-3.5 px-4">
                        {isAS ? (
                          <span className="text-[11px] text-slate-400 font-medium italic">N/A</span>
                        ) : (
                          <Badge status={order.paymentStatus} />
                        )}
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
                              title={dispatches.some((dispatch) => dispatch.orderId === order.id || dispatch.orderNumber === order.orderNumber) ? 'View / Print latest sub-challan' : 'View / Print delivery challan'}
                              aria-label={`View delivery challan for ${order.orderNumber}`}
                            >
                              <Printer className="w-4 h-4" />
                            </button>
                          )}
                          {!isAS && order.paymentStatus !== 'paid' && can('finance', 'create') && can('finance', 'view') && (
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2.5px solid #2563eb', paddingBottom: '14px', marginBottom: '16px' }}>
                  <div>
                    <div style={{ fontSize: '24px', fontWeight: 800, color: '#1e3a8a', letterSpacing: '-0.5px' }}>ANGEL PET</div>
                  </div>
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
                    <div style={{ fontSize: '11px', marginTop: '8px', fontWeight: 700, color: '#334155' }}>
                      #{printDispatch?.dispatchNumber || printOrder.orderNumber}
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
                    <div style={{ fontSize: '8px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '1px' }}>Order Reference</div>
                    <div style={{ fontWeight: 800, marginTop: '5px', fontSize: '13px', color: '#0f172a' }}>{printOrder.orderNumber}</div>
                    <div style={{ fontSize: '10px', marginTop: '3px', color: '#475569' }}>
                      {printDispatch ? 'Sub-delivery quantities' : 'Initial delivery quantities'}
                    </div>
                    {printDispatch && (
                      <div style={{ fontSize: '10px', marginTop: '4px', color: '#0f172a', fontWeight: 600 }}>
                        🚛 Vehicle: {printDispatch.vehicleNumber || '—'} &nbsp;|&nbsp; Driver: {printDispatch.driverName || '—'}
                      </div>
                    )}
                    <style>{`
                      @media print {
                        body * {
                          visibility: hidden !important;
                        }

                        .print-challan-overlay,
                        .print-challan-overlay * {
                          visibility: visible !important;
                        }

                        .print-challan-overlay {
                          position: absolute !important;
                          inset: 0 !important;
                          display: block !important;
                          padding: 0 !important;
                          background: #fff !important;
                        }

                        .print-challan-modal {
                          width: 100% !important;
                          max-width: none !important;
                          max-height: none !important;
                          display: block !important;
                          box-shadow: none !important;
                        }

                        .print-challan-header {
                          display: none !important;
                        }

                        .print-challan-body {
                          overflow: visible !important;
                          padding: 0 !important;
                          background: #fff !important;
                        }

                        .print-challan-sheet {
                          margin: 0 auto !important;
                          box-shadow: none !important;
                          border-radius: 0 !important;
                        }
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
                  Delivery quantities are recorded in pieces for inventory and fulfillment tracking. Packet quantities are shown only when configured on the product/order.
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

      {/* ── PRINT-ONLY CHALLAN (hidden on screen) ──────────────────────── */}
      {printOrder && printProgress && (
        <div id="angel-print-sales-challan" style={{ display: 'none' }}>
          <div style={{ fontFamily: 'Arial, sans-serif', width: '210mm', minHeight: '297mm', padding: '14mm 16mm', boxSizing: 'border-box', color: '#0f172a', background: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #2563eb', paddingBottom: '12px', marginBottom: '14px' }}>
              <div>
                <div style={{ fontSize: '22px', fontWeight: 800, color: '#1e3a8a' }}>ANGEL PET</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '17px', fontWeight: 800, color: '#1e3a8a' }}>
                  {printDispatch ? 'SUB-DELIVERY CHALLAN' : 'DELIVERY CHALLAN'}
                </div>
                <div style={{ fontSize: '10px', marginTop: '5px' }}>
                  {printDispatch?.dispatchNumber || printOrder.orderNumber}
                </div>
                <div style={{ fontSize: '10px', color: '#64748b' }}>
                  Date: {formatDate(printDispatch?.dispatchDate || printOrder.orderDate)}
                </div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '9px', borderRadius: '5px' }}>
                <div style={{ fontSize: '8px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Customer</div>
                <div style={{ fontWeight: 700, marginTop: '4px' }}>{printOrder.companyName || printOrder.customerName}</div>
                <div style={{ fontSize: '10px', marginTop: '2px' }}>{printOrder.customerName}</div>
              </div>
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '9px', borderRadius: '5px' }}>
                <div style={{ fontSize: '8px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Order reference</div>
                <div style={{ fontWeight: 700, marginTop: '4px' }}>{printOrder.orderNumber}</div>
                <div style={{ fontSize: '10px', marginTop: '2px' }}>{printDispatch ? 'Latest sub-delivery quantities' : 'Initial delivery quantities'}</div>
              </div>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
              <thead>
                <tr style={{ background: '#1e3a8a', color: '#fff' }}>
                  {['Product', 'Ordered (pcs)', 'Delivered (pcs)', 'Current delivery', 'Remaining (pcs)'].map((heading) => (
                    <th key={heading} style={{ padding: '8px 6px', textAlign: heading === 'Product' ? 'left' : 'center' }}>{heading}</th>
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
                  return (
                    <tr key={orderItem.productId} style={{ background: index % 2 === 0 ? '#fff' : '#f8fafc' }}>
                      <td style={{ padding: '8px 6px', borderBottom: '1px solid #e2e8f0', fontWeight: 700 }}>
                        {orderItem.productName}<div style={{ fontSize: '8px', fontWeight: 400, color: '#64748b' }}>{unitText}</div>
                      </td>
                      <td style={{ padding: '8px 6px', borderBottom: '1px solid #e2e8f0', textAlign: 'center' }}>{formatNumberDisplay(orderItem.quantity)}</td>
                      <td style={{ padding: '8px 6px', borderBottom: '1px solid #e2e8f0', textAlign: 'center' }}>{formatNumberDisplay(progress?.deliveredQuantity || 0)}</td>
                      <td style={{ padding: '8px 6px', borderBottom: '1px solid #e2e8f0', textAlign: 'center', fontWeight: 700 }}>
                        {formatNumberDisplay(displayQuantity)} {displayUnit}
                        {displayUnit === 'packets' && <span> + {formatNumberDisplay(dispatchItem?.loosePieces ?? orderItem.loosePieces ?? 0)} loose</span>}
                        {displayUnit === 'packets' && <div style={{ fontSize: '8px', fontWeight: 400 }}>({formatNumberDisplay(currentPieces)} pieces)</div>}
                      </td>
                      <td style={{ padding: '8px 6px', borderBottom: '1px solid #e2e8f0', textAlign: 'center' }}>{formatNumberDisplay(progress?.remainingQuantity || 0)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div style={{ marginTop: '18px', fontSize: '10px', color: '#475569' }}>
              Delivery quantities are recorded in pieces for inventory and fulfillment tracking. Packet quantities are shown only when configured on the product/order.
            </div>
            {printDispatch && (
              <div style={{ marginTop: '10px', fontSize: '10px' }}>
                Vehicle: {printDispatch.vehicleNumber || 'Pending'} &nbsp; | &nbsp; Driver: {printDispatch.driverName || 'Pending'}
              </div>
            )}
            <div style={{ marginTop: '54px', display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
              <span>Authorized Signatory</span><span>Receiver's Signature & Stamp</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
