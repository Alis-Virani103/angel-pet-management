import { Order, Dispatch } from '../types';

export interface ProductDeliveryProgress {
  productId: string;
  productName: string;
  orderedQuantity: number;
  deliveredQuantity: number;
  remainingQuantity: number;
  isFullyDelivered: boolean;
}

export interface OrderDeliveryProgress {
  orderId: string;
  orderNumber: string;
  customerName: string;
  companyName: string;
  orderStatus: Order['orderStatus'];
  items: ProductDeliveryProgress[];
  totalOrderedQuantity: number;
  totalDeliveredQuantity: number;
  totalRemainingQuantity: number;
  isFullyDelivered: boolean;
  isPartiallyDelivered: boolean;
  subDeliveries: Dispatch[];
}

/**
 * Calculates delivery progress and remaining quantities per product for an order
 */
export function getOrderDeliveryProgress(order: Order, dispatches: Dispatch[]): OrderDeliveryProgress {
  const orderDispatches = dispatches.filter(
    (d) => (d.orderId && d.orderId === order.id) || (d.orderNumber && d.orderNumber === order.orderNumber)
  );

  const items: ProductDeliveryProgress[] = (order.items || []).map((orderItem) => {
    const deliveredQuantity = orderDispatches.reduce((sum, d) => {
      const match = d.items?.find(
        (di) => di.productId === orderItem.productId || di.productName === orderItem.productName
      );
      return sum + (match ? match.quantity : 0);
    }, 0);

    const orderedQuantity = orderItem.quantity || 0;
    const remainingQuantity = Math.max(0, orderedQuantity - deliveredQuantity);

    return {
      productId: orderItem.productId,
      productName: orderItem.productName,
      orderedQuantity,
      deliveredQuantity,
      remainingQuantity,
      isFullyDelivered: remainingQuantity === 0
    };
  });

  const totalOrderedQuantity = items.reduce((sum, i) => sum + i.orderedQuantity, 0);
  const totalDeliveredQuantity = items.reduce((sum, i) => sum + i.deliveredQuantity, 0);
  const totalRemainingQuantity = items.reduce((sum, i) => sum + i.remainingQuantity, 0);
  const isFullyDelivered = items.length > 0 && items.every((i) => i.isFullyDelivered);
  const isPartiallyDelivered = totalDeliveredQuantity > 0 && totalRemainingQuantity > 0;

  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    companyName: order.companyName,
    orderStatus: order.orderStatus,
    items,
    totalOrderedQuantity,
    totalDeliveredQuantity,
    totalRemainingQuantity,
    isFullyDelivered,
    isPartiallyDelivered,
    subDeliveries: orderDispatches
  };
}

/**
 * Generates the next sequential Sub-Challan number (e.g. CH-001, CH-002)
 */
export function generateNextChallanNumber(existingDispatches: Dispatch[]): string {
  const numbers: number[] = [];
  for (const d of existingDispatches) {
    const match = d.dispatchNumber?.match(/^CH-(\d+)$/i);
    if (match) {
      numbers.push(parseInt(match[1], 10));
    }
  }
  if (numbers.length > 0) {
    const max = Math.max(...numbers);
    return `CH-${String(max + 1).padStart(3, '0')}`;
  }
  const count = existingDispatches.length + 1;
  return `CH-${String(count).padStart(3, '0')}`;
}
