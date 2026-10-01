import { Product, OrderItem } from '../types';

export type WeightUnit = 'g' | 'kg';

/**
 * Normalizes weight to grams.
 * Returns null if weight is invalid or not configured.
 */
export function getWeightInGrams(
  weightPerPiece?: number | null,
  unit: WeightUnit = 'g'
): number | null {
  if (typeof weightPerPiece !== 'number' || !Number.isFinite(weightPerPiece) || weightPerPiece <= 0) {
    return null;
  }
  return unit === 'kg' ? weightPerPiece * 1000 : weightPerPiece;
}

/**
 * Formats a weight in grams into a clean, human-readable string (g or kg)
 * without unnecessary trailing zeros (e.g. "20 kg", "1.25 kg", "500 g").
 */
export function formatWeight(grams: number | null | undefined): string {
  if (typeof grams !== 'number' || !Number.isFinite(grams) || grams <= 0) {
    return '';
  }

  if (grams >= 1000) {
    const kg = grams / 1000;
    const formatted = kg % 1 === 0 ? kg.toFixed(0) : parseFloat(kg.toFixed(3)).toString();
    return `${formatted} kg`;
  }

  const formatted = grams % 1 === 0 ? grams.toFixed(0) : parseFloat(grams.toFixed(2)).toString();
  return `${formatted} g`;
}

/**
 * Formats the per-piece weight for display in product cards and order rows (e.g. "10 g / piece").
 */
export function formatPieceWeight(
  weightPerPiece?: number | null,
  unit: WeightUnit = 'g'
): string {
  if (typeof weightPerPiece !== 'number' || !Number.isFinite(weightPerPiece) || weightPerPiece <= 0) {
    return '';
  }
  const cleanVal = weightPerPiece % 1 === 0 ? weightPerPiece.toString() : parseFloat(weightPerPiece.toFixed(3)).toString();
  return `${cleanVal} ${unit} / piece`;
}

/**
 * Calculates the total weight in grams for a single order item,
 * including optional combo components (Bottle + Inner + Cap).
 * Returns null if no product in the combination has a configured weight.
 */
export function calculateItemWeightGrams(params: {
  product?: Product | null;
  quantity: number;
  innerProduct?: Product | null;
  capProduct?: Product | null;
}): number | null {
  const { product, quantity, innerProduct, capProduct } = params;
  if (!product || quantity <= 0) return null;

  let totalGrams = 0;
  let hasAnyWeight = false;

  const mainGrams = getWeightInGrams(product.weightPerPiece, product.weightUnit);
  if (mainGrams !== null) {
    totalGrams += mainGrams * quantity;
    hasAnyWeight = true;
  }

  if (innerProduct) {
    const innerGrams = getWeightInGrams(innerProduct.weightPerPiece, innerProduct.weightUnit);
    if (innerGrams !== null) {
      totalGrams += innerGrams * quantity;
      hasAnyWeight = true;
    }
  }

  if (capProduct) {
    const capGrams = getWeightInGrams(capProduct.weightPerPiece, capProduct.weightUnit);
    if (capGrams !== null) {
      totalGrams += capGrams * quantity;
      hasAnyWeight = true;
    }
  }

  return hasAnyWeight ? totalGrams : null;
}

/**
 * Calculates total weight in grams across all items in an order.
 * Returns null if no items have configured weights.
 */
export function calculateOrderTotalWeightGrams(
  items: OrderItem[],
  products: Product[]
): number | null {
  if (!items || items.length === 0) return null;

  let totalGrams = 0;
  let hasAnyWeight = false;

  for (const item of items) {
    // If item has pre-calculated totalWeightGrams, use it
    if (typeof item.totalWeightGrams === 'number' && item.totalWeightGrams > 0) {
      totalGrams += item.totalWeightGrams;
      hasAnyWeight = true;
      continue;
    }

    const product = products.find((p) => p.id === item.productId);
    if (!product) continue;

    const innerProduct = item.selectedInnerId ? products.find((p) => p.id === item.selectedInnerId) : null;
    const capProduct = item.selectedCapId ? products.find((p) => p.id === item.selectedCapId) : null;

    const itemGrams = calculateItemWeightGrams({
      product,
      quantity: item.quantity,
      innerProduct,
      capProduct
    });

    if (itemGrams !== null) {
      totalGrams += itemGrams;
      hasAnyWeight = true;
    }
  }

  return hasAnyWeight ? totalGrams : null;
}
