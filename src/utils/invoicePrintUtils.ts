import { Order, Customer, Settings } from '../types';
import { formatPackagingMode } from './packagingUtils';
import { formatWeight, getWeightInGrams } from './weightUtils';

// ── Number-to-words helper (Indian numbering) ─────────────────────────────────
const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

export function numToWords(n: number): string {
  if (n === 0) return 'Zero';
  if (n < 0) return 'Minus ' + numToWords(-n);
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : '');
  if (n < 1000) return ONES[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + numToWords(n % 100) : '');
  if (n < 100000) return numToWords(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + numToWords(n % 1000) : '');
  if (n < 10000000) return numToWords(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + numToWords(n % 100000) : '');
  return numToWords(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + numToWords(n % 10000000) : '');
}

export function amountInWords(amount: number): string {
  const rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);
  let result = 'Rupees ' + numToWords(rupees);
  if (paise > 0) result += ' and ' + numToWords(paise) + ' Paise';
  return result + ' Only';
}

export function formatInvoiceDate(dateStr: string): string {
  try {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  } catch {
    return dateStr;
  }
}

/**
 * Returns true if the order represents a Pakka Bill (Tax Invoice with GST applied),
 * or false if it represents a non-GST Kachha Bill.
 */
export function isPakkaBill(order: Order): boolean {
  if (typeof order.gstApplied === 'boolean') {
    return order.gstApplied;
  }
  if (order.billType === 'pakka') return true;
  if (order.billType === 'kachha') return false;
  return (order.gstRate ?? 0) > 0 && (order.gstAmount ?? 0) > 0;
}

/**
 * Generates the complete, standalone HTML document for either a
 * KACHHA BILL (GST unchecked) or a PAKKA BILL / TAX INVOICE (GST checked).
 */
