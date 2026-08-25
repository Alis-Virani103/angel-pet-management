import { Order } from '../types';

/**
 * Returns the total unit quantity for a Sales Order.
 * Sales orders contain line items for bottle and cap specs matching the order quantity.
 * Using order.totalQuantity or inspecting line items prevents doubling the quantity during display/aggregation.
 */
export function getOrderQuantity(order: Order): number {
  if (typeof order.totalQuantity === 'number' && order.totalQuantity > 0) {
    return order.totalQuantity;
  }
  if (!order.items || order.items.length === 0) {
    return 0;
  }
  const bottleItem = order.items.find((i) => i.productType === 'bottle');
  if (bottleItem) {
    return bottleItem.quantity;
  }
  const capItem = order.items.find((i) => i.productType === 'cap');
  if (capItem) {
    return capItem.quantity;
  }
  return Math.max(...order.items.map((i) => i.quantity || 0), 0);
}
