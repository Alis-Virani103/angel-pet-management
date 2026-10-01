import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Order, Customer, Settings, Dispatch } from '../types';
import { getOrders, getCustomers, getSettings, getDispatches, uploadOrderSignedCopy, removeOrderSignedCopy } from '../services/db';
import { Badge } from '../components/common/Badge';
import { EditOrderItemsModal } from '../components/modals/EditOrderItemsModal';
import { isPakkaBill, amountInWords, formatInvoiceDate } from '../utils/invoicePrintUtils';
import { formatPackagingMode } from '../utils/packagingUtils';
import { formatWeight, getWeightInGrams } from '../utils/weightUtils';
import { getOrderDeliveryProgress } from '../utils/dispatchUtils';
import {
  ArrowLeft,
  Printer,
  IndianRupee,
  Truck,
  Edit,
  Building,
  User,
  Calendar,
  CheckCircle,
  FileText,
  UploadCloud,
  Download,
  Trash2,
  Loader2,
  AlertCircle,
  PackageCheck,
  FileCheck,
  Plus
} from 'lucide-react';

interface OrderDetailsProps {
  onOpenRecordPaymentModal: (orderId?: string) => void;
  onOpenNewDispatchModal: (orderId?: string) => void;
}



// ── Inline styles for print invoice ──────────────────────────────────────────
// All styles are inlined so they survive print media without depending on
// Tailwind (which may not render correctly inside @media print).
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
  invoiceBox: {
    background: '#f0f9ff',
    border: '2px solid #2563eb',
    borderRadius: '8px',
    padding: '10px 16px',
    display: 'inline-block',
    minWidth: '180px',
  },
  invoiceTitle: { color: '#1e3a8a', fontWeight: '900' as const, fontSize: '18px', letterSpacing: '1px' },
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

// ─────────────────────────────────────────────────────────────────────────────

