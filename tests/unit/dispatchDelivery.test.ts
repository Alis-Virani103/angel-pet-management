import { describe, expect, it } from 'vitest';
import { Dispatch, Order } from '../../src/types';
import { calculateDispatchPieces, generateNextChallanNumber, getOrderDeliveryProgress } from '../../src/utils/dispatchUtils';

const makeOrder = (): Order => ({
  id: 'ORD-1',
  orderNumber: 'ORD-10001',
  customerId: 'CUST-1',
  customerName: 'Customer One',
  companyName: 'Customer One Pvt Ltd',
  orderType: 'REGULAR',
  paymentType: 'delivery_challan',
  orderStatus: 'pending',
  paymentStatus: 'pending',
  paidAmount: 0,
  orderDate: '2026-11-01',
  subtotal: 0,
  gstAmount: 0,
  gstRate: 0,
  gstApplied: false,
  billType: 'kachha',
  totalAmount: 0,
  totalQuantity: 1000,
  items: [
    {
      productId: 'PROD-1',
      productName: 'Packet Product',
      productType: 'bottle',
      priceCategory: 'A',
      unitPrice: 0,
      quantity: 1000,
      subtotal: 0
    }
  ]
});

const makeDispatch = (id: string, quantity: number, item: Partial<Dispatch['items'][number]> = {}): Dispatch => ({
  id,
  dispatchNumber: id,
  orderId: 'ORD-1',
  orderNumber: 'ORD-10001',
  customerName: 'Customer One Pvt Ltd',
  dispatchDate: '2026-11-05',
  status: 'dispatched',
  createdAt: '2026-11-05',
  items: [
    {
      productId: 'PROD-1',
      productName: 'Packet Product',
      quantity,
      ...item
    }
  ]
});

describe('sales order delivery progress', () => {
  it('tracks multiple partial deliveries until the order is fully delivered', () => {
    const order = makeOrder();
    const first = makeDispatch('CH-001', 100);
    const second = makeDispatch('CH-002', 300);
    const third = makeDispatch('CH-003', 600);

    const afterFirst = getOrderDeliveryProgress(order, [first]);
    const afterSecond = getOrderDeliveryProgress(order, [first, second]);
    const final = getOrderDeliveryProgress(order, [first, second, third]);

    expect(afterFirst.totalDeliveredQuantity).toBe(100);
    expect(afterFirst.totalRemainingQuantity).toBe(900);
    expect(afterSecond.totalDeliveredQuantity).toBe(400);
    expect(afterSecond.totalRemainingQuantity).toBe(600);
    expect(final.totalDeliveredQuantity).toBe(1000);
    expect(final.totalRemainingQuantity).toBe(0);
    expect(final.isFullyDelivered).toBe(true);
    expect(final.subDeliveries).toHaveLength(3);
    expect(final.subDeliveries.every((dispatch) => dispatch.orderId === order.id)).toBe(true);
  });

  it('calculates packet deliveries as equivalent pieces and keeps piece-only deliveries unchanged', () => {
    expect(calculateDispatchPieces(5, 'packets', 100, 0)).toBe(500);
    expect(calculateDispatchPieces(5, 'packets', 100, 25)).toBe(525);
    expect(calculateDispatchPieces(50, 'pieces')).toBe(50);

    const order = makeOrder();
    const packetDelivery = makeDispatch('CH-010', 525, {
      deliveryUnit: 'packets',
      packetQuantity: 5,
      loosePieces: 25,
      unitsPerPacket: 100
    });
    const progress = getOrderDeliveryProgress(order, [packetDelivery]);
    expect(progress.totalDeliveredQuantity).toBe(525);
    expect(progress.totalRemainingQuantity).toBe(475);
  });

  it('generates sequential challan numbers without reusing existing IDs', () => {
    expect(generateNextChallanNumber([makeDispatch('CH-001', 10), makeDispatch('CH-003', 10)])).toBe('CH-004');
    expect(generateNextChallanNumber([])).toBe('CH-001');
  });
});
