import React from 'react';
import { Dispatch, Order } from '../../types';
import { formatDateDDMMYYYY } from '../../utils/dateUtils';

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

interface SubDeliveryChallanPrintProps {
  dispatch: Dispatch;
  order?: Order | null;
}

export const SubDeliveryChallanPrint: React.FC<SubDeliveryChallanPrintProps> = ({ dispatch, order }) => {
  const totalUnits = dispatch.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div style={S.page}>
      {/* ── HEADER ─────────────────────────────────────────────────── */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '10px' }}>
        <tbody>
          <tr>
            <td style={{ ...S.headerCell, textAlign: 'right' }}>
              <div style={S.challanBox}>
                <div style={S.challanTitle}>SUB-DELIVERY CHALLAN</div>
                <div style={{ marginTop: '6px', borderTop: '1px solid #bfdbfe', paddingTop: '6px' }}>
                  <table style={{ width: '100%', fontSize: '9.5px', borderCollapse: 'collapse' }}>
                    <tbody>
                      <tr>
                        <td style={{ color: '#64748b', paddingBottom: '2px' }}>Challan No.</td>
                        <td style={{ fontWeight: '800', color: '#1e3a8a', textAlign: 'right' }}>
                          {dispatch.dispatchNumber}
                        </td>
                      </tr>
                      <tr>
                        <td style={{ color: '#64748b' }}>Delivery Date</td>
                        <td style={{ fontWeight: '700', textAlign: 'right' }}>
                          {formatDateDDMMYYYY(dispatch.dispatchDate)}
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
                              dispatch.status === 'delivered'
                                ? '#16a34a'
                                : dispatch.status === 'dispatched'
                                ? '#d97706'
                                : '#64748b'
                          }}
                        >
                          {dispatch.status}
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
                  {dispatch.customerName}
                </div>
                {order && (
                  <div style={{ color: '#475569', fontSize: '10px' }}>Company: {order.companyName || '—'}</div>
                )}
              </div>
            </td>
            <td style={{ width: '50%', verticalAlign: 'top', paddingLeft: '8px' }}>
              <div style={S.infoBox}>
                <div style={S.infoLabel}>Order Reference</div>
                <table style={{ width: '100%', fontSize: '10px', borderCollapse: 'collapse' }}>
                  <tbody>
                    {order?.orderType === 'AS' && (
                      <tr>
                        <td style={{ color: '#475569', paddingBottom: '2px' }}>Order Type:</td>
                        <td style={{ fontWeight: '700', textAlign: 'right', color: '#d97706' }}>
                          AS Order (Non-Commercial)
                        </td>
                      </tr>
                    )}
                    {order && (
                      <tr>
                        <td style={{ color: '#475569' }}>Order Date:</td>
                        <td style={{ fontWeight: '600', textAlign: 'right' }}>
                          {formatDateDDMMYYYY(order.orderDate)}
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
                        {dispatch.vehicleNumber || 'Pending'}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ color: '#475569' }}>Driver Name:</td>
                      <td style={{ fontWeight: '600', textAlign: 'right' }}>
                        {dispatch.driverName || 'Pending'}
                      </td>
                    </tr>
                    {dispatch.driverPhone && (
                      <tr>
                        <td style={{ color: '#475569' }}>Driver Phone:</td>
                        <td style={{ fontWeight: '600', textAlign: 'right' }}>
                          {dispatch.driverPhone}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </td>
            <td style={{ width: '50%', verticalAlign: 'top', paddingLeft: '8px' }}>
              {dispatch.notes ? (
                <div style={S.infoBox}>
                  <div style={S.infoLabel}>Delivery Notes / LR No</div>
                  <div style={{ fontSize: '9.5px', color: '#475569', lineHeight: 1.4 }}>
                    {dispatch.notes}
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
          {dispatch.items.map((item, idx) => (
            <tr key={idx} style={{ background: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
              <td style={{ padding: '7px 10px', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontWeight: '600' }}>
                {idx + 1}
              </td>
              <td style={{ padding: '7px 10px', borderBottom: '1px solid #e2e8f0', fontWeight: '700', color: '#0f172a' }}>
                {item.productName}
              </td>
              <td style={{ padding: '7px 10px', borderBottom: '1px solid #e2e8f0', textAlign: 'center', fontWeight: '800', color: '#0f172a', fontSize: '12px' }}>
                {item.deliveryUnit === 'packets' && item.packetQuantity !== undefined
                  ? `${item.packetQuantity.toLocaleString('en-IN')} + ${(item.loosePieces || 0).toLocaleString('en-IN')} loose`
                  : item.quantity.toLocaleString('en-IN')}
                {item.deliveryUnit === 'packets' && item.unitsPerPacket
                  ? <div style={{ fontSize: '8px', fontWeight: '600', color: '#475569', marginTop: '2px' }}>({item.quantity.toLocaleString('en-IN')} pcs)</div>
                  : null}
              </td>
              <td style={{ padding: '7px 10px', borderBottom: '1px solid #e2e8f0', textAlign: 'center', color: '#475569', fontWeight: '600' }}>
                {item.deliveryUnit === 'packets' && item.unitsPerPacket
                  ? <>{item.packetQuantity === 1 ? 'packet' : 'packets'}<div style={{ fontSize: '8px', fontWeight: '500' }}>{item.unitsPerPacket} pcs/packet + {item.loosePieces || 0} loose pcs</div></>
                  : 'pcs'}
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
                {numToWords(totalUnits)} Units Only
              </div>
            </td>
            <td style={{ width: '35%', verticalAlign: 'top' }}>
              <div style={S.infoBox}>
                <div style={{ fontSize: '8px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>
                  This Shipment Total
                </div>
                <div style={{ fontSize: '15px', fontWeight: '800', color: '#1e3a8a', textAlign: 'right' }}>
                  {totalUnits.toLocaleString('en-IN')} Units
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
                  Authorized Signatory
                </div>
              </div>
            </td>
            <td style={{ width: '50%', verticalAlign: 'top', paddingLeft: '8px' }}>
              <div style={{ borderTop: '1px solid #1e3a8a', paddingTop: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '9px', fontWeight: '700', color: '#1e3a8a', marginBottom: '4px' }}>
                  Receiver's Signature & Stamp
                </div>
                <div style={{ fontSize: '8px', color: '#64748b' }}>
                  {dispatch.customerName}
                </div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <div style={S.footer}>
        <div>This is a computer-generated Sub-Delivery Challan. No signature required.</div>
        <div style={{ marginTop: '2px' }}>Generated by Angel Pet ERP System</div>
      </div>
    </div>
  );
};
