import { describe, it, expect } from 'vitest';
import { isGstExemptOrder, isRegularOrder, isWithin24HourVisibilityWindow } from '../../src/utils/gstUtils';
import type { Order } from '../../src/types';

describe('GST Exempt Order Classification', () => {
  it('classifies orders with gstApplied=false as exempt', () => {
    const order = { gstApplied: false } as Partial<Order>;
    expect(isGstExemptOrder(order)).toBe(true);
    expect(isRegularOrder(order as Order)).toBe(false);
  });

  it('classifies orders with billType=kachha as exempt', () => {
    const order = { billType: 'kachha' } as Partial<Order>;
    expect(isGstExemptOrder(order)).toBe(true);
    expect(isRegularOrder(order as Order)).toBe(false);
  });

  it('classifies orders with gstApplied=true as regular', () => {
    const order = { gstApplied: true } as Partial<Order>;
    expect(isGstExemptOrder(order)).toBe(false);
    expect(isRegularOrder(order as Order)).toBe(true);
  });

  it('classifies orders with billType=pakka as regular', () => {
    const order = { billType: 'pakka' } as Partial<Order>;
    expect(isGstExemptOrder(order)).toBe(false);
    expect(isRegularOrder(order as Order)).toBe(true);
  });

  it('treats legacy orders without flags as regular (not exempt)', () => {
    const order = {} as Partial<Order>;
    expect(isGstExemptOrder(order)).toBe(false);
    expect(isRegularOrder(order as Order)).toBe(true);
  });

  it('prioritizes gstApplied over billType when both are set', () => {
    const order1 = { gstApplied: false, billType: 'pakka' } as Partial<Order>;
    expect(isGstExemptOrder(order1)).toBe(true);

    const order2 = { gstApplied: true, billType: 'kachha' } as Partial<Order>;
    expect(isGstExemptOrder(order2)).toBe(false);
  });
});

describe('24-Hour Visibility Window', () => {
  it('returns true for orders created less than 24 hours ago', () => {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const order = { createdAt: oneHourAgo.toISOString() } as Order;
    expect(isWithin24HourVisibilityWindow(order)).toBe(true);
  });

  it('returns true for orders created exactly 23 hours ago', () => {
    const now = new Date();
    const twentyThreeHoursAgo = new Date(now.getTime() - 23 * 60 * 60 * 1000);
    const order = { createdAt: twentyThreeHoursAgo.toISOString() } as Order;
    expect(isWithin24HourVisibilityWindow(order)).toBe(true);
  });

  it('returns false for orders created more than 24 hours ago', () => {
    const now = new Date();
    const twentyFiveHoursAgo = new Date(now.getTime() - 25 * 60 * 60 * 1000);
    const order = { createdAt: twentyFiveHoursAgo.toISOString() } as Order;
    expect(isWithin24HourVisibilityWindow(order)).toBe(false);
  });

  it('returns false for orders created exactly 24 hours ago', () => {
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const order = { createdAt: twentyFourHoursAgo.toISOString() } as Order;
    expect(isWithin24HourVisibilityWindow(order)).toBe(false);
  });

  it('returns false for orders without createdAt field', () => {
    const order = {} as Order;
    expect(isWithin24HourVisibilityWindow(order)).toBe(false);
  });

  it('returns true for orders created just now', () => {
    const now = new Date();
    const order = { createdAt: now.toISOString() } as Order;
    expect(isWithin24HourVisibilityWindow(order)).toBe(true);
  });

  it('returns false for orders created 30 days ago', () => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const order = { createdAt: thirtyDaysAgo.toISOString() } as Order;
    expect(isWithin24HourVisibilityWindow(order)).toBe(false);
  });
});

describe('Integration: GST Exempt + 24-Hour Visibility', () => {
  it('shows recent GST-exempt orders in normal list', () => {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const order = {
      gstApplied: false,
      createdAt: oneHourAgo.toISOString()
    } as Order;

    const isExempt = isGstExemptOrder(order);
    const isVisible = isWithin24HourVisibilityWindow(order);

    expect(isExempt).toBe(true);
    expect(isVisible).toBe(true);
    // Should be visible in normal Sales & Orders list
  });

  it('hides old GST-exempt orders from normal list', () => {
    const now = new Date();
    const twentyFiveHoursAgo = new Date(now.getTime() - 25 * 60 * 60 * 1000);
    const order = {
      gstApplied: false,
      createdAt: twentyFiveHoursAgo.toISOString()
    } as Order;

    const isExempt = isGstExemptOrder(order);
    const isVisible = isWithin24HourVisibilityWindow(order);

    expect(isExempt).toBe(true);
    expect(isVisible).toBe(false);
    // Should be hidden from normal Sales & Orders list, visible in Admin History
  });

  it('always shows GST-applied orders regardless of age', () => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const order = {
      gstApplied: true,
      createdAt: thirtyDaysAgo.toISOString()
    } as Order;

    const isExempt = isGstExemptOrder(order);
    const isRegular = isRegularOrder(order);

    expect(isExempt).toBe(false);
    expect(isRegular).toBe(true);
    // Should always be visible in normal Sales & Orders list
  });

  it('treats legacy orders without createdAt as old (hidden if exempt)', () => {
    const order = {
      gstApplied: false
    } as Order;

    const isExempt = isGstExemptOrder(order);
    const isVisible = isWithin24HourVisibilityWindow(order);

    expect(isExempt).toBe(true);
    expect(isVisible).toBe(false);
    // Legacy exempt orders should be hidden from normal list
  });
});
