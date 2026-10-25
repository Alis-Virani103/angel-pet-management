import { describe, it, expect } from 'vitest';
import { calculateSalesTax, isGstExemptOrder, isRegularOrder, isOrderGstApplied } from '../../src/utils/gstUtils';
import { generateInvoiceHtml, isPakkaBill } from '../../src/utils/invoicePrintUtils';
import { buildDayLedger } from '../../src/utils/dayLedger';
import type { Order, Customer, Settings, Payment } from '../../src/types';

describe('GST-Exempt Sales Workflow Tests', () => {
  const dummyCustomer: Customer = {
    id: 'CUST-001',
    name: 'Alis Virani',
    company: 'Apex Industries',
    phone: '9876543210',
    address: 'GIDC Makarpura, Vadodara',
    gstin: '24AAAAA0000A1Z5',
    customerType: 'Direct Customer',
    priceCategory: 'A',
    status: 'active',
    createdAt: '2026-01-01',
    totalOrders: 1,
    totalSpent: 10000
  };

  const dummySettings: Settings = {
    companyName: 'Angel Pet Packaging',
    address: 'Plot 123, GIDC Industrial Estate, Vadodara, Gujarat',
    phone: '+91 99999 88888',
    email: 'info@angelpet.com',
    gstin: '24AABCA1234F1Z8',
    gstRate: 18,
    lowStockThreshold: 100,
    hsnCode: '39233090'
  };

  // ───────────────────────────────────────────────────────────────────────────
  // 1. GST-applied sale
  // ───────────────────────────────────────────────────────────────────────────
  describe('Case 1: GST-applied sale', () => {
    it('calculates 18% GST and totalAmount correctly', () => {
      const subtotal = 10000;
      const result = calculateSalesTax(subtotal, true, 18);

      expect(result.gstApplied).toBe(true);
      expect(result.billType).toBe('pakka');
      expect(result.gstRate).toBe(18);
      expect(result.gstAmount).toBe(1800);
      expect(result.totalAmount).toBe(11800);
    });

    it('classifies GST-applied orders properly across helper functions', () => {
      const gstOrder: Order = {
        id: 'ORD-101',
        orderNumber: 'ORD-101',
        customerId: 'CUST-001',
        customerName: 'Alis Virani',
        companyName: 'Apex Industries',
        items: [{
          id: 'item-1',
          productId: 'P-1',
          productName: '500ml Bottle',
          productType: 'bottle',
          priceCategory: 'A',
          quantity: 1000,
          unitPrice: 10,
          subtotal: 10000
        }],
        subtotal: 10000,
        gstAmount: 1800,
        gstRate: 18,
        totalAmount: 11800,
        gstApplied: true,
        billType: 'pakka',
        paymentType: 'debit_memo',
        orderType: 'REGULAR',
        orderStatus: 'pending',
        paymentStatus: 'pending',
        paidAmount: 0,
        orderDate: '2026-10-24'
      };

      expect(isGstExemptOrder(gstOrder)).toBe(false);
      expect(isRegularOrder(gstOrder)).toBe(true);
      expect(isPakkaBill(gstOrder)).toBe(true);
      expect(isOrderGstApplied(gstOrder)).toBe(true);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. GST-exempt sale
  // ───────────────────────────────────────────────────────────────────────────
  describe('Case 2: GST-exempt sale', () => {
    it('sets gstAmount to 0 and calculates totalAmount strictly equal to subtotal without adding tax', () => {
      const subtotal = 10000;
      const result = calculateSalesTax(subtotal, false, 18);

      expect(result.gstApplied).toBe(false);
      expect(result.billType).toBe('kachha');
      expect(result.gstRate).toBe(0);
      expect(result.gstAmount).toBe(0);
      expect(result.totalAmount).toBe(10000);
      expect(result.totalAmount).toBe(subtotal);
    });

    it('classifies GST-exempt orders as exempt and non-regular', () => {
      const exemptOrder: Order = {
        id: 'ORD-102',
        orderNumber: 'ORD-102',
        customerId: 'CUST-001',
        customerName: 'Alis Virani',
        companyName: 'Apex Industries',
        items: [{
          id: 'item-1',
          productId: 'P-1',
          productName: '500ml Bottle',
          productType: 'bottle',
          priceCategory: 'A',
          quantity: 1000,
          unitPrice: 10,
          subtotal: 10000
        }],
        subtotal: 10000,
        gstAmount: 0,
        gstRate: 0,
        totalAmount: 10000,
        gstApplied: false,
        billType: 'kachha',
        paymentType: 'debit_memo',
        orderType: 'REGULAR',
        orderStatus: 'pending',
        paymentStatus: 'pending',
        paidAmount: 0,
        orderDate: '2026-10-24'
      };

      expect(isGstExemptOrder(exemptOrder)).toBe(true);
      expect(isRegularOrder(exemptOrder)).toBe(false);
      expect(isPakkaBill(exemptOrder)).toBe(false);
      expect(isOrderGstApplied(exemptOrder)).toBe(false);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. Switching between GST-applied and GST-exempt selections
  // ───────────────────────────────────────────────────────────────────────────
  describe('Case 3: Switching between GST-applied and GST-exempt selections', () => {
    it('immediately and reliably transitions subtotal, tax, and grand total', () => {
      const subtotal = 45500.50;

      // Initially GST applied
      const applied1 = calculateSalesTax(subtotal, true, 18);
      expect(applied1.gstApplied).toBe(true);
      expect(applied1.gstAmount).toBe(8190.09);
      expect(applied1.totalAmount).toBe(53690.59);

      // User unchecks "Apply GST" -> switches to GST-exempt
      const exempt = calculateSalesTax(subtotal, false, 18);
      expect(exempt.gstApplied).toBe(false);
      expect(exempt.gstAmount).toBe(0);
      expect(exempt.gstRate).toBe(0);
      expect(exempt.billType).toBe('kachha');
      expect(exempt.totalAmount).toBe(45500.50);

      // User rechecks "Apply GST" -> switches back to GST-applied
      const applied2 = calculateSalesTax(subtotal, true, 18);
      expect(applied2.gstApplied).toBe(true);
      expect(applied2.gstAmount).toBe(8190.09);
      expect(applied2.totalAmount).toBe(53690.59);
    });

    it('guarantees tax values cannot become inconsistent with GST-exempt status', () => {
      const subtotal = 20000;
      const exemptResult = calculateSalesTax(subtotal, false, 18);

      // Validation logic that prevents inconsistent state
      const isConsistent =
        !exemptResult.gstApplied
          ? exemptResult.gstAmount === 0 &&
            exemptResult.gstRate === 0 &&
            exemptResult.totalAmount === subtotal &&
            exemptResult.billType === 'kachha'
          : true;

      expect(isConsistent).toBe(true);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. Invoice generation for both cases
  // ───────────────────────────────────────────────────────────────────────────
  describe('Case 4: Invoice generation for both cases', () => {
    const baseItems = [{
      id: 'item-1',
      productId: 'P-1',
      productName: '100ml PET Bottle',
      productType: 'bottle' as const,
      priceCategory: 'A' as const,
      quantity: 500,
      unitPrice: 20,
      subtotal: 10000
    }];

    it('generates a proper Tax Invoice (Pakka Bill) when GST is applied', () => {
      const gstOrder: Order = {
        id: 'ORD-GST',
        orderNumber: 'ORD-GST',
        customerId: dummyCustomer.id,
        customerName: dummyCustomer.name,
        companyName: dummyCustomer.company,
        items: baseItems,
        subtotal: 10000,
        gstAmount: 1800,
        gstRate: 18,
        totalAmount: 11800,
        gstApplied: true,
        billType: 'pakka',
        paymentType: 'debit_memo',
        orderType: 'REGULAR',
        orderStatus: 'pending',
        paymentStatus: 'pending',
        paidAmount: 0,
        orderDate: '2026-10-24'
      };

      const html = generateInvoiceHtml(gstOrder, dummySettings, dummyCustomer);

      // Pakka bill indicators
      expect(html).toContain('TAX INVOICE');
      expect(html).toContain('CGST (9%):');
      expect(html).toContain('SGST (9%):');
      expect(html).toContain('Taxable Amount (₹)');
      expect(html).toContain('GSTIN: 24AABCA1234F1Z8');
      expect(html).toContain('GSTIN: 24AAAAA0000A1Z5');
      expect(html).toContain('Authorised Signatory');
      expect(html).toContain('₹11,800.00');
      expect(html).not.toContain('KACHHA BILL');
    });

    it('generates a proper Kachha Bill when GST is exempt and does NOT display GST amounts or company GSTIN', () => {
      const exemptOrder: Order = {
        id: 'ORD-EXEMPT',
        orderNumber: 'ORD-EXEMPT',
        customerId: dummyCustomer.id,
        customerName: dummyCustomer.name,
        companyName: dummyCustomer.company,
        items: baseItems,
        subtotal: 10000,
        gstAmount: 0,
        gstRate: 0,
        totalAmount: 10000,
        gstApplied: false,
        billType: 'kachha',
        paymentType: 'debit_memo',
        orderType: 'REGULAR',
        orderStatus: 'pending',
        paymentStatus: 'pending',
        paidAmount: 0,
        orderDate: '2026-10-24'
      };

      const html = generateInvoiceHtml(exemptOrder, dummySettings, dummyCustomer);

      // Kachha bill indicators
      expect(html).toContain('KACHHA BILL');
      expect(html).toContain('Delivery Estimate / Kachha Bill');
      expect(html).toContain('Amount (₹)');
      expect(html).toContain('This is a computer-generated kachha bill.');

      // Must NOT contain tax breakdown lines or customer/company GSTIN
      expect(html).not.toContain('CGST');
      expect(html).not.toContain('SGST');
      expect(html).not.toContain('Taxable Amount (₹)');
      expect(html).not.toContain('GSTIN: 24AABCA1234F1Z8');
      expect(html).not.toContain('GSTIN: 24AAAAA0000A1Z5');
      expect(html).not.toContain('Authorised Signatory');

      // Grand total must equal subtotal without added tax
      expect(html).toContain('₹10,000.00');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 5. Finance and customer-ledger consistency
  // ───────────────────────────────────────────────────────────────────────────
  describe('Case 5: Finance and customer-ledger consistency', () => {
    it('maintains balanced day ledger for both GST-applied and GST-exempt sales', () => {
      const gstOrder: Order = {
        id: 'ORD-501',
        orderNumber: 'ORD-501',
        customerId: 'CUST-001',
        customerName: 'Alis Virani',
        companyName: 'Apex Industries',
        items: [{
          id: 'it-1',
          productId: 'P-1',
          productName: 'Bottle A',
          productType: 'bottle',
          priceCategory: 'A',
          quantity: 100,
          unitPrice: 100,
          subtotal: 10000
        }],
        subtotal: 10000,
        gstAmount: 1800,
        gstRate: 18,
        totalAmount: 11800,
        gstApplied: true,
        billType: 'pakka',
        paymentType: 'debit_memo',
        orderType: 'REGULAR',
        orderStatus: 'confirmed',
        paymentStatus: 'paid',
        paidAmount: 11800,
        orderDate: '2026-10-24'
      };

      const exemptOrder: Order = {
        id: 'ORD-502',
        orderNumber: 'ORD-502',
        customerId: 'CUST-001',
        customerName: 'Alis Virani',
        companyName: 'Apex Industries',
        items: [{
          id: 'it-2',
          productId: 'P-2',
          productName: 'Cap B',
          productType: 'cap',
          priceCategory: 'A',
          quantity: 500,
          unitPrice: 20,
          subtotal: 10000
        }],
        subtotal: 10000,
        gstAmount: 0,
        gstRate: 0,
        totalAmount: 10000,
        gstApplied: false,
        billType: 'kachha',
        paymentType: 'debit_memo',
        orderType: 'REGULAR',
        orderStatus: 'confirmed',
        paymentStatus: 'paid',
        paidAmount: 10000,
        orderDate: '2026-10-24'
      };

      const payments: Payment[] = [
        {
          id: 'REC-1',
          receiptNumber: 'REC-1',
          orderId: 'ORD-501',
          orderNumber: 'ORD-501',
          customerId: 'CUST-001',
          customerName: 'Apex Industries',
          amount: 11800,
          paymentMethod: 'bank_transfer',
          paymentDate: '2026-10-24'
        },
        {
          id: 'REC-2',
          receiptNumber: 'REC-2',
          orderId: 'ORD-502',
          orderNumber: 'ORD-502',
          customerId: 'CUST-001',
          customerName: 'Apex Industries',
          amount: 10000,
          paymentMethod: 'cash',
          paymentDate: '2026-10-24'
        }
      ];

      const { summary } = buildDayLedger({
        orders: [gstOrder, exemptOrder],
        payments,
        purchases: [],
        expenses: []
      });

      // Total sales = 11,800 (GST order) + 10,000 (Exempt order) = 21,800
      expect(summary.totalSales).toBe(21800);
      // Collections received = 11,800 + 10,000 = 21,800
      expect(summary.customerPaymentsReceived).toBe(21800);
      // Outstanding customer receivables must balance to 0
      expect(summary.customerReceivables).toBe(0);
      expect(summary.closingBalance).toBe(0);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 6. Existing orders with missing or legacy tax fields
  // ───────────────────────────────────────────────────────────────────────────
  describe('Case 6: Existing orders with missing or legacy tax fields', () => {
    it('does NOT classify legacy orders without tax fields as GST-exempt', () => {
      // Legacy order where gstApplied and billType were never set
      const legacyOrder: Order = {
        id: 'ORD-LEGACY-1',
        orderNumber: 'ORD-LEGACY-1',
        customerId: 'CUST-001',
        customerName: 'Alis Virani',
        companyName: 'Apex Industries',
        items: [],
        subtotal: 5000,
        gstAmount: 900,
        gstRate: 18,
        totalAmount: 5900,
        orderType: 'REGULAR',
        orderStatus: 'confirmed',
        paymentStatus: 'pending',
        paidAmount: 0,
        orderDate: '2025-05-10'
      };

      // Critical requirement: Never assume missing fields mean GST-exempt!
      expect(isGstExemptOrder(legacyOrder)).toBe(false);
      expect(isRegularOrder(legacyOrder)).toBe(true);
      expect(isPakkaBill(legacyOrder)).toBe(true);
      expect(isOrderGstApplied(legacyOrder)).toBe(true);
    });

    it('treats legacy orders with 0 tax as regular (not exempt) but prints as kachha bill', () => {
      const legacyZeroTaxOrder: Order = {
        id: 'ORD-LEGACY-2',
        orderNumber: 'ORD-LEGACY-2',
        customerId: 'CUST-001',
        customerName: 'Alis Virani',
        companyName: 'Apex Industries',
        items: [],
        subtotal: 5000,
        gstAmount: 0,
        gstRate: 0,
        totalAmount: 5000,
        orderType: 'REGULAR',
        orderStatus: 'confirmed',
        paymentStatus: 'pending',
        paidAmount: 0,
        orderDate: '2025-05-10'
      };

      // Unclassified legacy order is NOT considered exempt, staying on regular list
      expect(isGstExemptOrder(legacyZeroTaxOrder)).toBe(false);
      expect(isRegularOrder(legacyZeroTaxOrder)).toBe(true);
      // But because no tax was recorded, invoice print treats it as kachha bill
      expect(isPakkaBill(legacyZeroTaxOrder)).toBe(false);
      expect(isOrderGstApplied(legacyZeroTaxOrder)).toBe(false);
    });

    it('correctly honors legacy billType when gstApplied boolean is missing', () => {
      const legacyKachha: Order = {
        id: 'ORD-LEGACY-3',
        orderNumber: 'ORD-LEGACY-3',
        customerId: 'CUST-001',
        customerName: 'Alis Virani',
        companyName: 'Apex Industries',
        items: [],
        subtotal: 5000,
        gstAmount: 0,
        gstRate: 0,
        totalAmount: 5000,
        billType: 'kachha',
        orderType: 'REGULAR',
        orderStatus: 'confirmed',
        paymentStatus: 'pending',
        paidAmount: 0,
        orderDate: '2025-05-10'
      };

      expect(isGstExemptOrder(legacyKachha)).toBe(true);
      expect(isRegularOrder(legacyKachha)).toBe(false);
      expect(isPakkaBill(legacyKachha)).toBe(false);

      const legacyPakka: Order = {
        id: 'ORD-LEGACY-4',
        orderNumber: 'ORD-LEGACY-4',
        customerId: 'CUST-001',
        customerName: 'Alis Virani',
        companyName: 'Apex Industries',
        items: [],
        subtotal: 5000,
        gstAmount: 900,
        gstRate: 18,
        totalAmount: 5900,
        billType: 'pakka',
        orderType: 'REGULAR',
        orderStatus: 'confirmed',
        paymentStatus: 'pending',
        paidAmount: 0,
        orderDate: '2025-05-10'
      };

      expect(isGstExemptOrder(legacyPakka)).toBe(false);
      expect(isRegularOrder(legacyPakka)).toBe(true);
      expect(isPakkaBill(legacyPakka)).toBe(true);
    });
  });
});
