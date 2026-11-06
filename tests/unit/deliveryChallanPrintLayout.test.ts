import { describe, expect, it } from 'vitest';
import { generateInvoiceHtml } from '../../src/utils/invoicePrintUtils';
import { Order } from '../../src/types';

const challanOrder: Order = {
  id: 'ORD-CHALLAN-PRINT',
  orderNumber: 'ORD-CHALLAN-PRINT',
  orderType: 'REGULAR',
  customerId: 'CUST-1',
  customerName: 'Test Customer',
  companyName: 'Test Customer Pvt Ltd',
  paymentType: 'delivery_challan',
  orderStatus: 'confirmed',
  paymentStatus: 'pending',
  orderDate: '2026-11-06',
  subtotal: 30000,
  gstAmount: 0,
  gstRate: 0,
  gstApplied: false,
  billType: 'kachha',
  totalAmount: 30000,
  paidAmount: 0,
  totalQuantity: 300,
  items: [
    {
      productId: 'PROD-1',
      productName: 'Test Jar 500ml',
      productType: 'jar',
      priceCategory: 'A',
      unitPrice: 100,
      quantity: 300,
      subtotal: 30000,
      soldByPacket: true,
      packetCount: 3,
      unitsPerPacket: 100,
      loosePieces: 0
    }
  ]
};

describe('Delivery Challan print layout', () => {
  it('keeps delivery details while removing pricing and category information', () => {
    const html = generateInvoiceHtml(challanOrder);

    expect(html).toContain('DELIVERY CHALLAN');
    expect(html).toContain('Test Jar 500ml');
    expect(html).toContain('300 pcs');
    expect(html).toContain('3 Packets');

    expect(html).not.toContain('Unit Rate');
    expect(html).not.toContain('Amount (₹)');
    expect(html).not.toContain('Taxable Amount');
    expect(html).not.toContain('Category A Pricing');
    expect(html).not.toContain('Grand Total');
    expect(html).not.toContain('Amount in Words');
    expect(html).not.toContain('₹');
  });
});
