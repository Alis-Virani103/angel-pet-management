import { PackagingMode, Product } from '../types';

/**
 * Returns human-readable label for packaging combination mode.
 */
export function formatPackagingMode(mode?: PackagingMode): string {
  switch (mode) {
    case 'bottle_cap':
      return 'Bottle + Cap';
    case 'bottle_inner_cap':
      return 'Bottle + Inner + Cap';
    case 'bottle_only':
    default:
      return 'Bottle Only';
  }
}

/**
 * Extract neck diameter or size specification string (e.g., '28mm', '38mm', '45mm') from product info.
 */
function extractNeckSize(text?: string): string | null {
  if (!text) return null;
  const match = text.match(/\b(\d+)\s*mm\b/i);
  return match ? `${match[1]}mm`.toLowerCase() : null;
}

/**
 * Find the most compatible Cap product for a given Bottle product.
 */
export function getCompatibleCapForBottle(
  bottle: Product,
  products: Product[]
): Product | null {
  const capProducts = products.filter((p) => p.type === 'cap');
  if (capProducts.length === 0) return null;

  // 1. Direct match by compatibleCapId if configured
  if (bottle.compatibleCapId) {
    const directMatch = capProducts.find((p) => p.id === bottle.compatibleCapId);
    if (directMatch) return directMatch;
  }

  // 2. Match by neck size in sizeOrType, name, sku, or description
  const bottleNeck =
    extractNeckSize(bottle.sizeOrType) ||
    extractNeckSize(bottle.name) ||
    extractNeckSize(bottle.description) ||
    extractNeckSize(bottle.sku);

  if (bottleNeck) {
    const neckMatch = capProducts.find((cap) => {
      const capNeck =
        extractNeckSize(cap.sizeOrType) ||
        extractNeckSize(cap.name) ||
        extractNeckSize(cap.description) ||
        extractNeckSize(cap.sku);
      return capNeck === bottleNeck;
    });
    if (neckMatch) return neckMatch;
  }

  // 3. Fallback: match standard active 28mm cap or first active cap
  const defaultStandardCap =
    capProducts.find((p) => p.status === 'active' && p.name.toLowerCase().includes('standard')) ||
    capProducts.find((p) => p.status === 'active') ||
    capProducts[0];

  return defaultStandardCap || null;
}

/**
 * Find the most compatible Inner product for a given Bottle product.
 */
export function getCompatibleInnerForBottle(
  bottle: Product,
  products: Product[]
): Product | null {
  const innerProducts = products.filter((p) => p.type === 'inner');
  if (innerProducts.length === 0) return null;

  // 1. Direct match by compatibleInnerId if configured
  if (bottle.compatibleInnerId) {
    const directMatch = innerProducts.find((p) => p.id === bottle.compatibleInnerId);
    if (directMatch) return directMatch;
  }

  // 2. Match by neck size in sizeOrType, name, sku, or description
  const bottleNeck =
    extractNeckSize(bottle.sizeOrType) ||
    extractNeckSize(bottle.name) ||
    extractNeckSize(bottle.description) ||
    extractNeckSize(bottle.sku);

  if (bottleNeck) {
    const neckMatch = innerProducts.find((inner) => {
      const innerNeck =
        extractNeckSize(inner.sizeOrType) ||
        extractNeckSize(inner.name) ||
        extractNeckSize(inner.description) ||
        extractNeckSize(inner.sku);
      return innerNeck === bottleNeck;
    });
    if (neckMatch) return neckMatch;
  }

  // 3. Fallback: match standard active 28mm inner or first active inner
  const defaultStandardInner =
    innerProducts.find((p) => p.status === 'active' && p.name.toLowerCase().includes('standard')) ||
    innerProducts.find((p) => p.status === 'active') ||
    innerProducts[0];

  return defaultStandardInner || null;
}
