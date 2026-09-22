import React, { useState, useEffect } from 'react';
import { Dispatch, DispatchStatus, Order } from '../types';
import { getDispatches, updateDispatchStatus, getOrders } from '../services/db';
import { Badge } from '../components/common/Badge';
import {
  Truck,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  User,
  MapPin,
  Calendar,
  Printer
} from 'lucide-react';

interface DispatchProps {
  onOpenNewDispatchModal: () => void;
}

// ── Number-to-words helper (Indian numbering) ─────────────────────────────────
const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function numToWords(n: number): string {
  if (n === 0) return 'Zero';
  if (n < 0) return 'Minus ' + numToWords(-n);
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : '');
  if (n < 1000) return ONES[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + numToWords(n % 100) : '');
  if (n < 100000) return numToWords(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + numToWords(n % 1000) : '');
  if (n < 10000000) return numToWords(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + numToWords(n % 100000) : '');
  return numToWords(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + numToWords(n % 10000000) : '');
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', {
      day: '2-digit', month: 'long', year: 'numeric'
    });
  } catch {
    return dateStr;
  }
}

// ── Inline styles for print challan ──────────────────────────────────────────
const S = {
  page: {
    fontFamily: "'Segoe UI', Arial, sans-serif",
    fontSize: '11px',
    color: '#1a1a2e',
    background: '#fff',
    width: '210mm',
    minHeight: '297mm',
    margin: '0 auto',
    padding: '14mm 16mm 10mm',
    boxSizing: 'border-box' as const,
  },
  headerCell: { verticalAlign: 'top' as const },
  brandBox: {
    display: 'inline-block',
    background: 'linear-gradient(135deg,#1e3a8a 0%,#2563eb 100%)',
    borderRadius: '8px',
    padding: '10px 18px',
    marginBottom: '6px',
  },
  brandTitle: { color: '#fff', fontWeight: '900' as const, fontSize: '18px', letterSpacing: '0.5px', lineHeight: 1.1 },
  brandSub: { color: '#bfdbfe', fontWeight: '600' as const, fontSize: '9px', letterSpacing: '2px', marginTop: '2px' },
  companyMeta: { fontSize: '9px', color: '#475569', lineHeight: 1.6, marginTop: '4px' },
  challanBox: {
    background: '#f0f9ff',
    border: '2px solid #2563eb',
    borderRadius: '8px',
    padding: '10px 16px',
    display: 'inline-block',
    minWidth: '180px',
  },
  challanTitle: { color: '#1e3a8a', fontWeight: '900' as const, fontSize: '18px', letterSpacing: '1px' },
  divider: { height: '2px', background: 'linear-gradient(90deg,#2563eb 0%,#bfdbfe 100%)', borderRadius: '2px', marginBottom: '10px' },
  infoBox: {
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '6px',
    padding: '8px 12px',
  },
  infoLabel: { fontSize: '8px', fontWeight: '800' as const, color: '#94a3b8', letterSpacing: '1.5px', textTransform: 'uppercase' as const, marginBottom: '5px' },
  thBase: {
    color: '#fff',
    fontWeight: '700' as const,
    fontSize: '9px',
    letterSpacing: '0.8px',
    textTransform: 'uppercase' as const,
    padding: '8px 10px',
  },
  footer: {
    borderTop: '1px solid #e2e8f0',
    paddingTop: '6px',
    textAlign: 'center' as const,
    fontSize: '8px',
    color: '#94a3b8',
  },
} as const;

