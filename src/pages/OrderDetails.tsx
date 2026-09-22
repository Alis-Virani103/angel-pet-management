import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Order } from '../types';
import { getOrders, uploadOrderSignedCopy, removeOrderSignedCopy } from '../services/db';
import { Badge } from '../components/common/Badge';
import { EditOrderItemsModal } from '../components/modals/EditOrderItemsModal';
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
  FileText
  , UploadCloud
  , Download
  , Trash2
  , Loader2
  , AlertCircle
} from 'lucide-react';

interface OrderDetailsProps {
  onOpenRecordPaymentModal: (orderId?: string) => void;
  onOpenNewDispatchModal: (orderId?: string) => void;
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

function amountInWords(amount: number): string {
  const rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);
  let result = 'Rupees ' + numToWords(rupees);
  if (paise > 0) result += ' and ' + numToWords(paise) + ' Paise';
  return result + ' Only';
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
      const list = await getOrders();
      const found = list.find((o) => o.id === orderId || o.orderNumber === orderId);
      if (found) {
        setOrder(found);
      }
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

  const pendingBalance = Math.max(0, order.totalAmount - order.paidAmount);

  return (
    <div className="space-y-6">

      {/* ═══════════════════════════════════════════════════════════════════
          PRINT-ONLY PROFESSIONAL A4 INVOICE
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

                {/* RIGHT: Invoice meta box */}
                <td style={{ ...S.headerCell, textAlign: 'right' }}>
                  <div style={S.invoiceBox}>
                    <div style={S.invoiceTitle}>TAX INVOICE</div>
                    <div style={{ marginTop: '6px', borderTop: '1px solid #bfdbfe', paddingTop: '6px' }}>
                      <table style={{ width: '100%', fontSize: '9.5px', borderCollapse: 'collapse' }}>
                        <tbody>
                          <tr>
                            <td style={{ color: '#64748b', paddingBottom: '2px' }}>Invoice No.</td>
                            <td style={{ fontWeight: '800', color: '#1e3a8a', textAlign: 'right' }}>{order.orderNumber}</td>
                          </tr>
                          <tr>
                            <td style={{ color: '#64748b' }}>Date</td>
                            <td style={{ fontWeight: '700', textAlign: 'right' }}>{formatDate(order.orderDate)}</td>
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
          <div style={S.divider} />

          {/* ── BILL-TO + PAYMENT SUMMARY ──────────────────────────────── */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '10px' }}>
            <tbody>
              <tr>
                <td style={{ width: '50%', verticalAlign: 'top', paddingRight: '8px' }}>
                  <div style={S.infoBox}>
                    <div style={S.infoLabel}>Bill To</div>
                    <div style={{ fontWeight: '800', fontSize: '13px', color: '#0f172a', marginBottom: '2px' }}>
                      {order.companyName}
                    </div>
                    <div style={{ color: '#475569', fontSize: '10px' }}>Attn: {order.customerName}</div>
                  </div>
                </td>
                <td style={{ width: '50%', verticalAlign: 'top', paddingLeft: '8px' }}>
                  <div style={S.infoBox}>
                    <div style={S.infoLabel}>Payment Summary</div>
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
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

