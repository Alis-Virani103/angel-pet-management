/**
 * GST classification helpers.
 *
 * An order is "explicitly GST-exempt" only when the sales form explicitly
 * recorded no-GST at creation time via `gstApplied === false` or
 * `billType === 'kachha'`.
 *
 * Legacy orders that have neither field set are treated as UNCLASSIFIED,
 * NOT as GST-exempt, to avoid silently hiding real sales from the main list.
 */

import type { Order } from '../types';

/**
 * Returns true if an order is within the 24-hour visibility window for GST-exempt orders.
 * Orders without a createdAt field are treated as if they are outside the window (hidden).
 */
export function isWithin24HourVisibilityWindow(order: Pick<Order, 'createdAt'>): boolean {
  if (!order.createdAt) return false;
  const creationTime = new Date(order.createdAt).getTime();
  const now = Date.now();
  const twentyFourHoursInMs = 24 * 60 * 60 * 1000;
  return now - creationTime < twentyFourHoursInMs;
}

/**
 * Returns true only for orders that were explicitly recorded as GST-exempt
 * (i.e. `gstApplied === false` or `billType === 'kachha'`).
 * Never classifies legacy / unclassified records as exempt.
 */
export function isGstExemptOrder(order: Pick<Order, 'gstApplied' | 'billType'> | Partial<Order>): boolean {
  if (typeof order.gstApplied === 'boolean') return !order.gstApplied;
  if (order.billType === 'kachha') return true;
  return false;
}

/**
 * Returns true for orders that belong on the normal Sales & Orders list.
 * Includes GST orders, unknown/legacy orders, and AS orders.
 */
export function isRegularOrder(order: Order): boolean {
  return !isGstExemptOrder(order);
}

/**
 * Returns true if an order represents a Pakka Bill (Tax Invoice with GST applied),
 * or false if it represents a non-GST Kachha Bill / GST-exempt sale.
 * For legacy records without explicit `gstApplied` or `billType`,
 * checks whether positive GST rate and amount were charged.
 */
export function isOrderGstApplied(order: {
  gstApplied?: boolean;
  billType?: 'kachha' | 'pakka';
  gstRate?: number;
  gstAmount?: number;
}): boolean {
  if (typeof order.gstApplied === 'boolean') {
    return order.gstApplied;
  }
  if (order.billType === 'pakka') return true;
  if (order.billType === 'kachha') return false;
  return (order.gstRate ?? 0) > 0 && (order.gstAmount ?? 0) > 0;
}

export interface TaxCalculationResult {
  gstAmount: number;
  gstRate: number;
  totalAmount: number;
  gstApplied: boolean;
  billType: 'kachha' | 'pakka';
}

/**
 * Centralized, authoritative sales tax calculation.
 * Ensures consistent tax and grand total calculation for both GST-applied and GST-exempt sales.
 */
export function calculateSalesTax(
  subtotal: number,
  gstApplied: boolean,
  rate: number = 18
): TaxCalculationResult {
  const safeSubtotal = Number.isFinite(subtotal) && subtotal > 0 ? Number(subtotal.toFixed(2)) : 0;

  if (!gstApplied) {
    return {
      gstAmount: 0,
      gstRate: 0,
      totalAmount: safeSubtotal,
      gstApplied: false,
      billType: 'kachha'
    };
  }

  const effectiveRate = Number.isFinite(rate) && rate > 0 ? rate : 18;
  const gstAmount = Number((safeSubtotal * (effectiveRate / 100)).toFixed(2));
  const totalAmount = Number((safeSubtotal + gstAmount).toFixed(2));

  return {
    gstAmount,
    gstRate: effectiveRate,
    totalAmount,
    gstApplied: true,
    billType: 'pakka'
  };
}