export function generateInvoiceHtml(
  order: Order,
  settings?: Partial<Settings> | null,
  customer?: Partial<Customer> | null
): string {
  const isGst = isPakkaBill(order);
  const pendingBalance = Math.max(0, order.totalAmount - order.paidAmount);

  const companyName = settings?.companyName || 'Angel Pet Packaging Solutions Pvt Ltd';
  const companyAddress = settings?.address || 'Plot 108, GIDC Industrial Estate, Makarpura, Vadodara, Gujarat – 390010';
  const companyPhone = settings?.phone || '+91 98250 99887';
  const companyEmail = settings?.email || 'sales@angelpetpackaging.com';
  const companyGstin = isGst ? (settings?.gstin || '24AAACA1234B1Z9') : '';

  const customerGstin = isGst ? customer?.gstin : undefined;

  const hasAnyWeightInOrder =
    (typeof order.totalWeightGrams === 'number' && order.totalWeightGrams > 0) ||
    order.items.some((item) =>
      (typeof item.totalWeightGrams === 'number' && item.totalWeightGrams > 0) ||
      (typeof item.weightPerPiece === 'number' && item.weightPerPiece > 0)
    );

  const totalPieces = order.totalQuantity || order.items.reduce((sum, item) => sum + (item.quantity || 0), 0);
  const totalOrderWeightGrams =
    typeof order.totalWeightGrams === 'number' && order.totalWeightGrams > 0
      ? order.totalWeightGrams
      : hasAnyWeightInOrder
      ? order.items.reduce((sum, item) => {
          const w =
            typeof item.totalWeightGrams === 'number' && item.totalWeightGrams > 0
              ? item.totalWeightGrams
              : typeof item.weightPerPiece === 'number' && item.weightPerPiece > 0
              ? (getWeightInGrams(item.weightPerPiece, item.weightUnit) || 0) * item.quantity
              : 0;
          return sum + w;
        }, 0)
      : null;
  const totalOrderWeightDisplay = order.totalWeightDisplay || formatWeight(totalOrderWeightGrams);

  const itemsRows = order.items
    .map((item, idx) => {
      const bg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
      const qtyDisplay =
        item.soldByPacket && item.packetCount && item.unitsPerPacket
          ? `<div>${item.packetCount.toLocaleString('en-IN')} Packets</div>
             <div style="font-size: 8.5px; color: #64748b; font-weight: 500; margin-top: 2px;">Units per Packet: ${item.unitsPerPacket.toLocaleString('en-IN')}</div>
             <div style="font-size: 8.5px; color: #64748b; font-weight: 500;">Total Units: ${item.quantity.toLocaleString('en-IN')} pcs</div>`
          : `${item.quantity.toLocaleString('en-IN')} pcs`;

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

      const componentBreakdown = isCombo && (hasInner || hasCap)
        ? `<div style="font-size: 8.5px; color: #475569; font-weight: 500; margin-top: 2px;">
             Included: ${hasInner ? `${item.selectedInnerName || 'Inner'} × ${item.quantity.toLocaleString('en-IN')}` : ''}${hasInner && hasCap ? ' • ' : ''}${hasCap ? `${item.selectedCapName || 'Cap'} × ${item.quantity.toLocaleString('en-IN')}` : ''}
           </div>`
        : '';

      const packagingInfo = item.packagingMode && item.packagingMode !== 'bottle_only' && !isCombo
        ? `<div style="font-size: 9px; color: #2563eb; font-weight: 700; margin-top: 2px;">Packaging: ${formatPackagingMode(item.packagingMode)}</div>`
        : '';

      const autoLinkedBadge = item.isAutoGenerated
        ? `<span style="font-size: 8px; background: #e0f2fe; color: #0284c7; padding: 1px 5px; border-radius: 4px; font-weight: 700; margin-left: 6px; text-transform: uppercase;">Auto Linked</span>`
        : '';

      const comboBadge = isCombo
        ? `<span style="font-size: 8px; background: #dbeafe; color: #1e40af; padding: 1px 5px; border-radius: 4px; font-weight: 700; margin-left: 6px; text-transform: uppercase;">Combo</span>`
        : '';

      const itemWeightGrams =
        typeof item.totalWeightGrams === 'number' && item.totalWeightGrams > 0
          ? item.totalWeightGrams
          : typeof item.weightPerPiece === 'number' && item.weightPerPiece > 0
          ? (getWeightInGrams(item.weightPerPiece, item.weightUnit) || 0) * item.quantity
          : null;
      const itemWeightDisplay = item.totalWeightDisplay || formatWeight(itemWeightGrams);

      return `
        <tr style="background: ${bg};">
          <td style="padding: 7px 10px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-weight: 600;">${idx + 1}</td>
          <td style="padding: 7px 10px; border-bottom: 1px solid #e2e8f0; font-weight: 700; color: #0f172a;">
            ${displayTitle}${comboBadge}${autoLinkedBadge}
            ${componentBreakdown}
            ${packagingInfo}
            <div style="font-size: 9px; color: #94a3b8; font-weight: 400; margin-top: 1px;">Category ${item.priceCategory} Pricing</div>
          </td>
          <td style="padding: 7px 10px; border-bottom: 1px solid #e2e8f0; text-align: center; color: #475569; font-weight: 600; text-transform: capitalize;">${item.productType}</td>
          <td style="padding: 7px 10px; border-bottom: 1px solid #e2e8f0; text-align: center; font-weight: 700; color: #0f172a;">${qtyDisplay}</td>
          <td style="padding: 7px 10px; border-bottom: 1px solid #e2e8f0; text-align: right; color: #0f172a; font-weight: 600;">₹${item.unitPrice.toFixed(2)}</td>
          ${hasAnyWeightInOrder ? `
            <td style="padding: 7px 10px; border-bottom: 1px solid #e2e8f0; text-align: center; font-weight: 700; color: #0f172a;">${itemWeightDisplay || '-'}</td>
          ` : ''}
          <td style="padding: 7px 10px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 700; color: #0f172a;">₹${item.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        </tr>
      `;
    })
    .join('');

  const paymentStatusText =
    order.paymentStatus === 'partially_paid'
      ? 'Partially Paid'
      : order.paymentStatus === 'paid'
      ? 'Paid'
      : 'Unpaid';

  const paymentStatusColor =
    order.paymentStatus === 'paid' ? '#16a34a' : order.paymentStatus === 'partially_paid' ? '#d97706' : '#dc2626';

  const orderStatusColor =
    order.orderStatus === 'completed' ? '#16a34a' : order.orderStatus === 'cancelled' ? '#dc2626' : '#d97706';

  const isAS = order.orderType === 'AS';
  const isCashMemo = order.paymentType === 'cash_memo';
  const memoLabel = isAS ? 'AS ORDER' : isCashMemo ? 'CASH MEMO' : 'DEBIT MEMO';
  const memoColor = isAS ? '#7e22ce' : isCashMemo ? '#16a34a' : '#2563eb';
  const memoBg = isAS ? '#f3e8ff' : isCashMemo ? '#dcfce7' : '#dbeafe';

  const titleText = isAS ? 'NON-COMMERCIAL ORDER' : isGst ? 'TAX INVOICE' : 'KACHHA BILL';
  const headerThemeGradient = isAS
    ? 'linear-gradient(135deg,#581c87 0%,#7e22ce 100%)'
    : isGst
    ? 'linear-gradient(135deg,#1e3a8a 0%,#2563eb 100%)'
    : 'linear-gradient(135deg,#334155 0%,#475569 100%)';
  const boxBorderColor = isAS ? '#a855f7' : isGst ? '#2563eb' : '#64748b';
  const boxBgColor = isAS ? '#faf5ff' : isGst ? '#f0f9ff' : '#f8fafc';
  const boxTitleColor = isAS ? '#581c87' : isGst ? '#1e3a8a' : '#334155';
  const dividerGradient = isAS
    ? 'linear-gradient(90deg,#7e22ce 0%,#d8b4fe 100%)'
    : isGst
    ? 'linear-gradient(90deg,#2563eb 0%,#bfdbfe 100%)'
    : 'linear-gradient(90deg,#64748b 0%,#cbd5e1 100%)';
  const tableHeaderBg = isAS ? '#581c87' : isGst ? '#1e3a8a' : '#334155';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${titleText} (${memoLabel}) - ${order.orderNumber}</title>
  <style>
    @page { size: A4 portrait; margin: 0; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 0;
      background: #f1f5f9;
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 11px;
      color: #1a1a2e;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .page {
      background: #fff;
      width: 210mm;
      min-height: 297mm;
      margin: 20px auto;
      padding: 14mm 16mm 10mm;
      box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
    }
    @media print {
      body { background: #fff; }
      .page {
        margin: 0;
        box-shadow: none;
        width: 100%;
        min-height: 297mm;
      }
    }
  </style>
</head>
<body>
  <div class="page">
    <!-- HEADER -->
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 10px;">
      <tbody>
        <tr>
          <!-- LEFT: Branding -->
          <td style="vertical-align: top; width: 55%;">
            <div style="display: inline-block; background: ${headerThemeGradient}; border-radius: 8px; padding: 10px 18px; margin-bottom: 6px;">
              <div style="color: #fff; font-weight: 900; font-size: 18px; letter-spacing: 0.5px; line-height: 1.1;">🐾 ${companyName.toUpperCase()}</div>
              <div style="color: #bfdbfe; font-weight: 600; font-size: 9px; letter-spacing: 2px; margin-top: 2px;">PACKAGING SOLUTIONS</div>
            </div>
            <div style="font-size: 9px; color: #475569; line-height: 1.6; margin-top: 4px;">
              <div>${companyAddress}</div>
              <div>📞 ${companyPhone} &nbsp;|&nbsp; ✉ ${companyEmail}</div>
              ${isGst && companyGstin ? `
                <div style="margin-top: 2px;">
                  <strong style="color: #1e40af;">GSTIN:</strong>&nbsp;${companyGstin}
                </div>
              ` : ''}
            </div>
          </td>

          <!-- RIGHT: Invoice meta box -->
          <td style="vertical-align: top; text-align: right;">
            <div style="background: ${boxBgColor}; border: 2px solid ${boxBorderColor}; border-radius: 8px; padding: 10px 16px; display: inline-block; min-width: 190px; text-align: left;">
              <div style="color: ${boxTitleColor}; font-weight: 900; font-size: 16px; letter-spacing: 0.5px; text-align: center;">${titleText}</div>
              <div style="text-align: center; margin-top: 3px;">
                <span style="display: inline-block; background: ${memoBg}; color: ${memoColor}; font-weight: 800; font-size: 9px; padding: 2px 8px; border-radius: 4px; letter-spacing: 1px;">
                  ${memoLabel}
                </span>
              </div>
              <div style="margin-top: 6px; border-top: 1px solid #cbd5e1; padding-top: 6px;">
                <table style="width: 100%; font-size: 9.5px; border-collapse: collapse;">
                  <tbody>
                    <tr>
                      <td style="color: #64748b; padding-bottom: 2px;">${isAS ? 'Order No.' : isGst ? 'Invoice No.' : 'Bill No.'}</td>
                      <td style="font-weight: 800; color: ${boxTitleColor}; text-align: right;">${order.orderNumber}</td>
                    </tr>
                    <tr>
                      <td style="color: #64748b; padding-bottom: 2px;">Doc Type</td>
                      <td style="font-weight: 800; color: ${memoColor}; text-align: right;">${memoLabel}</td>
                    </tr>
                    <tr>
                      <td style="color: #64748b;">Date</td>
                      <td style="font-weight: 700; text-align: right;">${formatInvoiceDate(order.orderDate)}</td>
                    </tr>
                    <tr>
                      <td style="color: #64748b; padding-top: 2px;">Status</td>
                      <td style="font-weight: 700; text-align: right; text-transform: capitalize; color: ${orderStatusColor};">${order.orderStatus}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </td>
        </tr>
      </tbody>
    </table>

    <!-- Gradient divider -->
    <div style="height: 2px; background: ${dividerGradient}; border-radius: 2px; margin-bottom: 10px;"></div>

    <!-- BILL-TO + PAYMENT SUMMARY -->
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 10px;">
      <tbody>
        <tr>
          <td style="width: 50%; vertical-align: top; padding-right: 8px;">
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 12px;">
              <div style="font-size: 8px; font-weight: 800; color: #94a3b8; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 5px;">${isGst ? 'Bill To' : 'Customer Details'}</div>
              <div style="font-weight: 800; font-size: 13px; color: #0f172a; margin-bottom: 2px;">${order.companyName}</div>
              <div style="color: #475569; font-size: 10px;">Attn: ${order.customerName}</div>
              ${isGst && customerGstin ? `
                <div style="color: #1e40af; font-size: 9.5px; margin-top: 2px; font-weight: 600;">
                  GSTIN: ${customerGstin}
                </div>
              ` : ''}
            </div>
          </td>
          <td style="width: 50%; vertical-align: top; padding-left: 8px;">
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 12px;">
              <div style="font-size: 8px; font-weight: 800; color: #94a3b8; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 5px;">${isAS ? 'Order Classification' : 'Payment Summary'}</div>
              ${isAS ? `
                <table style="width: 100%; font-size: 10px; border-collapse: collapse;">
                  <tbody>
                    <tr>
                      <td style="color: #475569; padding-bottom: 2px;">Order Type:</td>
                      <td style="text-align: right; font-weight: 800; color: #7e22ce;">AS Order</td>
                    </tr>
                    <tr>
                      <td style="color: #475569; padding-bottom: 2px;">Financial Impact:</td>
                      <td style="text-align: right; font-weight: 700; color: #16a34a;">None (₹0)</td>
                    </tr>
                    <tr style="border-top: 1px solid #e2e8f0;">
                      <td style="color: #0f172a; font-weight: 700; padding-top: 3px;">Inventory Impact:</td>
                      <td style="text-align: right; font-weight: 700; color: #64748b; padding-top: 3px;">None</td>
                    </tr>
                  </tbody>
                </table>
              ` : `
                <table style="width: 100%; font-size: 10px; border-collapse: collapse;">
                  <tbody>
                    <tr>
                      <td style="color: #475569; padding-bottom: 2px;">Payment Status:</td>
                      <td style="text-align: right; font-weight: 700; text-transform: capitalize; color: ${paymentStatusColor};">${paymentStatusText}</td>
                    </tr>
                    <tr>
                      <td style="color: #475569; padding-bottom: 2px;">Amount Paid:</td>
                      <td style="text-align: right; font-weight: 700; color: #16a34a;">₹${order.paidAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                    <tr style="border-top: 1px solid #e2e8f0;">
                      <td style="color: #0f172a; font-weight: 700; padding-top: 3px;">Balance Due:</td>
                      <td style="text-align: right; font-weight: 800; padding-top: 3px; color: ${pendingBalance > 0 ? '#dc2626' : '#16a34a'};">₹${pendingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                  </tbody>
                </table>
              `}
            </div>
          </td>
        </tr>
      </tbody>
    </table>

    <!-- ITEMS TABLE -->
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 4px;">
      <thead>
        <tr style="background: ${tableHeaderBg};">
          <th style="color: #fff; font-weight: 700; font-size: 9px; letter-spacing: 0.8px; text-transform: uppercase; padding: 8px 10px; text-align: left; width: 4%;">#</th>
          <th style="color: #fff; font-weight: 700; font-size: 9px; letter-spacing: 0.8px; text-transform: uppercase; padding: 8px 10px; text-align: left;">Description / Product</th>
          <th style="color: #fff; font-weight: 700; font-size: 9px; letter-spacing: 0.8px; text-transform: uppercase; padding: 8px 10px; text-align: center; width: 9%;">Type</th>
          <th style="color: #fff; font-weight: 700; font-size: 9px; letter-spacing: 0.8px; text-transform: uppercase; padding: 8px 10px; text-align: center; width: 11%;">Qty</th>
          <th style="color: #fff; font-weight: 700; font-size: 9px; letter-spacing: 0.8px; text-transform: uppercase; padding: 8px 10px; text-align: right; width: 13%;">Unit Rate (₹)</th>
          ${hasAnyWeightInOrder ? `
            <th style="color: #fff; font-weight: 700; font-size: 9px; letter-spacing: 0.8px; text-transform: uppercase; padding: 8px 10px; text-align: center; width: 12%;">Weight</th>
          ` : ''}
          <th style="color: #fff; font-weight: 700; font-size: 9px; letter-spacing: 0.8px; text-transform: uppercase; padding: 8px 10px; text-align: right; width: 14%;">${isGst ? 'Taxable Amount (₹)' : 'Amount (₹)'}</th>
        </tr>
      </thead>
      <tbody>
        ${itemsRows}
      </tbody>
    </table>

    <!-- TOTALS & SUMMARY -->
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 8px;">
      <tbody>
        <tr>
          <!-- Left: notes & logistics summary -->
          <td style="vertical-align: top; padding-right: 12px; width: 48%;">
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 7px 10px; font-size: 9.5px; color: #334155; margin-bottom: 6px;">
              <div><strong>TOTAL QUANTITY:</strong> ${totalPieces.toLocaleString('en-IN')} pcs</div>
              ${hasAnyWeightInOrder && totalOrderWeightDisplay ? `
                <div style="margin-top: 2px;"><strong>TOTAL WEIGHT:</strong> <span style="color: #0f172a; font-weight: 800;">${totalOrderWeightDisplay}</span></div>
              ` : ''}
            </div>
            ${order.notes ? `
              <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; padding: 8px 10px; font-size: 9.5px; color: #78350f;">
                <strong>Note:</strong> ${order.notes}
              </div>
            ` : ''}
          </td>

          <!-- Right: calculation summary -->
          <td style="vertical-align: top; width: 52%;">
            <table style="width: 100%; border-collapse: collapse; font-size: 10.5px;">
              <tbody>
                <tr>
                  <td style="padding: 4px 10px; color: #475569;">${isGst ? 'Subtotal (Taxable):' : 'Subtotal:'}</td>
                  <td style="padding: 4px 10px; text-align: right; font-weight: 600; color: #0f172a;">₹${order.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
                ${isGst && order.gstRate > 0 && order.gstAmount > 0 ? `
                  <tr>
                    <td style="padding: 4px 10px; color: #475569;">CGST (${order.gstRate / 2}%):</td>
                    <td style="padding: 4px 10px; text-align: right; font-weight: 600; color: #0f172a;">₹${(order.gstAmount / 2).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>
                  <tr>
                    <td style="padding: 4px 10px; color: #475569;">SGST (${order.gstRate / 2}%):</td>
                    <td style="padding: 4px 10px; text-align: right; font-weight: 600; color: #0f172a;">₹${(order.gstAmount / 2).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>
                ` : ''}
                <tr style="background: ${tableHeaderBg};">
                  <td style="padding: 7px 10px; color: #fff; font-weight: 800; font-size: 12px;">GRAND TOTAL:</td>
                  <td style="padding: 7px 10px; text-align: right; color: #93c5fd; font-weight: 900; font-size: 13px;">₹${order.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 10px; color: #16a34a; font-weight: 600;">Amount Received:</td>
                  <td style="padding: 4px 10px; text-align: right; font-weight: 700; color: #16a34a;">₹${order.paidAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
                <tr style="border-top: 2px solid #e2e8f0;">
                  <td style="padding: 5px 10px; font-weight: 700; color: ${pendingBalance > 0 ? '#dc2626' : '#16a34a'};">${pendingBalance > 0 ? 'Balance Outstanding:' : 'Fully Settled ✓'}</td>
                  <td style="padding: 5px 10px; text-align: right; font-weight: 800; color: ${pendingBalance > 0 ? '#dc2626' : '#16a34a'};">₹${pendingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
              </tbody>
            </table>
          </td>
        </tr>
      </tbody>
    </table>

    <!-- AMOUNT IN WORDS BOX (Positioned near bottom, spanning full width) -->
    <div style="background: ${boxBgColor}; border: 1px solid #cbd5e1; border-radius: 6px; padding: 7px 12px; font-size: 9.5px; color: ${boxTitleColor}; margin-bottom: 8px;">
      <span style="font-weight: 800; color: #64748b; font-size: 8.5px; text-transform: uppercase; letter-spacing: 0.5px;">Amount in Words: </span>
      <span style="font-weight: 700; color: ${boxTitleColor}; font-size: 10px;">${amountInWords(order.totalAmount)}</span>
    </div>

    <!-- TERMS + SIGNATORY -->
    <div style="height: 1px; background: #e2e8f0; margin-bottom: 8px;"></div>
    <table style="width: 100%; border-collapse: collapse; font-size: 9px; margin-bottom: 10px;">
      <tbody>
        <tr>
          <td style="vertical-align: top; width: 55%; padding-right: 12px; color: #475569;">
            <div style="font-weight: 700; color: ${boxTitleColor}; margin-bottom: 3px; font-size: 9.5px;">Terms &amp; Conditions</div>
            <div>1. Goods once sold will not be taken back.</div>
            <div>2. Payment is due within 30 days of invoice date.</div>
            <div>3. All disputes subject to Vadodara jurisdiction only.</div>
          </td>
          <td style="vertical-align: top; width: 45%; padding-left: 12px;">
            <div style="font-weight: 700; color: ${boxTitleColor}; margin-bottom: 3px; font-size: 9.5px;">For ${companyName}</div>
            <div style="height: 42px; border-bottom: 1px dashed #cbd5e1; margin-bottom: 4px;"></div>
            <div style="color: #64748b;">Authorised Signatory</div>
          </td>
        </tr>
      </tbody>
    </table>

    <!-- FOOTER -->
    <div style="border-top: 1px solid #e2e8f0; padding-top: 6px; text-align: center; font-size: 8px; color: #94a3b8;">
      <strong style="color: ${boxTitleColor};">${companyName}</strong>
      &nbsp;|&nbsp; ${companyAddress}
      ${isGst && companyGstin ? `&nbsp;|&nbsp; GSTIN: ${companyGstin}` : ''}
      &nbsp;|&nbsp; This is a computer-generated ${isGst ? 'tax invoice' : 'kachha bill'}.
    </div>
  </div>
</body>
</html>`;
}

/**
 * Triggers printing of either Kachha Bill or Pakka Bill depending on order's GST configuration.
 * Accepts an optional preOpenedWindow to preserve user gesture and avoid popup blockers.
 * Returns true if successfully printed/opened, or false if blocked.
 */
export function printInvoice(
  order: Order,
  preOpenedWindow?: Window | null,
  settings?: Partial<Settings> | null,
  customer?: Partial<Customer> | null
): boolean {
  const invoiceHtml = generateInvoiceHtml(order, settings, customer);

  let targetWin = preOpenedWindow;
  if (!targetWin || targetWin.closed) {
    try {
      targetWin = window.open('', '_blank');
    } catch {
      targetWin = null;
    }
  }

  if (!targetWin) {
    return false;
  }

  try {
    targetWin.document.open();
    targetWin.document.write(invoiceHtml);
    targetWin.document.close();

    // Small delay to ensure rendering before invoking print
    targetWin.setTimeout(() => {
      try {
        targetWin?.focus();
        targetWin?.print();
      } catch (e) {
        console.error('Error invoking print:', e);
      }
    }, 250);

    return true;
  } catch (err) {
    console.error('Failed to write invoice to print window:', err);
    return false;
  }
}