          {/* ── ITEMS TABLE ────────────────────────────────────────────── */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '4px' }}>
            <thead>
              <tr style={{ background: '#1e3a8a' }}>
                <th style={{ ...S.thBase, textAlign: 'left', width: '4%' }}>#</th>
                <th style={{ ...S.thBase, textAlign: 'left' }}>Description / Product</th>
                <th style={{ ...S.thBase, textAlign: 'center', width: '10%' }}>Type</th>
                <th style={{ ...S.thBase, textAlign: 'center', width: '12%' }}>Qty</th>
                <th style={{ ...S.thBase, textAlign: 'right', width: '15%' }}>Unit Rate (₹)</th>
                <th style={{ ...S.thBase, textAlign: 'right', width: '15%' }}>Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item, idx) => (
                <tr key={idx} style={{ background: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                  <td style={{ padding: '7px 10px', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontWeight: '600' }}>
                    {idx + 1}
                  </td>
                  <td style={{ padding: '7px 10px', borderBottom: '1px solid #e2e8f0', fontWeight: '700', color: '#0f172a' }}>
                    {item.productName}
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
                      item.quantity.toLocaleString('en-IN')
                    )}
                  </td>
                  <td style={{ padding: '7px 10px', borderBottom: '1px solid #e2e8f0', textAlign: 'right', color: '#0f172a', fontWeight: '600' }}>
                    {item.unitPrice.toFixed(2)}
                  </td>
                  <td style={{ padding: '7px 10px', borderBottom: '1px solid #e2e8f0', textAlign: 'right', fontWeight: '700', color: '#0f172a' }}>
                    {item.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* ── TOTALS + AMOUNT IN WORDS ───────────────────────────────── */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '10px' }}>
            <tbody>
              <tr>
                {/* Left – amount in words + notes */}
                <td style={{ verticalAlign: 'bottom', paddingRight: '8px', width: '52%' }}>
                  {order.notes && (
                    <div style={{
                      background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '6px',
                      padding: '6px 10px', fontSize: '9.5px', color: '#78350f', marginBottom: '6px'
                    }}>
                      <strong>Note:</strong> {order.notes}
                    </div>
                  )}
                  <div style={{
                    background: '#f0f9ff', border: '1px solid #bfdbfe', borderRadius: '6px',
                    padding: '7px 10px', fontSize: '9.5px', color: '#1e40af'
                  }}>
                    <strong>Amount in Words:</strong><br />
                    {amountInWords(order.totalAmount)}
                  </div>
                </td>

                {/* Right – calculation summary */}
                <td style={{ verticalAlign: 'top', width: '48%' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10.5px' }}>
                    <tbody>
                      <tr>
                        <td style={{ padding: '4px 10px', color: '#475569' }}>Subtotal (excl. tax):</td>
                        <td style={{ padding: '4px 10px', textAlign: 'right', fontWeight: '600', color: '#0f172a' }}>
                          ₹{order.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                      {order.gstRate > 0 && (
                        <tr>
                          <td style={{ padding: '4px 10px', color: '#475569' }}>
                            CGST ({order.gstRate / 2}%) + SGST ({order.gstRate / 2}%):
                          </td>
                          <td style={{ padding: '4px 10px', textAlign: 'right', fontWeight: '600', color: '#0f172a' }}>
                            ₹{order.gstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      )}
                      <tr style={{ background: '#1e3a8a' }}>
                        <td style={{ padding: '8px 10px', color: '#fff', fontWeight: '800', fontSize: '12px' }}>
                          GRAND TOTAL:
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', color: '#93c5fd', fontWeight: '900', fontSize: '13px' }}>
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

          {/* ── TERMS + SIGNATORY ──────────────────────────────────────── */}
          <div style={{ height: '1px', background: '#e2e8f0', marginBottom: '8px' }} />
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9px', marginBottom: '10px' }}>
            <tbody>
              <tr>
                <td style={{ verticalAlign: 'top', width: '55%', paddingRight: '12px', color: '#475569' }}>
                  <div style={{ fontWeight: '700', color: '#1e3a8a', marginBottom: '3px', fontSize: '9.5px' }}>
                    Terms &amp; Conditions
                  </div>
                  <div>1. Goods once sold will not be taken back.</div>
                  <div>2. Payment is due within 30 days of invoice date.</div>
                  <div>3. Interest @ 18% p.a. will be charged on overdue payments.</div>
                  <div>4. All disputes subject to Vadodara jurisdiction only.</div>
                </td>
                <td style={{ verticalAlign: 'top', width: '45%', paddingLeft: '12px' }}>
                  <div style={{ fontWeight: '700', color: '#1e3a8a', marginBottom: '3px', fontSize: '9.5px' }}>
                    For Angel Pet Packaging Solutions Pvt Ltd
                  </div>
                  <div style={{ height: '42px', borderBottom: '1px dashed #cbd5e1', marginBottom: '4px' }} />
                  <div style={{ color: '#64748b' }}>Authorised Signatory</div>
                </td>
              </tr>
            </tbody>
          </table>

          {/* ── FOOTER ─────────────────────────────────────────────────── */}
          <div style={S.footer}>
            <strong style={{ color: '#1e3a8a' }}>Angel Pet Packaging Solutions Pvt Ltd</strong>
            &nbsp;|&nbsp; Plot 108, GIDC Industrial Estate, Makarpura, Vadodara – 390010
            &nbsp;|&nbsp; GSTIN: 24AAACA1234B1Z9
            &nbsp;|&nbsp; This is a computer-generated invoice.
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
              <div className="flex items-center space-x-3">
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{order.orderNumber}</h1>
                <Badge status={order.orderStatus} size="md" />
                <Badge status={order.paymentStatus} size="md" />
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">Order Placed on {order.orderDate}</p>
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
            {order.paymentStatus !== 'paid' && (
              <button
                onClick={() => onOpenRecordPaymentModal(order.id)}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl transition-colors shadow-sm shadow-emerald-500/20 flex items-center space-x-1.5"
              >
                <IndianRupee className="w-3.5 h-3.5" />
                <span>Record Payment</span>
              </button>
            )}
            {order.orderStatus !== 'completed' && order.orderStatus !== 'cancelled' && (
              <button
                onClick={() => onOpenNewDispatchModal(order.id)}
                className="px-3.5 py-2 bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs rounded-xl transition-colors shadow-sm shadow-sky-500/20 flex items-center space-x-1.5"
              >
                <Truck className="w-3.5 h-3.5" />
                <span>New Dispatch</span>
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

          {/* Order Payment Status Card */}
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-3">
            <div className="flex items-center space-x-2 text-xs font-bold text-slate-800 uppercase tracking-wider">
              <IndianRupee className="w-4 h-4 text-emerald-600" />
              <span>Financial Summary</span>
            </div>
            <div className="space-y-1 text-xs">
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

          {/* Dispatch & Delivery Log */}
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-3">
            <div className="flex items-center space-x-2 text-xs font-bold text-slate-800 uppercase tracking-wider">
              <Truck className="w-4 h-4 text-sky-600" />
              <span>Fulfillment Log</span>
            </div>
            <div className="text-xs text-slate-600 space-y-1">
              <p>Order Status: <span className="font-semibold text-slate-900 capitalize">{order.orderStatus}</span></p>
              <p className="text-[11px] text-slate-400">Inventory automatically deducted upon completed dispatch.</p>
            </div>
          </div>
        </div>

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
                  <th className="py-3 px-4 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700 font-medium">
                {order.items.map((item, idx) => (
                  <tr key={idx}>
                    <td className="py-3.5 px-4 font-bold text-slate-900">{item.productName}</td>
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
                    <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                      ₹{item.subtotal.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Invoice Math Footer */}
          <div className="flex justify-end pt-4 border-t border-slate-100">
            <div className="w-72 space-y-2 text-xs">
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