export const DispatchPage: React.FC<DispatchProps> = ({ onOpenNewDispatchModal }) => {
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [selectedDispatch, setSelectedDispatch] = useState<Dispatch | null>(null);
  const [linkedOrder, setLinkedOrder] = useState<Order | null>(null);

  useEffect(() => {
    loadDispatches();
  }, []);

  const loadDispatches = async () => {
    setLoading(true);
    try {
      const list = await getDispatches();
      setDispatches(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (id: string, newStatus: DispatchStatus) => {
    try {
      await updateDispatchStatus(id, newStatus);
      loadDispatches();
    } catch (e) {
      console.error(e);
    }
  };

  const handlePrintChallan = async (dispatch: Dispatch) => {
    setSelectedDispatch(dispatch);
    try {
      const orders = await getOrders();
      const order = orders.find(o => o.id === dispatch.orderId || o.orderNumber === dispatch.orderNumber);
      setLinkedOrder(order || null);
      // Trigger print after state updates
      setTimeout(() => window.print(), 100);
    } catch (e) {
      console.error('Error loading order for challan:', e);
    }
  };

  const filteredDispatches = dispatches.filter((d) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      d.dispatchNumber.toLowerCase().includes(q) ||
      d.orderNumber.toLowerCase().includes(q) ||
      d.customerName.toLowerCase().includes(q) ||
      (d.vehicleNumber && d.vehicleNumber.toLowerCase().includes(q)) ||
      (d.driverName && d.driverName.toLowerCase().includes(q));

    const matchesStatus = statusFilter === 'all' || d.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">

      {/* ═══════════════════════════════════════════════════════════════════
          PRINT-ONLY PROFESSIONAL A4 DELIVERY CHALLAN
          Hidden on screen via `display:none`.
          The @media print rule in index.css flips visibility:
            – hides  #angel-erp-screen
            – shows  #angel-print-challan
          All styles are inline for print reliability.
      ═══════════════════════════════════════════════════════════════════ */}
      {selectedDispatch && (
        <div id="angel-print-challan" style={{ display: 'none' }}>
          <div style={S.page}>

            {/* ── HEADER ─────────────────────────────────────────────────── */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '10px' }}>
              <tbody>
                <tr>
                  {/* LEFT: Branding */}
                  <td style={{ ...S.headerCell, width: '55%' }}>
                    <div style={S.brandBox}>
                      <div style={S.brandTitle}>🐾 ANGEL PET</div>
                      <div style={S.brandSub}>PACKAGING SOLUTIONS PVT LTD</div>
                    </div>
                    <div style={S.companyMeta}>
                      <div>Plot 108, GIDC Industrial Estate, Makarpura</div>
                      <div>Vadodara, Gujarat – 390010</div>
                      <div>📞 +91 98250 99887 &nbsp;|&nbsp; ✉ sales@angelpetpackaging.com</div>
                      <div style={{ marginTop: '2px' }}>
                        <strong style={{ color: '#1e40af' }}>GSTIN:</strong>&nbsp;24AAACA1234B1Z9
                      </div>
                    </div>
                  </td>

                  {/* RIGHT: Challan meta box */}
                  <td style={{ ...S.headerCell, textAlign: 'right' }}>
                    <div style={S.challanBox}>
                      <div style={S.challanTitle}>DELIVERY CHALLAN</div>
                      <div style={{ marginTop: '6px', borderTop: '1px solid #bfdbfe', paddingTop: '6px' }}>
                        <table style={{ width: '100%', fontSize: '9.5px', borderCollapse: 'collapse' }}>
                          <tbody>
                            <tr>
                              <td style={{ color: '#64748b', paddingBottom: '2px' }}>Challan No.</td>
                              <td style={{ fontWeight: '800', color: '#1e3a8a', textAlign: 'right' }}>{selectedDispatch.dispatchNumber}</td>
                            </tr>
                            <tr>
                              <td style={{ color: '#64748b' }}>Date</td>
                              <td style={{ fontWeight: '700', textAlign: 'right' }}>{formatDate(selectedDispatch.dispatchDate)}</td>
                            </tr>
                            <tr>
                              <td style={{ color: '#64748b', paddingTop: '2px' }}>Status</td>
                              <td style={{
                                fontWeight: '700', textAlign: 'right', textTransform: 'capitalize',
                                color: selectedDispatch.status === 'delivered' ? '#16a34a'
                                  : selectedDispatch.status === 'dispatched' ? '#d97706' : '#64748b'
                              }}>
                                {selectedDispatch.status}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Gradient divider */}
            <div style={S.divider} />

            {/* ── BILL-TO + ORDER INFO ──────────────────────────────────── */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '10px' }}>
              <tbody>
                <tr>
                  <td style={{ width: '50%', verticalAlign: 'top', paddingRight: '8px' }}>
                    <div style={S.infoBox}>
                      <div style={S.infoLabel}>Consignee (Customer)</div>
                      <div style={{ fontWeight: '800', fontSize: '13px', color: '#0f172a', marginBottom: '2px' }}>
                        {selectedDispatch.customerName}
                      </div>
                      {linkedOrder && (
                        <div style={{ color: '#475569', fontSize: '10px' }}>Company: {linkedOrder.companyName}</div>
                      )}
                    </div>
                  </td>
                  <td style={{ width: '50%', verticalAlign: 'top', paddingLeft: '8px' }}>
                    <div style={S.infoBox}>
                      <div style={S.infoLabel}>Order Reference</div>
                      <table style={{ width: '100%', fontSize: '10px', borderCollapse: 'collapse' }}>
                        <tbody>
                          <tr>
                            <td style={{ color: '#475569', paddingBottom: '2px' }}>Order No:</td>
                            <td style={{ fontWeight: '700', textAlign: 'right', color: '#1e3a8a' }}>{selectedDispatch.orderNumber}</td>
                          </tr>
                          {linkedOrder && (
                            <>
                              <tr>
                                <td style={{ color: '#475569', paddingBottom: '2px' }}>Order Date:</td>
                                <td style={{ fontWeight: '600', textAlign: 'right' }}>{formatDate(linkedOrder.orderDate)}</td>
                              </tr>
                              <tr>
                                <td style={{ color: '#475569' }}>Order Status:</td>
                                <td style={{
                                  fontWeight: '700', textAlign: 'right', textTransform: 'capitalize',
                                  color: linkedOrder.orderStatus === 'completed' ? '#16a34a'
                                    : linkedOrder.orderStatus === 'cancelled' ? '#dc2626' : '#d97706'
                                }}>
                                  {linkedOrder.orderStatus}
                                </td>
                              </tr>
                            </>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>

            {/* ── VEHICLE & DRIVER INFO ──────────────────────────────────── */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '10px' }}>
              <tbody>
                <tr>
                  <td style={{ width: '50%', verticalAlign: 'top', paddingRight: '8px' }}>
                    <div style={S.infoBox}>
                      <div style={S.infoLabel}>Vehicle Information</div>
                      <table style={{ width: '100%', fontSize: '10px', borderCollapse: 'collapse' }}>
                        <tbody>
                          <tr>
                            <td style={{ color: '#475569', paddingBottom: '2px' }}>Vehicle No:</td>
                            <td style={{ fontWeight: '700', textAlign: 'right', color: '#0f172a' }}>
                              {selectedDispatch.vehicleNumber || 'Pending'}
                            </td>
                          </tr>
                          <tr>
                            <td style={{ color: '#475569' }}>Driver Name:</td>
                            <td style={{ fontWeight: '600', textAlign: 'right' }}>
                              {selectedDispatch.driverName || 'Pending'}
                            </td>
                          </tr>
                          {selectedDispatch.driverPhone && (
                            <tr>
                              <td style={{ color: '#475569' }}>Driver Phone:</td>
                              <td style={{ fontWeight: '600', textAlign: 'right' }}>
                                {selectedDispatch.driverPhone}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </td>
                  <td style={{ width: '50%', verticalAlign: 'top', paddingLeft: '8px' }}>
                    {selectedDispatch.notes && (
                      <div style={S.infoBox}>
                        <div style={S.infoLabel}>Notes</div>
                        <div style={{ fontSize: '9px', color: '#475569', lineHeight: 1.4 }}>
                          {selectedDispatch.notes}
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* ── ITEMS TABLE ────────────────────────────────────────────── */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '4px' }}>
              <thead>
                <tr style={{ background: '#1e3a8a' }}>
                  <th style={{ ...S.thBase, textAlign: 'left', width: '4%' }}>#</th>
                  <th style={{ ...S.thBase, textAlign: 'left' }}>Product Name</th>
                  <th style={{ ...S.thBase, textAlign: 'center', width: '12%' }}>Quantity</th>
                  <th style={{ ...S.thBase, textAlign: 'center', width: '12%' }}>Unit</th>
                </tr>
              </thead>
              <tbody>
                {selectedDispatch.items.map((item, idx) => {
                  // Get product unit from linked order if available, otherwise default to 'pcs'
                  const orderItem = linkedOrder?.items.find(oi => oi.productId === item.productId);
                  const productUnit = 'pcs'; // Default unit as products are measured in pieces
                  return (
                    <tr key={idx} style={{ background: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                      <td style={{ padding: '7px 10px', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontWeight: '600' }}>
                        {idx + 1}
                      </td>
                      <td style={{ padding: '7px 10px', borderBottom: '1px solid #e2e8f0', fontWeight: '700', color: '#0f172a' }}>
                        {item.productName}
                      </td>
                      <td style={{ padding: '7px 10px', borderBottom: '1px solid #e2e8f0', textAlign: 'center', fontWeight: '700', color: '#0f172a' }}>
                        {item.quantity.toLocaleString('en-IN')}
                      </td>
                      <td style={{ padding: '7px 10px', borderBottom: '1px solid #e2e8f0', textAlign: 'center', color: '#475569', fontWeight: '600' }}>
                        {productUnit}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* ── TOTALS ─────────────────────────────────────────────────── */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '10px' }}>
              <tbody>
                <tr>
                  <td style={{ width: '70%', verticalAlign: 'top' }}>
                    <div style={{ fontSize: '9px', color: '#475569', lineHeight: 1.4 }}>
                      <strong>Total Items:</strong> {selectedDispatch.items.length}
                      <br />
                      <strong>Total Quantity:</strong> {selectedDispatch.items.reduce((sum, item) => sum + item.quantity, 0).toLocaleString('en-IN')} units
                    </div>
                  </td>
                  <td style={{ width: '30%', verticalAlign: 'top' }}>
                    <div style={S.infoBox}>
                      <div style={{ fontSize: '9px', color: '#475569', marginBottom: '2px' }}>Total Quantity</div>
                      <div style={{ fontSize: '16px', fontWeight: '800', color: '#1e3a8a', textAlign: 'right' }}>
                        {selectedDispatch.items.reduce((sum, item) => sum + item.quantity, 0).toLocaleString('en-IN')}
                      </div>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>

            {/* ── SIGNATURE SECTION ───────────────────────────────────────── */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '20px' }}>
              <tbody>
                <tr>
                  <td style={{ width: '50%', verticalAlign: 'top', paddingRight: '8px' }}>
                    <div style={{ borderTop: '1px solid #1e3a8a', paddingTop: '8px', textAlign: 'center' }}>
                      <div style={{ fontSize: '9px', fontWeight: '700', color: '#1e3a8a', marginBottom: '4px' }}>
                        Authorized Signature
                      </div>
                      <div style={{ fontSize: '8px', color: '#64748b' }}>
                        For Angel Pet Packaging Solutions Pvt Ltd
                      </div>
                    </div>
                  </td>
                  <td style={{ width: '50%', verticalAlign: 'top', paddingLeft: '8px' }}>
                    <div style={{ borderTop: '1px solid #1e3a8a', paddingTop: '8px', textAlign: 'center' }}>
                      <div style={{ fontSize: '9px', fontWeight: '700', color: '#1e3a8a', marginBottom: '4px' }}>
                        Receiver's Signature
                      </div>
                      <div style={{ fontSize: '8px', color: '#64748b' }}>
                        {selectedDispatch.customerName}
                      </div>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>

            {/* ── FOOTER ─────────────────────────────────────────────────── */}
            <div style={S.footer}>
              <div>This is a computer-generated Delivery Challan. No signature required.</div>
              <div style={{ marginTop: '2px' }}>Generated by Angel Pet Packaging Solutions ERP System</div>
            </div>

          </div>
        </div>
      )}
      {/* Title & Action Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Dispatch & Logistics</h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Log lorry shipments, driver contacts, and update inventory upon completion
          </p>
        </div>

        <button
          onClick={onOpenNewDispatchModal}
          className="px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs rounded-xl shadow-md shadow-sky-500/20 transition-colors flex items-center space-x-2 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>New Dispatch</span>
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search dispatch ID, vehicle or driver..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 text-xs font-medium text-slate-800 rounded-xl border border-slate-200 focus:bg-white"
          />
        </div>

        <div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 text-xs font-medium text-slate-700 rounded-xl border border-slate-200 focus:bg-white"
          >
            <option value="all">All Dispatch Statuses</option>
            <option value="pending">Pending Preparation</option>
            <option value="ready">Ready for Pickup</option>
            <option value="dispatched">Dispatched (In Transit)</option>
            <option value="delivered">Delivered / Completed</option>
          </select>
        </div>
      </div>

      {/* Dispatch Table */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="py-3.5 px-4">Dispatch ID</th>
                <th className="py-3.5 px-4">Order ID</th>
                <th className="py-3.5 px-4">Customer Name</th>
                <th className="py-3.5 px-4">Items Shipped</th>
                <th className="py-3.5 px-4">Vehicle & Driver</th>
                <th className="py-3.5 px-4">Dispatch Date</th>
                <th className="py-3.5 px-4">Shipment Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
              {filteredDispatches.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 font-medium">
                    No dispatch shipments found matching criteria.
                  </td>
                </tr>
              ) : (
                filteredDispatches.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-sky-600">{d.dispatchNumber}</td>
                    <td className="py-3.5 px-4 font-bold text-blue-600">{d.orderNumber}</td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">{d.customerName}</td>
                    <td className="py-3.5 px-4">
                      <div className="truncate max-w-[200px]">
                        {d.items.map((i) => `${i.quantity.toLocaleString()}x ${i.productName}`).join(', ')}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900">{d.vehicleNumber || 'Pending Vehicle'}</div>
                      <div className="text-[11px] text-slate-400">{d.driverName || 'No Driver'}</div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-500">{d.dispatchDate}</td>
                    <td className="py-3.5 px-4">
                      <Badge status={d.status} />
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handlePrintChallan(d)}
                          className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-[11px] font-semibold text-slate-700 rounded-lg border border-slate-200 transition-colors flex items-center gap-1"
                          title="Print Delivery Challan"
                        >
                          <Printer className="w-3 h-3" />
                          <span>Print</span>
                        </button>
                        <select
                          value={d.status}
                          onChange={(e) => handleStatusChange(d.id, e.target.value as DispatchStatus)}
                          className="px-2 py-1 bg-slate-100 text-[11px] font-semibold text-slate-800 rounded-lg border border-slate-200 focus:bg-white"
                        >
                          <option value="pending">Pending</option>
                          <option value="ready">Ready</option>
                          <option value="dispatched">Dispatched</option>
                          <option value="delivered">Delivered</option>
                        </select>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
