import { PriceCategory, Product } from '../types';

/**
 * Returns true if the given price is a valid positive number.
 */
export function isValidProductPrice(price: unknown): price is number {
  if (typeof price === 'number') {
    return Number.isFinite(price) && price > 0;
  }
  if (typeof price === 'string' && price.trim() !== '') {
    const parsed = Number(price);
    return Number.isFinite(parsed) && parsed > 0;
  }
  return false;
}

/**
 * Retrieves the tier price from a product for the specified price category (A, B, or C).
 * Returns null if product is not defined or the price is invalid/missing.
 */
export function getProductPriceForCategory(
  product: Pick<Product, 'priceA' | 'priceB' | 'priceC'> | null | undefined,
  category: PriceCategory
): number | null {
  if (!product) return null;

  let rawPrice: unknown;
  if (category === 'A') {
    rawPrice = product.priceA;
  } else if (category === 'B') {
    rawPrice = product.priceB;
  } else if (category === 'C') {
    rawPrice = product.priceC;
  }

  if (isValidProductPrice(rawPrice)) {
    return typeof rawPrice === 'number' ? rawPrice : Number(rawPrice);
  }

  return null;
}

/**
 * Retrieves the configured Bottle + Inner + Cap combo price for the specified price category (A, B, or C).
 * Returns null if not configured or invalid.
 */
export function getBottleComboPrice(
  product: Pick<Product, 'comboPriceA' | 'comboPriceB' | 'comboPriceC'> | null | undefined,
  category: PriceCategory
): number | null {
  if (!product) return null;

  let rawPrice: unknown;
  if (category === 'A') {
    rawPrice = product.comboPriceA;
  } else if (category === 'B') {
    rawPrice = product.comboPriceB;
  } else if (category === 'C') {
    rawPrice = product.comboPriceC;
  }

  if (isValidProductPrice(rawPrice)) {
    return typeof rawPrice === 'number' ? rawPrice : Number(rawPrice);
  }

  return null;
}

/**
 * Calculates the effective unit rate for a bottle item based on optional inner and cap selections:
 * - CASE 1 (Bottle only): uses normal Bottle A/B/C price.
 * - CASE 2 (Bottle + Inner + Cap): uses configured Combo Price (A/B/C) if set; otherwise falls back to Bottle + Inner + Cap sum.
 * - CASE 3 (Partial combinations): Bottle + Inner or Bottle + Cap using configured category prices.
 */
export function calculateEffectiveItemRate(params: {
  product: Product;
  category: PriceCategory;
  innerProduct?: Product | null;
  capProduct?: Product | null;
}): number | null {
  const { product, category, innerProduct, capProduct } = params;
  if (!product) return null;

  const basePrice = getProductPriceForCategory(product, category);

  // If not a bottle, return standard tier price
  if (product.type !== 'bottle') {
    return basePrice;
  }

  const hasInner = Boolean(innerProduct && innerProduct.id);
  const hasCap = Boolean(capProduct && capProduct.id);

  // CASE 2: Bottle + Inner + Cap
  if (hasInner && hasCap) {
    const configuredComboPrice = getBottleComboPrice(product, category);
    if (isValidProductPrice(configuredComboPrice)) {
      return configuredComboPrice;
    }
    // Fallback if no combo price configured
    const innerPrice = getProductPriceForCategory(innerProduct, category) || 0;
    const capPrice = getProductPriceForCategory(capProduct, category) || 0;
    const total = (basePrice || 0) + innerPrice + capPrice;
    return total > 0 ? total : null;
  }

  // CASE 3A: Bottle + Inner only
  if (hasInner && !hasCap) {
    const innerPrice = getProductPriceForCategory(innerProduct, category) || 0;
    const total = (basePrice || 0) + innerPrice;
    return total > 0 ? total : null;
  }

  // CASE 3B: Bottle + Cap only
  if (!hasInner && hasCap) {
    const capPrice = getProductPriceForCategory(capProduct, category) || 0;
    const total = (basePrice || 0) + capPrice;
    return total > 0 ? total : null;
  }

  // CASE 1: Bottle only
  return basePrice;
}

/**
 * Returns formatted price string with ₹ symbol and 2 decimal places.
 */
export function formatPrice(price: number | null | undefined, placeholder = '-'): string {
  if (price === null || price === undefined || !Number.isFinite(price)) {
    return placeholder;
  }
  return `₹${price.toFixed(2)}`;
}

/**
 * Returns a human-readable label for a price category.
 */
export function getPriceCategoryLabel(category: PriceCategory): string {
  switch (category) {
    case 'A':
      return 'Category A (Standard)';
    case 'B':
      return 'Category B (Wholesale)';
    case 'C':
      return 'Category C (Special)';
    default:
      return `Category ${category}`;
  }
}

/**
 * Returns previous order rates for a product (up to limit, e.g. 3 orders),
 * prioritizing the given customer's order history, and falling back to general orders.
 */
export function getPreviousRatesForProduct(
  orders: Array<{ orderDate: string; customerId?: string; items: Array<{ productId: string; unitPrice: number }> }>,
  productId: string,
  customerId?: string,
  limit = 3
): number[] {
  if (!productId || !orders || orders.length === 0) return [];

  const sorted = [...orders].sort(
    (a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime()
  );

  const rates: number[] = [];

  // 1. Look for previous orders for this specific customer
  if (customerId) {
    for (const order of sorted) {
      if (order.customerId === customerId) {
        const item = order.items.find((it) => it.productId === productId);
        if (item && typeof item.unitPrice === 'number' && item.unitPrice > 0) {
          rates.push(item.unitPrice);
          if (rates.length >= limit) return rates;
        }
      }
    }
  }

  // 2. Fall back to previous orders from other customers if fewer than limit found
  if (rates.length < limit) {
    for (const order of sorted) {
      if (!customerId || order.customerId !== customerId) {
        const item = order.items.find((it) => it.productId === productId);
        if (item && typeof item.unitPrice === 'number' && item.unitPrice > 0) {
          rates.push(item.unitPrice);
          if (rates.length >= limit) return rates;
        }
      }
    }
  }

  return rates;
}

/**
 * Formats a list of previous rates according to the ERP specification:
 * - If rates exist: "Previous Rates: ₹10.00 • ₹9.80 • ₹10.20"
 * - If no rates: "No previous rate"
 */
export function formatPreviousRates(rates: number[]): string {
  if (!rates || rates.length === 0) {
    return 'No previous rate';
  }
  return `Previous Rates: ${rates.map((r) => `₹${r.toFixed(2)}`).join(' • ')}`;
}

