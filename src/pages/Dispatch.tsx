import React, { useState, useEffect } from 'react';
import { Dispatch, DispatchStatus, Order } from '../types';
import { getDispatches, updateDispatchStatus, getOrders } from '../services/db';
import { getOrderDeliveryProgress, OrderDeliveryProgress } from '../utils/dispatchUtils';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import {
  Truck,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  User,
  MapPin,
  Calendar,
  Printer,
  FileCheck,
  Package,
  Layers,
  History,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface DispatchProps {
  onOpenNewDispatchModal: () => void;
  onOpenNewDispatchModalWithOrder?: (orderId: string) => void;
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
  challanTitle: { color: '#1e3a8a', fontWeight: '900' as const, fontSize: '16px', letterSpacing: '0.8px' },
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

export const DispatchPage: React.FC<DispatchProps> = ({
  onOpenNewDispatchModal
}) => {
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  // Print States
  const [printType, setPrintType] = useState<'sub_challan' | 'final_challan'>('sub_challan');
  const [selectedDispatch, setSelectedDispatch] = useState<Dispatch | null>(null);
  const [linkedOrder, setLinkedOrder] = useState<Order | null>(null);
  const [finalOrderProgress, setFinalOrderProgress] = useState<OrderDeliveryProgress | null>(null);

  // History Modal State
  const [historyOrder, setHistoryOrder] = useState<Order | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [dList, oList] = await Promise.all([getDispatches(), getOrders()]);
      setDispatches(dList);
      setOrders(oList);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (id: string, newStatus: DispatchStatus) => {
    try {
      await updateDispatchStatus(id, newStatus);
      loadData();
    } catch (e) {
      console.error(e);
    }
  };

  const handlePrintSubChallan = (dispatch: Dispatch) => {
    setSelectedDispatch(dispatch);
    setPrintType('sub_challan');
    const order = orders.find(
      (o) => o.id === dispatch.orderId || o.orderNumber === dispatch.orderNumber
    );
    setLinkedOrder(order || null);
    setTimeout(() => window.print(), 120);
  };

  const handlePrintFinalChallan = (order: Order) => {
    const progress = getOrderDeliveryProgress(order, dispatches);
    setFinalOrderProgress(progress);
    setLinkedOrder(order);
    setPrintType('final_challan');
    setTimeout(() => window.print(), 120);
  };

  // Order Delivery Progress list
  const ordersWithProgress = orders
    .filter((o) => o.orderStatus !== 'cancelled')
    .map((order) => {
      const progress = getOrderDeliveryProgress(order, dispatches);
      return {
        order,
        progress
      };
    });

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
          PRINT-ONLY PROFESSIONAL A4 SUB-DELIVERY CHALLAN
      ═══════════════════════════════════════════════════════════════════ */}
      {printType === 'sub_challan' && selectedDispatch && (
        <div id="angel-print-challan" style={{ display: 'none' }}>
          <div style={S.page}>

            {/* ── HEADER ─────────────────────────────────────────────────── */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '10px' }}>
              <tbody>
                <tr>
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

                  <td style={{ ...S.headerCell, textAlign: 'right' }}>
                    <div style={S.challanBox}>
                      <div style={S.challanTitle}>SUB-DELIVERY CHALLAN</div>
                      <div style={{ marginTop: '6px', borderTop: '1px solid #bfdbfe', paddingTop: '6px' }}>
                        <table style={{ width: '100%', fontSize: '9.5px', borderCollapse: 'collapse' }}>
                          <tbody>
                            <tr>
                              <td style={{ color: '#64748b', paddingBottom: '2px' }}>Challan No.</td>
                              <td style={{ fontWeight: '800', color: '#1e3a8a', textAlign: 'right' }}>
                                {selectedDispatch.dispatchNumber}
                              </td>
                            </tr>
                            <tr>
                              <td style={{ color: '#64748b' }}>Delivery Date</td>
                              <td style={{ fontWeight: '700', textAlign: 'right' }}>
                                {formatDate(selectedDispatch.dispatchDate)}
                              </td>
                            </tr>
                            <tr>
                              <td style={{ color: '#64748b', paddingTop: '2px' }}>Status</td>
                              <td
                                style={{
                                  fontWeight: '700',
                                  textAlign: 'right',
                                  textTransform: 'capitalize',
                                  color:
                                    selectedDispatch.status === 'delivered'
                                      ? '#16a34a'
                                      : selectedDispatch.status === 'dispatched'
                                      ? '#d97706'
                                      : '#64748b'
                                }}
                              >
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

            <div style={S.divider} />

            {/* ── CONSIGNEE + ORDER REFERENCE ────────────────────────────── */}
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
                            <td style={{ fontWeight: '700', textAlign: 'right', color: '#1e3a8a' }}>
                              {selectedDispatch.orderNumber}
                            </td>
                          </tr>
                          {linkedOrder?.orderType === 'AS' && (
                            <tr>
                              <td style={{ color: '#475569', paddingBottom: '2px' }}>Order Type:</td>
                              <td style={{ fontWeight: '700', textAlign: 'right', color: '#d97706' }}>
                                AS Order (Non-Commercial)
                              </td>
                            </tr>
                          )}
                          {linkedOrder && (
                            <tr>
                              <td style={{ color: '#475569' }}>Order Date:</td>
                              <td style={{ fontWeight: '600', textAlign: 'right' }}>
                                {formatDate(linkedOrder.orderDate)}
                              </td>
                            </tr>
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
                      <div style={S.infoLabel}>Vehicle & Logistics</div>
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
                    {selectedDispatch.notes ? (
                      <div style={S.infoBox}>
                        <div style={S.infoLabel}>Delivery Notes / LR No</div>
                        <div style={{ fontSize: '9.5px', color: '#475569', lineHeight: 1.4 }}>
                          {selectedDispatch.notes}
                        </div>
                      </div>
                    ) : (
                      <div style={S.infoBox}>
                        <div style={S.infoLabel}>Sub-Delivery Note</div>
                        <div style={{ fontSize: '9px', color: '#64748b' }}>
                          This sub-challan covers only the products and quantities listed below for this shipment trip.
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* ── ITEMS DELIVERED IN THIS SHIPMENT ───────────────────────── */}
            <div style={{ fontWeight: '800', fontSize: '10px', color: '#1e3a8a', textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '0.5px' }}>
              Items Delivered in this Sub-Challan
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '6px' }}>
              <thead>
                <tr style={{ background: '#1e3a8a' }}>
                  <th style={{ ...S.thBase, textAlign: 'left', width: '6%' }}>#</th>
                  <th style={{ ...S.thBase, textAlign: 'left' }}>Product Description</th>
                  <th style={{ ...S.thBase, textAlign: 'center', width: '16%' }}>Delivered Qty</th>
                  <th style={{ ...S.thBase, textAlign: 'center', width: '12%' }}>Unit</th>
                </tr>
              </thead>
              <tbody>
                {selectedDispatch.items.map((item, idx) => (
                  <tr key={idx} style={{ background: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                    <td style={{ padding: '7px 10px', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontWeight: '600' }}>
                      {idx + 1}
                    </td>
                    <td style={{ padding: '7px 10px', borderBottom: '1px solid #e2e8f0', fontWeight: '700', color: '#0f172a' }}>
                      {item.productName}
                    </td>
                    <td style={{ padding: '7px 10px', borderBottom: '1px solid #e2e8f0', textAlign: 'center', fontWeight: '800', color: '#0f172a', fontSize: '12px' }}>
                      {item.quantity.toLocaleString('en-IN')}
                    </td>
                    <td style={{ padding: '7px 10px', borderBottom: '1px solid #e2e8f0', textAlign: 'center', color: '#475569', fontWeight: '600' }}>
                      pcs
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* ── TOTALS ─────────────────────────────────────────────────── */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '12px' }}>
              <tbody>
                <tr>
                  <td style={{ width: '65%', verticalAlign: 'top' }}>
                    <div style={{ fontSize: '9.5px', color: '#475569', lineHeight: 1.5 }}>
                      <strong>Total Units in this Sub-Delivery:</strong>{' '}
                      {numToWords(selectedDispatch.items.reduce((s, i) => s + i.quantity, 0))} Units Only
                    </div>
                  </td>
                  <td style={{ width: '35%', verticalAlign: 'top' }}>
                    <div style={S.infoBox}>
                      <div style={{ fontSize: '8px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>
                        This Shipment Total
                      </div>
                      <div style={{ fontSize: '15px', fontWeight: '800', color: '#1e3a8a', textAlign: 'right' }}>
                        {selectedDispatch.items.reduce((sum, item) => sum + item.quantity, 0).toLocaleString('en-IN')} Units
                      </div>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>

            {/* ── SIGNATURES ─────────────────────────────────────────────── */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '24px' }}>
              <tbody>
                <tr>
                  <td style={{ width: '50%', verticalAlign: 'top', paddingRight: '8px' }}>
                    <div style={{ borderTop: '1px solid #1e3a8a', paddingTop: '8px', textAlign: 'center' }}>
                      <div style={{ fontSize: '9px', fontWeight: '700', color: '#1e3a8a', marginBottom: '4px' }}>
                        Authorized Signatory
                      </div>
                      <div style={{ fontSize: '8px', color: '#64748b' }}>
                        For Angel Pet Packaging Solutions Pvt Ltd
                      </div>
                    </div>
                  </td>
                  <td style={{ width: '50%', verticalAlign: 'top', paddingLeft: '8px' }}>
                    <div style={{ borderTop: '1px solid #1e3a8a', paddingTop: '8px', textAlign: 'center' }}>
                      <div style={{ fontSize: '9px', fontWeight: '700', color: '#1e3a8a', marginBottom: '4px' }}>
                        Receiver's Signature & Stamp
                      </div>
                      <div style={{ fontSize: '8px', color: '#64748b' }}>
                        {selectedDispatch.customerName}
                      </div>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>

            <div style={S.footer}>
              <div>This is a computer-generated Sub-Delivery Challan. No signature required.</div>
              <div style={{ marginTop: '2px' }}>Generated by Angel Pet Packaging Solutions ERP System</div>
            </div>

          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          PRINT-ONLY PROFESSIONAL A4 FINAL CONSOLIDATED CHALLAN
      ═══════════════════════════════════════════════════════════════════ */}
      {printType === 'final_challan' && finalOrderProgress && linkedOrder && (
        <div id="angel-print-challan" style={{ display: 'none' }}>
          <div style={S.page}>

            {/* ── HEADER ─────────────────────────────────────────────────── */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '10px' }}>
              <tbody>
                <tr>
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

                  <td style={{ ...S.headerCell, textAlign: 'right' }}>
                    <div style={{ ...S.challanBox, borderColor: '#16a34a', background: '#f0fdf4' }}>
                      <div style={{ ...S.challanTitle, color: '#166534' }}>FINAL CONSOLIDATED CHALLAN</div>
                      <div style={{ marginTop: '6px', borderTop: '1px solid #bbf7d0', paddingTop: '6px' }}>
                        <table style={{ width: '100%', fontSize: '9.5px', borderCollapse: 'collapse' }}>
                          <tbody>
                            <tr>
                              <td style={{ color: '#64748b', paddingBottom: '2px' }}>Order No.</td>
                              <td style={{ fontWeight: '800', color: '#166534', textAlign: 'right' }}>
                                {linkedOrder.orderNumber}
                              </td>
                            </tr>
                            <tr>
                              <td style={{ color: '#64748b' }}>Completion Date</td>
                              <td style={{ fontWeight: '700', textAlign: 'right' }}>
                                {formatDate(new Date().toISOString().split('T')[0])}
                              </td>
                            </tr>
                            <tr>
                              <td style={{ color: '#64748b', paddingTop: '2px' }}>Fulfillment</td>
                              <td style={{ fontWeight: '800', textAlign: 'right', color: '#16a34a' }}>
                                100% Fulfilled
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

            <div style={{ height: '2px', background: 'linear-gradient(90deg,#16a34a 0%,#bbf7d0 100%)', borderRadius: '2px', marginBottom: '10px' }} />

            {/* ── CONSIGNEE & ORDER REFERENCE ────────────────────────────── */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '10px' }}>
              <tbody>
                <tr>
                  <td style={{ width: '50%', verticalAlign: 'top', paddingRight: '8px' }}>
                    <div style={S.infoBox}>
                      <div style={S.infoLabel}>Consignee (Customer)</div>
                      <div style={{ fontWeight: '800', fontSize: '13px', color: '#0f172a', marginBottom: '2px' }}>
                        {linkedOrder.customerName}
                      </div>
                      <div style={{ color: '#475569', fontSize: '10px' }}>Company: {linkedOrder.companyName}</div>
                    </div>
                  </td>
                  <td style={{ width: '50%', verticalAlign: 'top', paddingLeft: '8px' }}>
                    <div style={S.infoBox}>
                      <div style={S.infoLabel}>Consolidated Delivery Summary</div>
                      <table style={{ width: '100%', fontSize: '10px', borderCollapse: 'collapse' }}>
                        <tbody>
                          <tr>
                            <td style={{ color: '#475569', paddingBottom: '2px' }}>Total Sub-Challans:</td>
                            <td style={{ fontWeight: '700', textAlign: 'right', color: '#0f172a' }}>
                              {finalOrderProgress.subDeliveries.length} Shipments
                            </td>
                          </tr>
                          <tr>
                            <td style={{ color: '#475569', paddingBottom: '2px' }}>Total Units Delivered:</td>
                            <td style={{ fontWeight: '800', textAlign: 'right', color: '#16a34a' }}>
                              {finalOrderProgress.totalDeliveredQuantity.toLocaleString()} Units
                            </td>
                          </tr>
                          <tr>
                            <td style={{ color: '#475569' }}>Balance Remaining:</td>
                            <td style={{ fontWeight: '700', textAlign: 'right', color: '#16a34a' }}>
                              0 Units (Fully Dispatched)
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>

            {/* ── CONSOLIDATED PRODUCT FULFILLMENT ───────────────────────── */}
            <div style={{ fontWeight: '800', fontSize: '10px', color: '#166534', textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '0.5px' }}>
              Consolidated Products Ordered & Delivered
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '12px' }}>
              <thead>
                <tr style={{ background: '#166534' }}>
                  <th style={{ ...S.thBase, textAlign: 'left', width: '6%' }}>#</th>
                  <th style={{ ...S.thBase, textAlign: 'left' }}>Product Name</th>
                  <th style={{ ...S.thBase, textAlign: 'center', width: '16%' }}>Ordered Qty</th>
                  <th style={{ ...S.thBase, textAlign: 'center', width: '16%' }}>Total Delivered</th>
                  <th style={{ ...S.thBase, textAlign: 'center', width: '14%' }}>Fulfillment</th>
                </tr>
              </thead>
              <tbody>
                {finalOrderProgress.items.map((item, idx) => (
                  <tr key={idx} style={{ background: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                    <td style={{ padding: '7px 10px', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontWeight: '600' }}>
                      {idx + 1}
                    </td>
                    <td style={{ padding: '7px 10px', borderBottom: '1px solid #e2e8f0', fontWeight: '700', color: '#0f172a' }}>
                      {item.productName}
                    </td>
                    <td style={{ padding: '7px 10px', borderBottom: '1px solid #e2e8f0', textAlign: 'center', fontWeight: '700', color: '#475569' }}>
                      {item.orderedQuantity.toLocaleString('en-IN')}
                    </td>
                    <td style={{ padding: '7px 10px', borderBottom: '1px solid #e2e8f0', textAlign: 'center', fontWeight: '800', color: '#16a34a' }}>
                      {item.deliveredQuantity.toLocaleString('en-IN')}
                    </td>
                    <td style={{ padding: '7px 10px', borderBottom: '1px solid #e2e8f0', textAlign: 'center', fontWeight: '700', color: '#16a34a' }}>
                      100% Completed
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* ── SUB-DELIVERY / SUB-CHALLAN BREAKDOWN TABLE ─────────────── */}
            <div style={{ fontWeight: '800', fontSize: '10px', color: '#1e3a8a', textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '0.5px' }}>
              Sub-Delivery / Sub-Challan History Breakdown
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '12px' }}>
              <thead>
                <tr style={{ background: '#1e3a8a' }}>
                  <th style={{ ...S.thBase, textAlign: 'left', width: '15%' }}>Challan No</th>
                  <th style={{ ...S.thBase, textAlign: 'center', width: '15%' }}>Date</th>
                  <th style={{ ...S.thBase, textAlign: 'left', width: '20%' }}>Vehicle No</th>
                  <th style={{ ...S.thBase, textAlign: 'left', width: '18%' }}>Driver</th>
                  <th style={{ ...S.thBase, textAlign: 'center', width: '16%' }}>Delivered Qty</th>
                  <th style={{ ...S.thBase, textAlign: 'center', width: '16%' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {finalOrderProgress.subDeliveries.map((sub, idx) => {
                  const subTotal = sub.items.reduce((sum, i) => sum + i.quantity, 0);
                  return (
                    <tr key={idx} style={{ background: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                      <td style={{ padding: '6px 10px', borderBottom: '1px solid #e2e8f0', fontWeight: '800', color: '#1e3a8a' }}>
                        {sub.dispatchNumber}
                      </td>
                      <td style={{ padding: '6px 10px', borderBottom: '1px solid #e2e8f0', textAlign: 'center', color: '#475569' }}>
                        {formatDate(sub.dispatchDate)}
                      </td>
                      <td style={{ padding: '6px 10px', borderBottom: '1px solid #e2e8f0', color: '#0f172a', fontWeight: '600' }}>
                        {sub.vehicleNumber || 'N/A'}
                      </td>
                      <td style={{ padding: '6px 10px', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                        {sub.driverName || 'N/A'}
                      </td>
                      <td style={{ padding: '6px 10px', borderBottom: '1px solid #e2e8f0', textAlign: 'center', fontWeight: '700', color: '#0f172a' }}>
                        {subTotal.toLocaleString('en-IN')}
                      </td>
                      <td style={{ padding: '6px 10px', borderBottom: '1px solid #e2e8f0', textAlign: 'center', textTransform: 'capitalize', fontWeight: '600', color: sub.status === 'delivered' ? '#16a34a' : '#d97706' }}>
                        {sub.status}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* ── CONSOLIDATED SIGNATURES ─────────────────────────────────── */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '24px' }}>
              <tbody>
                <tr>
                  <td style={{ width: '50%', verticalAlign: 'top', paddingRight: '8px' }}>
                    <div style={{ borderTop: '1px solid #16a34a', paddingTop: '8px', textAlign: 'center' }}>
                      <div style={{ fontSize: '9px', fontWeight: '700', color: '#16a34a', marginBottom: '4px' }}>
                        Authorized ERP Signatory
                      </div>
                      <div style={{ fontSize: '8px', color: '#64748b' }}>
                        For Angel Pet Packaging Solutions Pvt Ltd
                      </div>
                    </div>
                  </td>
                  <td style={{ width: '50%', verticalAlign: 'top', paddingLeft: '8px' }}>
                    <div style={{ borderTop: '1px solid #16a34a', paddingTop: '8px', textAlign: 'center' }}>
                      <div style={{ fontSize: '9px', fontWeight: '700', color: '#16a34a', marginBottom: '4px' }}>
                        Consignee Final Acknowledgment
                      </div>
                      <div style={{ fontSize: '8px', color: '#64748b' }}>
                        {linkedOrder.customerName} ({linkedOrder.companyName})
                      </div>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>

            <div style={S.footer}>
              <div>This is a computer-generated Final Consolidated Delivery Challan. All sub-deliveries verified.</div>
              <div style={{ marginTop: '2px' }}>Generated by Angel Pet Packaging Solutions ERP System</div>
            </div>

          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          SCREEN UI: TITLE & ACTIONS
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Dispatch & Logistics</h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Manage multi-trip sub-deliveries, track remaining product quantities, and issue Sub-Challans
          </p>
        </div>

        <button
          onClick={onOpenNewDispatchModal}
          className="px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs rounded-xl shadow-md shadow-sky-500/20 transition-colors flex items-center space-x-2 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>New Sub-Delivery</span>
        </button>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 1: ORDER FULFILLMENT & REMAINING QUANTITIES
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-sky-600" />
              Order Delivery Progress & Remaining Balance
            </h2>
            <p className="text-xs text-slate-500">
              Track multi-shipment fulfillment per product line
            </p>
          </div>
          <span className="text-xs font-semibold text-slate-400">
            {ordersWithProgress.length} active manufacturing orders
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {ordersWithProgress.slice(0, 6).map(({ order, progress }) => {
            const percent =
              progress.totalOrderedQuantity > 0
                ? Math.min(100, Math.round((progress.totalDeliveredQuantity / progress.totalOrderedQuantity) * 100))
                : 0;

            return (
              <div
                key={order.id}
                className="p-4 rounded-2xl border border-slate-200/80 bg-slate-50/50 hover:bg-slate-50 transition-colors space-y-3 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <Link
                        to={`/sales/${order.id}`}
                        className="font-bold text-xs text-blue-600 hover:underline"
                      >
                        {order.orderNumber}
                      </Link>
                      {order.orderType === 'AS' && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                          AS
                        </span>
                      )}
                    </div>
                    <Badge status={order.orderStatus} />
                  </div>

                  <p className="text-xs font-bold text-slate-900 mt-1 truncate">
                    {order.companyName || order.customerName}
                  </p>

                  {/* Progress Bar */}
                  <div className="mt-2 space-y-1">
                    <div className="flex justify-between text-[11px] font-medium">
                      <span className="text-slate-500">Fulfillment:</span>
                      <span className="font-bold text-slate-800">{percent}%</span>
                    </div>
                    <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          progress.isFullyDelivered ? 'bg-emerald-500' : 'bg-sky-500'
                        }`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>

                  {/* Products breakdown */}
                  <div className="mt-3 divide-y divide-slate-200/60 text-[11px]">
                    {progress.items.map((item) => (
                      <div key={item.productId} className="py-1.5 flex items-center justify-between">
                        <span className="font-medium text-slate-700 truncate max-w-[140px]" title={item.productName}>
                          {item.productName}
                        </span>
                        <div className="text-right">
                          <span className="font-bold text-slate-900">{item.deliveredQuantity.toLocaleString()}</span>
                          <span className="text-slate-400"> / {item.orderedQuantity.toLocaleString()}</span>
                          {item.remainingQuantity > 0 ? (
                            <span className="ml-1.5 text-amber-600 font-bold">
                              ({item.remainingQuantity.toLocaleString()} rem)
                            </span>
                          ) : (
                            <span className="ml-1.5 text-emerald-600 font-bold">✓ Full</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Actions per order */}
                <div className="pt-2 border-t border-slate-200 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setHistoryOrder(order)}
                    className="text-[11px] font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1"
                  >
                    <History className="w-3.5 h-3.5 text-slate-400" />
                    <span>History ({progress.subDeliveries.length})</span>
                  </button>

                  <div className="flex items-center gap-1.5">
                    {progress.isFullyDelivered ? (
                      <button
                        type="button"
                        onClick={() => handlePrintFinalChallan(order)}
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-lg shadow-sm transition-colors flex items-center gap-1"
                      >
                        <FileCheck className="w-3 h-3" />
                        <span>Final Challan</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={onOpenNewDispatchModal}
                        className="px-2.5 py-1 bg-sky-600 hover:bg-sky-700 text-white text-[11px] font-bold rounded-lg shadow-sm transition-colors flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Sub-Delivery</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 2: ALL SUB-CHALLANS (DISPATCH RECORDS)
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search challan number, vehicle, driver or order..."
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

      {/* Sub-Challan Table */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="py-3.5 px-4">Sub-Challan No</th>
                <th className="py-3.5 px-4">Parent Order</th>
                <th className="py-3.5 px-4">Customer Name</th>
                <th className="py-3.5 px-4">Items in Shipment</th>
                <th className="py-3.5 px-4">Vehicle & Driver</th>
                <th className="py-3.5 px-4">Delivery Date</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
              {filteredDispatches.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 font-medium">
                    No sub-deliveries or dispatch shipments found matching criteria.
                  </td>
                </tr>
              ) : (
                filteredDispatches.map((d) => {
                  const parentOrder = orders.find((o) => o.id === d.orderId || o.orderNumber === d.orderNumber);
                  return (
                    <tr key={d.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-sky-600">
                        {d.dispatchNumber}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-blue-600">
                        <div className="flex items-center gap-1.5">
                          <Link to={`/sales/${d.orderId || ''}`} className="hover:underline">
                            {d.orderNumber}
                          </Link>
                          {parentOrder?.orderType === 'AS' && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                              AS
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-900">{d.customerName}</td>
                      <td className="py-3.5 px-4">
                        <div className="truncate max-w-[200px]" title={d.items.map((i) => `${i.quantity.toLocaleString()}x ${i.productName}`).join(', ')}>
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
                            onClick={() => handlePrintSubChallan(d)}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-[11px] font-semibold text-slate-700 rounded-lg border border-slate-200 transition-colors flex items-center gap-1"
                            title="Print Individual Sub-Challan"
                          >
                            <Printer className="w-3 h-3" />
                            <span>Print Challan</span>
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
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          DELIVERY HISTORY MODAL
      ═══════════════════════════════════════════════════════════════════ */}
      {historyOrder && (
        <Modal
          isOpen={Boolean(historyOrder)}
          onClose={() => setHistoryOrder(null)}
          title={`Delivery History — ${historyOrder.orderNumber}`}
          subtitle={`Fulfillment tracking for ${historyOrder.companyName || historyOrder.customerName}`}
          maxWidth="2xl"
        >
          {(() => {
            const prog = getOrderDeliveryProgress(historyOrder, dispatches);
            return (
              <div className="space-y-4">
                {/* Progress summary card */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                  <div className="flex justify-between text-xs font-bold text-slate-800 uppercase tracking-wider">
                    <span>Product Delivery Status</span>
                    <span className={prog.isFullyDelivered ? 'text-emerald-600' : 'text-amber-600'}>
                      {prog.isFullyDelivered ? '✓ 100% Completed' : `${prog.totalRemainingQuantity.toLocaleString()} Units Remaining`}
                    </span>
                  </div>

                  <div className="divide-y divide-slate-200/70 text-xs">
                    {prog.items.map((item) => (
                      <div key={item.productId} className="py-2 flex items-center justify-between">
                        <span className="font-semibold text-slate-800">{item.productName}</span>
                        <div className="text-right">
                          <span className="font-bold text-slate-900">
                            {item.deliveredQuantity.toLocaleString()} / {item.orderedQuantity.toLocaleString()}
                          </span>
                          <span className="ml-2 font-bold text-amber-600">
                            (Remaining: {item.remainingQuantity.toLocaleString()})
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Sub-Challan History Table */}
                <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100/80 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        <th className="py-2.5 px-3">Challan</th>
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Vehicle</th>
                        <th className="py-2.5 px-3">Items</th>
                        <th className="py-2.5 px-3 text-center">Quantity</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                        <th className="py-2.5 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-slate-700">
                      {prog.subDeliveries.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-6 text-center text-slate-400">
                            No sub-deliveries recorded yet for this sales order.
                          </td>
                        </tr>
                      ) : (
                        prog.subDeliveries.map((sub) => {
                          const subQty = sub.items.reduce((s, i) => s + i.quantity, 0);
                          return (
                            <tr key={sub.id} className="hover:bg-slate-50">
                              <td className="py-2.5 px-3 font-mono font-bold text-sky-600">{sub.dispatchNumber}</td>
                              <td className="py-2.5 px-3 text-slate-500">{sub.dispatchDate}</td>
                              <td className="py-2.5 px-3 font-medium text-slate-800">{sub.vehicleNumber || 'Pending'}</td>
                              <td className="py-2.5 px-3 truncate max-w-[140px]">
                                {sub.items.map((i) => `${i.quantity}x ${i.productName}`).join(', ')}
                              </td>
                              <td className="py-2.5 px-3 text-center font-bold text-slate-900">{subQty.toLocaleString()}</td>
                              <td className="py-2.5 px-3 text-center">
                                <Badge status={sub.status} />
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                <button
                                  type="button"
                                  onClick={() => handlePrintSubChallan(sub)}
                                  className="px-2 py-1 bg-white hover:bg-slate-100 text-[11px] font-semibold text-slate-700 rounded-lg border border-slate-200 transition-colors inline-flex items-center gap-1"
                                >
                                  <Printer className="w-3 h-3" />
                                  <span>Print</span>
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <div className="text-xs text-slate-500">
                    Total Deliveries: <strong className="text-slate-800">{prog.subDeliveries.length}</strong>
                  </div>
                  <div className="flex items-center gap-2">
                    {prog.isFullyDelivered ? (
                      <button
                        type="button"
                        onClick={() => {
                          setHistoryOrder(null);
                          handlePrintFinalChallan(historyOrder);
                        }}
                        className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors flex items-center gap-1.5"
                      >
                        <FileCheck className="w-3.5 h-3.5" />
                        <span>Print Final Consolidated Challan</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setHistoryOrder(null);
                          onOpenNewDispatchModal();
                        }}
                        className="px-3.5 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors flex items-center gap-1.5"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>+ New Sub-Delivery</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}
        </Modal>
      )}

    </div>
  );
};