export const OrderDetails: React.FC<OrderDetailsProps> = ({
  onOpenRecordPaymentModal,
  onOpenNewDispatchModal
}) => {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [signedCopyFile, setSignedCopyFile] = useState<File | null>(null);
  const [signedCopyLoading, setSignedCopyLoading] = useState(false);
  const [signedCopyError, setSignedCopyError] = useState('');

  useEffect(() => {
    loadOrder();
  }, [orderId]);

  const loadOrder = async () => {
    setLoading(true);
    try {
      const [list, cusList, stg, dList] = await Promise.all([
        getOrders(),
        getCustomers(),
        getSettings(),
        getDispatches()
      ]);
      const found = list.find((o) => o.id === orderId || o.orderNumber === orderId);
      if (found) {
        setOrder(found);
        const cus = cusList.find((c) => c.id === found.customerId);
        if (cus) setCustomer(cus);
      }
      setSettings(stg);
      setDispatches(dList);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSignedCopySelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!orderId) return;
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const supportedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (!supportedTypes.includes(file.type)) {
      setSignedCopyError('Unsupported file type. Upload a PDF, JPG, JPEG, PNG, or WebP file.');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setSignedCopyError('The signed copy must be smaller than 20 MB.');
      return;
    }

    setSignedCopyFile(file);
    setSignedCopyError('');
    setSignedCopyLoading(true);
    try {
      const updated = await uploadOrderSignedCopy(orderId, file);
      setOrder(updated);
      setSignedCopyFile(null);
    } catch (error) {
      console.error('Signed copy upload failed:', error);
      setSignedCopyError(error instanceof Error ? error.message : 'Failed to upload the signed copy.');
    } finally {
      setSignedCopyLoading(false);
    }
  };

  const handleRemoveSignedCopy = async () => {
    if (!order || !order.signedCopy || !window.confirm('Remove the signed copy from this sales order?')) return;
    setSignedCopyLoading(true);
    setSignedCopyError('');
    try {
      const updated = await removeOrderSignedCopy(order.id);
      setOrder(updated);
    } catch (error) {
      console.error('Signed copy removal failed:', error);
      setSignedCopyError(error instanceof Error ? error.message : 'Failed to remove the signed copy.');
    } finally {
      setSignedCopyLoading(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-xs text-slate-400 font-medium">Loading order details...</div>;
  }

  if (!order) {
    return (
      <div className="p-8 text-center space-y-3">
        <p className="text-sm font-semibold text-slate-700">Order not found.</p>
        <Link to="/sales" className="text-xs text-blue-600 font-semibold hover:underline">
          Back to Sales &amp; Orders
        </Link>
      </div>
    );
  }

  const isAS = order.orderType === 'AS';
  const isGst = !isAS && isPakkaBill(order);
  const pendingBalance = isAS ? 0 : Math.max(0, order.totalAmount - order.paidAmount);
  const orderProgress = order ? getOrderDeliveryProgress(order, dispatches) : null;

  const companyName = settings?.companyName || 'Angel Pet Packaging Solutions Pvt Ltd';
  const companyAddress = settings?.address || 'Plot 108, GIDC Industrial Estate, Makarpura, Vadodara, Gujarat – 390010';
  const companyPhone = settings?.phone || '+91 98250 99887';
  const companyEmail = settings?.email || 'sales@angelpetpackaging.com';
  const companyGstin = isGst ? (settings?.gstin || '24AAACA1234B1Z9') : '';

  const customerGstin = isGst ? customer?.gstin : undefined;

  const isCashMemo = !isAS && order.paymentType === 'cash_memo';
  const memoLabel = isAS ? 'AS ORDER' : (isCashMemo ? 'CASH MEMO' : 'DEBIT MEMO');
  const memoColor = isAS ? '#7e22ce' : (isCashMemo ? '#16a34a' : '#2563eb');
  const memoBg = isAS ? '#f3e8ff' : (isCashMemo ? '#dcfce7' : '#dbeafe');

  const titleText = isAS ? 'AS ORDER' : (isGst ? 'TAX INVOICE' : 'KACHHA BILL');
  const headerThemeGradient = isAS
    ? 'linear-gradient(135deg,#581c87 0%,#7e22ce 100%)'
    : isGst
    ? 'linear-gradient(135deg,#1e3a8a 0%,#2563eb 100%)'
    : 'linear-gradient(135deg,#334155 0%,#475569 100%)';
  const boxBorderColor = isAS ? '#7e22ce' : isGst ? '#2563eb' : '#64748b';
  const boxBgColor = isAS ? '#faf5ff' : isGst ? '#f0f9ff' : '#f8fafc';
  const boxTitleColor = isAS ? '#581c87' : isGst ? '#1e3a8a' : '#334155';
  const dividerGradient = isAS
    ? 'linear-gradient(90deg,#7e22ce 0%,#e9d5ff 100%)'
    : isGst
    ? 'linear-gradient(90deg,#2563eb 0%,#bfdbfe 100%)'
    : 'linear-gradient(90deg,#64748b 0%,#cbd5e1 100%)';
  const tableHeaderBg = isAS ? '#581c87' : isGst ? '#1e3a8a' : '#334155';
  const totalPieces = order.items.reduce((sum, it) => sum + (it.quantity || 0), 0);
  const orderTotalWeightGrams =
    order.totalWeightGrams ??
    order.items.reduce((sum, it) => {
      const pieceGrams = getWeightInGrams(it.weightPerPiece, it.weightUnit || 'g') || 0;
      const itGrams = it.totalWeightGrams ?? (pieceGrams > 0 ? pieceGrams * it.quantity : 0);
      return sum + (itGrams || 0);
    }, 0);
  const hasAnyWeightInOrder =
    orderTotalWeightGrams > 0 ||
    order.items.some(
      (it) => (it.totalWeightGrams && it.totalWeightGrams > 0) || (it.weightPerPiece && it.weightPerPiece > 0)
    );
  const totalOrderWeightDisplay =
    order.totalWeightDisplay || (orderTotalWeightGrams > 0 ? formatWeight(orderTotalWeightGrams) : undefined);

  return (
    <div className="space-y-6">

      {/* ═══════════════════════════════════════════════════════════════════
          PRINT-ONLY PROFESSIONAL A4 INVOICE (PAKKA OR KACHHA BILL / AS ORDER)
          Hidden on screen via `display:none`.
          The @media print rule in index.css flips visibility:
            – hides  #angel-erp-screen
            – shows  #angel-print-invoice
          All styles are inline for print reliability.
      ═══════════════════════════════════════════════════════════════════ */}
      <div id="angel-print-invoice">
        <div style={S.page}>

          {/* ── HEADER ─────────────────────────────────────────────────── */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '10px' }}>
            <tbody>
              <tr>
                {/* LEFT: Branding */}
                <td style={{ ...S.headerCell, width: '55%' }}>
                  <div style={{ ...S.brandBox, background: headerThemeGradient }}>
                    <div style={S.brandTitle}>🐾 {companyName.toUpperCase()}</div>
                    <div style={S.brandSub}>PACKAGING SOLUTIONS</div>
                  </div>
                  <div style={S.companyMeta}>
                    <div>{companyAddress}</div>
                    <div>📞 {companyPhone} &nbsp;|&nbsp; ✉ {companyEmail}</div>
                    {isGst && companyGstin && (
                      <div style={{ marginTop: '2px' }}>
                        <strong style={{ color: '#1e40af' }}>GSTIN:</strong>&nbsp;{companyGstin}
                      </div>
                    )}
                  </div>
                </td>

                {/* RIGHT: Invoice meta box */}
                <td style={{ ...S.headerCell, textAlign: 'right' }}>
                  <div style={{ ...S.invoiceBox, background: boxBgColor, borderColor: boxBorderColor, minWidth: '190px' }}>
                    <div style={{ ...S.invoiceTitle, color: boxTitleColor, textAlign: 'center', fontSize: '16px' }}>{titleText}</div>
                    <div style={{ textAlign: 'center', marginTop: '3px' }}>
                      <span style={{ display: 'inline-block', background: memoBg, color: memoColor, fontWeight: 800, fontSize: '9px', padding: '2px 8px', borderRadius: '4px', letterSpacing: '1px' }}>
                        {memoLabel}
                      </span>
                    </div>
                    <div style={{ marginTop: '6px', borderTop: '1px solid #cbd5e1', paddingTop: '6px' }}>
                      <table style={{ width: '100%', fontSize: '9.5px', borderCollapse: 'collapse' }}>
                        <tbody>
                          <tr>
                            <td style={{ color: '#64748b', paddingBottom: '2px' }}>{isAS ? 'Order No.' : isGst ? 'Invoice No.' : 'Bill No.'}</td>
                            <td style={{ fontWeight: '800', color: boxTitleColor, textAlign: 'right' }}>{order.orderNumber}</td>
                          </tr>
                          <tr>
                            <td style={{ color: '#64748b', paddingBottom: '2px' }}>Doc Type</td>
                            <td style={{ fontWeight: '800', color: memoColor, textAlign: 'right' }}>{memoLabel}</td>
                          </tr>
                          <tr>
                            <td style={{ color: '#64748b' }}>Date</td>
                            <td style={{ fontWeight: '700', textAlign: 'right' }}>{formatInvoiceDate(order.orderDate)}</td>
                          </tr>
                          <tr>
                            <td style={{ color: '#64748b', paddingTop: '2px' }}>Status</td>
                            <td style={{
                              fontWeight: '700', textAlign: 'right', textTransform: 'capitalize',
                              color: order.orderStatus === 'completed' ? '#16a34a'
                                : order.orderStatus === 'cancelled' ? '#dc2626' : '#d97706'
                            }}>
                              {order.orderStatus}
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
          <div style={{ ...S.divider, background: dividerGradient }} />

          {/* ── BILL-TO + PAYMENT SUMMARY ──────────────────────────────── */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '10px' }}>
            <tbody>
              <tr>
                <td style={{ width: '50%', verticalAlign: 'top', paddingRight: '8px' }}>
                  <div style={S.infoBox}>
                    <div style={S.infoLabel}>{isGst ? 'Bill To' : 'Customer Details'}</div>
                    <div style={{ fontWeight: '800', fontSize: '13px', color: '#0f172a', marginBottom: '2px' }}>
                      {order.companyName}
                    </div>
                    <div style={{ color: '#475569', fontSize: '10px' }}>Attn: {order.customerName}</div>
                    {isGst && customerGstin && (
                      <div style={{ color: '#1e40af', fontSize: '9.5px', marginTop: '2px', fontWeight: '600' }}>
                        GSTIN: {customerGstin}
                      </div>
                    )}
                  </div>
                </td>
                <td style={{ width: '50%', verticalAlign: 'top', paddingLeft: '8px' }}>
                  <div style={S.infoBox}>
                    <div style={S.infoLabel}>{isAS ? 'Order Classification' : 'Payment Summary'}</div>
                    {isAS ? (
                      <table style={{ width: '100%', fontSize: '10px', borderCollapse: 'collapse' }}>
                        <tbody>
                          <tr>
                            <td style={{ color: '#475569', paddingBottom: '2px' }}>Order Type:</td>
                            <td style={{ textAlign: 'right', fontWeight: '800', color: '#7e22ce' }}>AS Order</td>
                          </tr>
                          <tr>
                            <td style={{ color: '#475569', paddingBottom: '2px' }}>Financial Impact:</td>
                            <td style={{ textAlign: 'right', fontWeight: '700', color: '#16a34a' }}>None (₹0)</td>
                          </tr>
                          <tr style={{ borderTop: '1px solid #e2e8f0' }}>
                            <td style={{ color: '#0f172a', fontWeight: '700', paddingTop: '3px' }}>Inventory Impact:</td>
                            <td style={{ textAlign: 'right', fontWeight: '700', color: '#64748b', paddingTop: '3px' }}>None</td>
                          </tr>
                        </tbody>
                      </table>
                    ) : (
                      <table style={{ width: '100%', fontSize: '10px', borderCollapse: 'collapse' }}>
                        <tbody>
                          <tr>
                            <td style={{ color: '#475569', paddingBottom: '2px' }}>Payment Status:</td>
                            <td style={{
                              textAlign: 'right', fontWeight: '700', textTransform: 'capitalize',
                              color: order.paymentStatus === 'paid' ? '#16a34a'
                                : order.paymentStatus === 'partially_paid' ? '#d97706' : '#dc2626'
                            }}>
                              {order.paymentStatus === 'partially_paid' ? 'Partially Paid'
                                : order.paymentStatus === 'paid' ? 'Paid' : 'Unpaid'}
                            </td>
                          </tr>
                          <tr>
                            <td style={{ color: '#475569', paddingBottom: '2px' }}>Amount Paid:</td>
                            <td style={{ textAlign: 'right', fontWeight: '700', color: '#16a34a' }}>
                              ₹{order.paidAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                          <tr style={{ borderTop: '1px solid #e2e8f0' }}>
                            <td style={{ color: '#0f172a', fontWeight: '700', paddingTop: '3px' }}>Balance Due:</td>
                            <td style={{
                              textAlign: 'right', fontWeight: '800', paddingTop: '3px',
                              color: pendingBalance > 0 ? '#dc2626' : '#16a34a'
                            }}>
                              ₹{pendingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    )}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

          {/* ── ITEMS TABLE ────────────────────────────────────────────── */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '4px' }}>
            <thead>
              <tr style={{ background: tableHeaderBg }}>
                <th style={{ ...S.thBase, textAlign: 'left', width: '4%' }}>#</th>
                <th style={{ ...S.thBase, textAlign: 'left' }}>Description / Product</th>
                <th style={{ ...S.thBase, textAlign: 'center', width: '9%' }}>Type</th>
                <th style={{ ...S.thBase, textAlign: 'center', width: '11%' }}>Qty</th>
                <th style={{ ...S.thBase, textAlign: 'right', width: '13%' }}>Unit Rate (₹)</th>
                {hasAnyWeightInOrder && (
                  <th style={{ ...S.thBase, textAlign: 'center', width: '12%' }}>Weight</th>
                )}
                <th style={{ ...S.thBase, textAlign: 'right', width: '14%' }}>{isGst ? 'Taxable Amount (₹)' : 'Amount (₹)'}</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item, idx) => {
                const hasInner = Boolean(item.selectedInnerName || item.selectedInnerId);
                const hasCap = Boolean(item.selectedCapName || item.selectedCapId);
                const isCombo = Boolean(item.isCombo || hasInner || hasCap);

                let displayTitle = item.productName;
                if (hasInner && hasCap) {
                  displayTitle = `${item.productName} + ${item.selectedInnerName || 'Inner'} + ${item.selectedCapName || 'Cap'}`;
                } else if (hasCap) {
                  displayTitle = `${item.productName} + ${item.selectedCapName || 'Cap'}`;
                } else if (hasInner) {
                  displayTitle = `${item.productName} + ${item.selectedInnerName || 'Inner'}`;
                }

                const pieceGrams = getWeightInGrams(item.weightPerPiece, item.weightUnit || 'g') || 0;
                const itemWeightStr =
                  item.totalWeightDisplay ||
                  (pieceGrams > 0 ? formatWeight(pieceGrams * item.quantity) : '-');

                return (
                <tr key={idx} style={{ background: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                  <td style={{ padding: '7px 10px', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontWeight: '600' }}>
                    {idx + 1}
                  </td>
                  <td style={{ padding: '7px 10px', borderBottom: '1px solid #e2e8f0', fontWeight: '700', color: '#0f172a' }}>
                    {displayTitle}
                    {isCombo && (
                      <span style={{ fontSize: '8px', background: '#dbeafe', color: '#1e40af', padding: '1px 5px', borderRadius: '4px', fontWeight: '700', marginLeft: '6px', textTransform: 'uppercase' }}>
                        Combo
                      </span>
                    )}
                    {item.isAutoGenerated && (
                      <span style={{ fontSize: '8px', background: '#e0f2fe', color: '#0284c7', padding: '1px 5px', borderRadius: '4px', fontWeight: '700', marginLeft: '6px', textTransform: 'uppercase' }}>
                        Auto Linked
                      </span>
                    )}
                    {isCombo && (hasInner || hasCap) && (
                      <div style={{ fontSize: '8.5px', color: '#475569', fontWeight: '500', marginTop: '2px' }}>
                        Included: {hasInner ? `${item.selectedInnerName || 'Inner'} × ${item.quantity.toLocaleString('en-IN')}` : ''}{hasInner && hasCap ? ' • ' : ''}{hasCap ? `${item.selectedCapName || 'Cap'} × ${item.quantity.toLocaleString('en-IN')}` : ''}
                      </div>
                    )}
                    {item.packagingMode && item.packagingMode !== 'bottle_only' && !isCombo && (
                      <div style={{ fontSize: '8.5px', color: '#2563eb', fontWeight: '700', marginTop: '1.5px' }}>
                        Packaging: {formatPackagingMode(item.packagingMode)}
                      </div>
                    )}
                    <div style={{ fontSize: '9px', color: '#94a3b8', fontWeight: '400', marginTop: '1px' }}>
                      Category {item.priceCategory} Pricing
                    </div>
                  </td>
                  <td style={{ padding: '7px 10px', borderBottom: '1px solid #e2e8f0', textAlign: 'center', color: '#475569', fontWeight: '600', textTransform: 'capitalize' }}>
                    {item.productType}
                  </td>
                  <td style={{ padding: '7px 10px', borderBottom: '1px solid #e2e8f0', textAlign: 'center', fontWeight: '700', color: '#0f172a' }}>
                    {item.soldByPacket && item.packetCount && item.unitsPerPacket ? (
                      <div>
                        <div>{item.packetCount.toLocaleString('en-IN')} Packets</div>
                        <div style={{ fontSize: '8.5px', color: '#64748b', fontWeight: '500', marginTop: '2px' }}>
                          Units per Packet: {item.unitsPerPacket.toLocaleString('en-IN')}
                        </div>
                        <div style={{ fontSize: '8.5px', color: '#64748b', fontWeight: '500' }}>
                          Total Units: {item.quantity.toLocaleString('en-IN')}
                        </div>
                      </div>
                    ) : (
                      `${item.quantity.toLocaleString('en-IN')} pcs`
                    )}
                  </td>
                  <td style={{ padding: '7px 10px', borderBottom: '1px solid #e2e8f0', textAlign: 'right', color: '#0f172a', fontWeight: '600' }}>
                    {item.unitPrice.toFixed(2)}
                  </td>
                  {hasAnyWeightInOrder && (
                    <td style={{ padding: '7px 10px', borderBottom: '1px solid #e2e8f0', textAlign: 'center', fontWeight: '700', color: '#0f172a' }}>
                      {itemWeightStr}
                    </td>
                  )}
                  <td style={{ padding: '7px 10px', borderBottom: '1px solid #e2e8f0', textAlign: 'right', fontWeight: '700', color: '#0f172a' }}>
                    {item.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>

          {/* ── TOTALS & SUMMARY ────────────────────────────────────────── */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '8px' }}>
            <tbody>
              <tr>
                {/* Left: notes & logistics */}
                <td style={{ verticalAlign: 'top', paddingRight: '12px', width: '48%' }}>
                  <div style={{
                    background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px',
                    padding: '7px 10px', fontSize: '9.5px', color: '#334155', marginBottom: '6px'
                  }}>
                    <div><strong>TOTAL QUANTITY:</strong> {totalPieces.toLocaleString('en-IN')} pcs</div>
                    {hasAnyWeightInOrder && totalOrderWeightDisplay && (
                      <div style={{ marginTop: '2px' }}>
                        <strong>TOTAL WEIGHT:</strong> <span style={{ color: '#0f172a', fontWeight: '800' }}>{totalOrderWeightDisplay}</span>
                      </div>
                    )}
                  </div>
                  {order.notes && (
                    <div style={{
                      background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '6px',
                      padding: '8px 10px', fontSize: '9.5px', color: '#78350f'
                    }}>
                      <strong>Note:</strong> {order.notes}
                    </div>
                  )}
                </td>

                {/* Right: calculation summary */}
                <td style={{ verticalAlign: 'top', width: '52%' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10.5px' }}>
                    <tbody>
                      <tr>
                        <td style={{ padding: '4px 10px', color: '#475569' }}>{isGst ? 'Subtotal (Taxable):' : 'Subtotal:'}</td>
                        <td style={{ padding: '4px 10px', textAlign: 'right', fontWeight: '600', color: '#0f172a' }}>
                          ₹{order.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                      {isGst && order.gstRate > 0 && order.gstAmount > 0 && (
                        <>
                          <tr>
                            <td style={{ padding: '4px 10px', color: '#475569' }}>
                              CGST ({order.gstRate / 2}%):
                            </td>
                            <td style={{ padding: '4px 10px', textAlign: 'right', fontWeight: '600', color: '#0f172a' }}>
                              ₹{(order.gstAmount / 2).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                          <tr>
                            <td style={{ padding: '4px 10px', color: '#475569' }}>
                              SGST ({order.gstRate / 2}%):
                            </td>
                            <td style={{ padding: '4px 10px', textAlign: 'right', fontWeight: '600', color: '#0f172a' }}>
                              ₹{(order.gstAmount / 2).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        </>
                      )}
                      <tr style={{ background: tableHeaderBg }}>
                        <td style={{ padding: '7px 10px', color: '#fff', fontWeight: '800', fontSize: '12px' }}>
                          GRAND TOTAL:
                        </td>
                        <td style={{ padding: '7px 10px', textAlign: 'right', color: '#93c5fd', fontWeight: '900', fontSize: '13px' }}>
                          ₹{order.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                      <tr>
                        <td style={{ padding: '4px 10px', color: '#16a34a', fontWeight: '600' }}>Amount Received:</td>
                        <td style={{ padding: '4px 10px', textAlign: 'right', fontWeight: '700', color: '#16a34a' }}>
                          ₹{order.paidAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                      <tr style={{ borderTop: '2px solid #e2e8f0' }}>
                        <td style={{ padding: '5px 10px', fontWeight: '700', color: pendingBalance > 0 ? '#dc2626' : '#16a34a' }}>
                          {pendingBalance > 0 ? 'Balance Outstanding:' : 'Fully Settled ✓'}
                        </td>
                        <td style={{ padding: '5px 10px', textAlign: 'right', fontWeight: '800', color: pendingBalance > 0 ? '#dc2626' : '#16a34a' }}>
                          ₹{pendingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
            </tbody>
          </table>

          {/* ── AMOUNT IN WORDS BOX (Positioned near bottom, spanning full width) ── */}
          <div style={{
            background: boxBgColor,
            border: '1px solid #cbd5e1',
            borderRadius: '6px',
            padding: '7px 12px',
            fontSize: '9.5px',
            color: boxTitleColor,
            marginBottom: '8px'
          }}>
            <span style={{ fontWeight: 800, color: '#64748b', fontSize: '8.5px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Amount in Words:{' '}
            </span>
            <span style={{ fontWeight: 700, color: boxTitleColor, fontSize: '10px' }}>
              {amountInWords(order.totalAmount)}
            </span>
          </div>

          {/* ── TERMS + SIGNATORY ──────────────────────────────────────── */}
          <div style={{ height: '1px', background: '#e2e8f0', marginBottom: '8px' }} />
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9px', marginBottom: '10px' }}>
            <tbody>
              <tr>
                <td style={{ verticalAlign: 'top', width: '55%', paddingRight: '12px', color: '#475569' }}>
                  <div style={{ fontWeight: '700', color: boxTitleColor, marginBottom: '3px', fontSize: '9.5px' }}>
                    Terms &amp; Conditions
                  </div>
                  <div>1. Goods once sold will not be taken back.</div>
                  <div>2. Payment is due within 30 days of invoice date.</div>
                  <div>3. Interest @ 18% p.a. will be charged on overdue payments.</div>
                  <div>4. All disputes subject to Vadodara jurisdiction only.</div>
                </td>
                <td style={{ verticalAlign: 'top', width: '45%', paddingLeft: '12px' }}>
                  <div style={{ fontWeight: '700', color: boxTitleColor, marginBottom: '3px', fontSize: '9.5px' }}>
                    For {companyName}
                  </div>
                  <div style={{ height: '42px', borderBottom: '1px dashed #cbd5e1', marginBottom: '4px' }} />
                  <div style={{ color: '#64748b' }}>Authorised Signatory</div>
                </td>
              </tr>
            </tbody>
          </table>

          {/* ── FOOTER ─────────────────────────────────────────────────── */}
          <div style={S.footer}>
            <strong style={{ color: boxTitleColor }}>{companyName}</strong>
            &nbsp;|&nbsp; {companyAddress}
            {isGst && companyGstin && <>&nbsp;|&nbsp; GSTIN: {companyGstin}</>}
            &nbsp;|&nbsp; This is a computer-generated {isGst ? 'tax invoice' : 'kachha bill'}.
          </div>

        </div>
      </div>
      {/* ═══════════════════════════════════════════════════════════════════
          END PRINT-ONLY INVOICE
      ═══════════════════════════════════════════════════════════════════ */}


      {/* ═══════════════════════════════════════════════════════════════════
          SCREEN-ONLY ERP VIEW  (hidden during print via CSS)
      ═══════════════════════════════════════════════════════════════════ */}
      <div id="angel-erp-screen">

        {/* Top Header & Navigation */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center space-x-3">
            <Link
              to="/sales"
              className="p-2 rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-slate-900 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">Order Placed on {order.orderDate}</h1>
                {isAS ? (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-purple-100 text-purple-800 border border-purple-200">
                    Order Type: AS Order
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-slate-100 text-slate-800 border border-slate-200">
                    Order Type: Regular Order
                  </span>
                )}
                <Badge status={order.orderStatus} size="md" />
                {!isAS && <Badge status={order.paymentStatus} size="md" />}
                {!isAS && (
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${isCashMemo ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'}`}>
                    {isCashMemo ? 'Cash Memo (Paid)' : 'Debit Memo (Credit)'}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => window.print()}
              className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold text-xs rounded-xl shadow-sm transition-colors flex items-center space-x-1.5"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Invoice</span>
            </button>
            <button
              onClick={() => setIsEditModalOpen(true)}
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl transition-colors flex items-center space-x-1.5"
            >
              <Edit className="w-3.5 h-3.5" />
              <span>Edit Order</span>
            </button>
            {!isAS && order.paymentStatus !== 'paid' && order.paymentType !== 'cash_memo' && (
              <button
                onClick={() => onOpenRecordPaymentModal(order.id)}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl transition-colors shadow-sm shadow-emerald-500/20 flex items-center space-x-1.5"
              >
                <IndianRupee className="w-3.5 h-3.5" />
                <span>Record Payment</span>
              </button>
            )}
            {isAS && (
              <span className="px-3 py-2 bg-purple-50 text-purple-700 border border-purple-200 text-xs font-medium rounded-xl">
                Payment not applicable for AS Order
              </span>
            )}
            {orderProgress && orderProgress.totalRemainingQuantity > 0 && order.orderStatus !== 'cancelled' && (
              <button
                onClick={() => onOpenNewDispatchModal(order.id)}
                className="px-3.5 py-2 bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs rounded-xl transition-colors shadow-sm shadow-sky-500/20 flex items-center space-x-1.5"
              >
                <Truck className="w-3.5 h-3.5" />
                <span>+ New Sub-Delivery</span>
              </button>
            )}
            {orderProgress && orderProgress.isFullyDelivered && (
              <button
                onClick={() => navigate('/dispatch')}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl transition-colors shadow-sm shadow-emerald-500/20 flex items-center space-x-1.5"
              >
                <FileCheck className="w-3.5 h-3.5" />
                <span>Final Challan</span>
              </button>
            )}
          </div>
        </div>

        {/* Main Grid: Customer Card + Summary */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
          {/* Customer Information Card */}
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-3">
            <div className="flex items-center space-x-2 text-xs font-bold text-slate-800 uppercase tracking-wider">
              <Building className="w-4 h-4 text-blue-600" />
              <span>Customer Information</span>
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">{order.companyName}</p>
              <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                <User className="w-3.5 h-3.5 text-slate-400" />
                Contact: {order.customerName}
              </p>
            </div>
            {order.notes && (
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 text-xs text-amber-900">
                <span className="font-semibold block mb-0.5">Order Notes:</span>
                {order.notes}
              </div>
            )}
          </div>

          {/* Order Payment / Accounting Status Card */}
          {isAS ? (
            <div className="bg-white p-6 rounded-3xl border border-purple-100 shadow-sm space-y-3">
              <div className="flex items-center space-x-2 text-xs font-bold text-purple-800 uppercase tracking-wider">
                <IndianRupee className="w-4 h-4 text-purple-600" />
                <span>Order Type & Accounting</span>
              </div>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Order Type:</span>
                  <span className="font-bold text-purple-800 bg-purple-50 px-2 py-0.5 rounded">AS Order</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Financial Impact:</span>
                  <span className="font-bold text-emerald-600">None</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Inventory Impact:</span>
                  <span className="font-bold text-emerald-600">None</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Payment Status:</span>
                  <span className="font-medium text-slate-400 italic">Not Applicable</span>
                </div>
                <div className="flex justify-between text-slate-800 font-bold pt-2 border-t border-slate-100">
                  <span>Reference Value:</span>
                  <span className="text-purple-700">₹{order.totalAmount.toLocaleString()}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-3">
              <div className="flex items-center space-x-2 text-xs font-bold text-slate-800 uppercase tracking-wider">
                <IndianRupee className="w-4 h-4 text-emerald-600" />
                <span>Financial Summary</span>
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Document Mode:</span>
                  <span className="font-bold text-slate-900">{isCashMemo ? 'Cash Memo (Paid at sale)' : 'Debit Memo (Credit)'}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Total Invoice Amount:</span>
                  <span className="font-bold text-slate-900">₹{order.totalAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Amount Paid:</span>
                  <span className="font-bold text-emerald-600">₹{order.paidAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-slate-800 font-bold pt-2 border-t border-slate-100">
                  <span>Balance Outstanding:</span>
                  <span className="text-rose-600">₹{pendingBalance.toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}

          {/* Dispatch & Delivery Progress Card */}
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-xs font-bold text-slate-800 uppercase tracking-wider">
                <Truck className="w-4 h-4 text-sky-600" />
                <span>Fulfillment Summary</span>
              </div>
              <Badge status={order.orderStatus} />
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Total Ordered:</span>
                <span className="font-bold text-slate-900">{orderProgress?.totalOrderedQuantity.toLocaleString() || 0} pcs</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Delivered so far:</span>
                <span className="font-bold text-emerald-600">{orderProgress?.totalDeliveredQuantity.toLocaleString() || 0} pcs</span>
              </div>
              <div className="flex justify-between text-slate-800 font-bold pt-2 border-t border-slate-100">
                <span>Remaining to Deliver:</span>
                <span className={orderProgress?.totalRemainingQuantity === 0 ? 'text-emerald-600' : 'text-amber-600'}>
                  {orderProgress?.totalRemainingQuantity === 0 ? '0 (100% Fulfilled)' : `${orderProgress?.totalRemainingQuantity.toLocaleString()} pcs`}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Delivery Progress & Sub-Challan History */}
        {orderProgress && (
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 mt-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Truck className="w-4 h-4 text-sky-600" />
                  Sub-Delivery & Sub-Challan History
                </h2>
                <p className="text-xs text-slate-500">
                  Track trip deliveries, vehicle details, and remaining quantities per product line
                </p>
              </div>

              <div className="flex items-center gap-2">
                {orderProgress.totalRemainingQuantity > 0 && order.orderStatus !== 'cancelled' && (
                  <button
                    type="button"
                    onClick={() => onOpenNewDispatchModal(order.id)}
                    className="px-3.5 py-2 bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs rounded-xl shadow-sm transition-colors flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    <span>+ New Sub-Delivery</span>
                  </button>
                )}
                {orderProgress.isFullyDelivered && (
                  <button
                    type="button"
                    onClick={() => navigate('/dispatch')}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-sm transition-colors flex items-center gap-1.5"
                  >
                    <FileCheck className="w-4 h-4" />
                    <span>View Final Consolidated Challan</span>
                  </button>
                )}
              </div>
            </div>

            {/* Product line fulfillment progress cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {orderProgress.items.map((item) => {
                const itemPercent =
                  item.orderedQuantity > 0
                    ? Math.min(100, Math.round((item.deliveredQuantity / item.orderedQuantity) * 100))
                    : 0;
                return (
                  <div key={item.productId} className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-800 truncate" title={item.productName}>
                        {item.productName}
                      </span>
                      <span className="text-[11px] font-bold text-slate-600">{itemPercent}%</span>
                    </div>
                    <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${item.isFullyDelivered ? 'bg-emerald-500' : 'bg-sky-500'}`}
                        style={{ width: `${itemPercent}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-500">
                        Delivered: <strong className="text-slate-800">{item.deliveredQuantity.toLocaleString()}</strong> / {item.orderedQuantity.toLocaleString()}
                      </span>
                      <span className={item.remainingQuantity === 0 ? 'text-emerald-600 font-bold' : 'text-amber-600 font-bold'}>
                        {item.remainingQuantity === 0 ? 'Full' : `${item.remainingQuantity.toLocaleString()} rem`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Sub-Challan Records Table */}
            <div className="overflow-x-auto border border-slate-200/80 rounded-2xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-2.5 px-3">Sub-Challan No</th>
                    <th className="py-2.5 px-3">Delivery Date</th>
                    <th className="py-2.5 px-3">Vehicle</th>
                    <th className="py-2.5 px-3">Driver</th>
                    <th className="py-2.5 px-3">Items Shipped</th>
                    <th className="py-2.5 px-3 text-center">Delivered Qty</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {orderProgress.subDeliveries.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-slate-400 font-medium">
                        No sub-deliveries recorded yet for this sales order.
                      </td>
                    </tr>
                  ) : (
                    orderProgress.subDeliveries.map((sub) => {
                      const subTotal = sub.items.reduce((s, i) => s + i.quantity, 0);
                      return (
                        <tr key={sub.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-2.5 px-3 font-mono font-bold text-sky-600">
                            {sub.dispatchNumber}
                          </td>
                          <td className="py-2.5 px-3 text-slate-500">{sub.dispatchDate}</td>
                          <td className="py-2.5 px-3 font-semibold text-slate-800">{sub.vehicleNumber || 'Pending'}</td>
                          <td className="py-2.5 px-3 text-slate-600">{sub.driverName || 'No Driver'}</td>
                          <td className="py-2.5 px-3 truncate max-w-[200px]" title={sub.items.map((i) => `${i.quantity}x ${i.productName}`).join(', ')}>
                            {sub.items.map((i) => `${i.quantity.toLocaleString()}x ${i.productName}`).join(', ')}
                          </td>
                          <td className="py-2.5 px-3 text-center font-bold text-slate-900">{subTotal.toLocaleString()}</td>
                          <td className="py-2.5 px-3 text-center">
                            <Badge status={sub.status} />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Party Signed Copy */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 mt-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className={`p-2.5 rounded-xl ${order.signedCopy ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                {order.signedCopy ? <FileText className="w-5 h-5" /> : <UploadCloud className="w-5 h-5" />}
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">Party Signed Copy</h2>
                <p className={`text-xs font-medium mt-1 ${order.signedCopy ? 'text-emerald-700' : 'text-slate-500'}`}>
                  {order.signedCopy ? 'Uploaded' : 'Not Uploaded'}
                </p>
                {order.signedCopy && <p className="text-[11px] text-slate-400 mt-1 truncate max-w-[280px]">{order.signedCopy.fileName}</p>}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {order.signedCopy && (
                <>
                  <a href={order.signedCopy.downloadUrl} target="_blank" rel="noreferrer" className="px-3 py-2 bg-white border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-50 inline-flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" /> View
                  </a>
                  <a href={order.signedCopy.downloadUrl} download={order.signedCopy.fileName} className="px-3 py-2 bg-white border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-50 inline-flex items-center gap-1.5">
                    <Download className="w-3.5 h-3.5" /> Download
                  </a>
                  <button type="button" onClick={handleRemoveSignedCopy} disabled={signedCopyLoading} className="p-2 text-rose-600 border border-rose-100 rounded-xl hover:bg-rose-50 disabled:opacity-50" title="Remove signed copy" aria-label="Remove signed copy">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </>
              )}
              <label className={`px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 cursor-pointer ${signedCopyLoading ? 'opacity-60 pointer-events-none' : ''}`}>
                {signedCopyLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UploadCloud className="w-3.5 h-3.5" />}
                {signedCopyLoading ? 'Uploading...' : order.signedCopy ? 'Replace Copy' : 'Upload Signed Copy'}
                <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={handleSignedCopySelected} disabled={signedCopyLoading} className="hidden" />
              </label>
            </div>
          </div>
          {signedCopyError && (
            <div className="mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2 font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{signedCopyError}</span>
            </div>
          )}
          <p className="text-[11px] text-slate-400 mt-3">Accepted: PDF, JPG, JPEG, PNG, or WebP up to 20 MB.</p>
        </div>

        {/* Items Breakdown Table */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden p-6 space-y-4 mt-6">
          <h2 className="text-base font-bold text-slate-900">Order Items Specification</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Item Name</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Price Category</th>
                  <th className="py-3 px-4">Unit Price</th>
                  <th className="py-3 px-4">Quantity</th>
                  {hasAnyWeightInOrder && <th className="py-3 px-4">Weight</th>}
                  <th className="py-3 px-4 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700 font-medium">
                {order.items.map((item, idx) => {
                  const hasInner = Boolean(item.selectedInnerName || item.selectedInnerId);
                  const hasCap = Boolean(item.selectedCapName || item.selectedCapId);
                  const isCombo = Boolean(item.isCombo || hasInner || hasCap);

                  let displayTitle = item.productName;
                  if (hasInner && hasCap) {
                    displayTitle = `${item.productName} + ${item.selectedInnerName || 'Inner'} + ${item.selectedCapName || 'Cap'}`;
                  } else if (hasCap) {
                    displayTitle = `${item.productName} + ${item.selectedCapName || 'Cap'}`;
                  } else if (hasInner) {
                    displayTitle = `${item.productName} + ${item.selectedInnerName || 'Inner'}`;
                  }

                  const pieceGrams = getWeightInGrams(item.weightPerPiece, item.weightUnit || 'g') || 0;
                  const itemWeightStr =
                    item.totalWeightDisplay ||
                    (pieceGrams > 0 ? formatWeight(pieceGrams * item.quantity) : '-');

                  return (
                  <tr key={idx}>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900 flex items-center flex-wrap gap-1.5">
                        <span>{displayTitle}</span>
                        {isCombo && (
                          <span className="text-[10px] font-bold text-blue-700 bg-blue-100/80 px-2 py-0.5 rounded-full uppercase tracking-wider">
                            Combo
                          </span>
                        )}
                        {item.isAutoGenerated && (
                          <span className="text-[10px] font-bold text-blue-700 bg-blue-100/80 px-2 py-0.5 rounded-full uppercase tracking-wider">
                            Auto Linked
                          </span>
                        )}
                      </div>
                      {isCombo && (hasInner || hasCap) && (
                        <div className="text-[11px] font-medium text-slate-500 mt-1 flex flex-wrap gap-2">
                          <span>Included:</span>
                          {hasInner && <span className="text-slate-700 font-semibold">{item.selectedInnerName || 'Inner'} × {item.quantity.toLocaleString()}</span>}
                          {hasInner && hasCap && <span>•</span>}
                          {hasCap && <span className="text-slate-700 font-semibold">{item.selectedCapName || 'Cap'} × {item.quantity.toLocaleString()}</span>}
                        </div>
                      )}
                      {item.packagingMode && item.packagingMode !== 'bottle_only' && !isCombo && (
                        <div className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md inline-flex items-center gap-1 mt-1 border border-blue-100">
                          Packaging: {formatPackagingMode(item.packagingMode)}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 capitalize">{item.productType}</td>
                    <td className="py-3.5 px-4">
                      <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-[11px] font-semibold">
                        Category {item.priceCategory}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">₹{item.unitPrice.toFixed(2)}</td>
                    <td className="py-3.5 px-4 font-semibold">
                      {item.soldByPacket && item.packetCount && item.unitsPerPacket ? (
                        <div className="space-y-0.5">
                          <div>Quantity: {item.packetCount.toLocaleString('en-IN')} Packets</div>
                          <div className="text-[11px] font-medium text-slate-500">
                            Units per Packet: {item.unitsPerPacket.toLocaleString('en-IN')}
                          </div>
                          <div className="text-[11px] font-medium text-slate-500">
                            Total Units: {item.quantity.toLocaleString('en-IN')}
                          </div>
                        </div>
                      ) : (
                        item.quantity.toLocaleString()
                      )}
                    </td>
                    {hasAnyWeightInOrder && (
                      <td className="py-3.5 px-4 font-semibold text-slate-900">
                        <div>{itemWeightStr}</div>
                        {item.weightPerPiece && (
                          <div className="text-[10px] font-medium text-slate-400">
                            {item.weightPerPiece} {item.weightUnit || 'g'}/pc
                          </div>
                        )}
                      </td>
                    )}
                    <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                      ₹{item.subtotal.toLocaleString()}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Invoice Math Footer */}
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pt-4 border-t border-slate-100">
            <div className="text-xs text-slate-600 space-y-1.5 bg-slate-50 p-3 rounded-xl border border-slate-100 min-w-[200px]">
              <div className="flex justify-between gap-4">
                <span>Total Quantity:</span>
                <span className="font-bold text-slate-900">{totalPieces.toLocaleString()} pcs</span>
              </div>
              {hasAnyWeightInOrder && totalOrderWeightDisplay && (
                <div className="flex justify-between gap-4 pt-1 border-t border-slate-200">
                  <span>Total Order Weight:</span>
                  <span className="font-bold text-blue-700">{totalOrderWeightDisplay}</span>
                </div>
              )}
            </div>
            <div className="w-full sm:w-72 space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal:</span>
                <span className="font-semibold">₹{order.subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>GST ({order.gstRate}%):</span>
                <span className="font-semibold">₹{order.gstAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-base font-bold text-slate-900 pt-2 border-t border-slate-200">
                <span>Grand Total:</span>
                <span className="text-blue-600">₹{order.totalAmount.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>

      </div>
      {/* ═══════════════════════════════════════════════════════════════════
          END SCREEN-ONLY ERP VIEW
      ═══════════════════════════════════════════════════════════════════ */}

      <EditOrderItemsModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        order={order}
        onSaved={setOrder}
      />
    </div>
  );
};
