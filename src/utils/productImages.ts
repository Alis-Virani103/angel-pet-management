/**
 * Product Image Mapping Helper
 * Maps product SKU/name to asset image paths.
 * Keeps image handling separate from core product data & database models.
 */

export const PRODUCT_IMAGE_MAP: Record<string, string> = {
  // Bottle Mappings
  'BTL-100': '/assets/products/bottle_100ml.png',
  '100ml Bottle': '/assets/products/bottle_100ml.png',

  'BTL-200': '/assets/products/bottle_200ml.png',
  '200ml Bottle': '/assets/products/bottle_200ml.png',

  'BTL-250': '/assets/products/bottle_250ml.png',
  '250ml Bottle': '/assets/products/bottle_250ml.png',

  'BTL-500': '/assets/products/bottle_500ml.png',
  '500ml Bottle': '/assets/products/bottle_500ml.png',

  'BTL-1000': '/assets/products/bottle_1l.png',
  '1L Bottle': '/assets/products/bottle_1l.png',

  'BTL-2000': '/assets/products/bottle_2l.png',
  '2L Bottle': '/assets/products/bottle_2l.png',

  'BTL-5000': '/assets/products/bottle_5l.png',
  '5L Bottle': '/assets/products/bottle_5l.png',

  // Cap Mappings
  'CAP-28S': '/assets/products/cap_28mm_standard.png',
  '28mm Standard Cap': '/assets/products/cap_28mm_standard.png',

  'CAP-28F': '/assets/products/cap_28mm_flip.png',
  '28mm Flip Cap': '/assets/products/cap_28mm_flip.png',

  'CAP-38S': '/assets/products/cap_38mm.png',
  '38mm Cap': '/assets/products/cap_38mm.png',

  'CAP-45S': '/assets/products/cap_45mm.png',
  '45mm Cap': '/assets/products/cap_45mm.png',

  'CAP-CRC': '/assets/products/cap_child_resistant.png',
  'Child Resistant Cap': '/assets/products/cap_child_resistant.png',
};

/**
 * Get product image URL for a given product object.
 * Returns custom imageUrl if explicitly defined on the product,
 * or resolves from SKU / Product Name map,
 * or returns undefined to show the professional placeholder.
 */
export function getProductImageUrl(product: {
  id?: string;
  sku?: string;
  name?: string;
  imageUrl?: string;
}): string | undefined {
  if (product.imageUrl && product.imageUrl.trim()) {
    return product.imageUrl;
  }
  if (product.sku && PRODUCT_IMAGE_MAP[product.sku]) {
    return PRODUCT_IMAGE_MAP[product.sku];
  }
  if (product.name && PRODUCT_IMAGE_MAP[product.name]) {
    return PRODUCT_IMAGE_MAP[product.name];
  }

  // Case-insensitive fallback matching
  const normalizedSku = product.sku?.trim().toUpperCase();
  const normalizedName = product.name?.trim().toUpperCase();

  for (const [key, path] of Object.entries(PRODUCT_IMAGE_MAP)) {
    if (
      (normalizedSku && key.toUpperCase() === normalizedSku) ||
      (normalizedName && key.toUpperCase() === normalizedName)
    ) {
      return path;
    }
  }

  return undefined;
}
