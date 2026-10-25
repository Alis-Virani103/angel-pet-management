import { ProductType } from '../types';

const STORAGE_KEY = 'angel_pet_custom_product_types';

/**
 * Get all custom product types from localStorage
 */
export function getCustomProductTypes(): ProductType[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to load custom product types:', e);
  }
  return [];
}

/**
 * Add a new custom product type to localStorage
 */
export function addCustomProductType(type: ProductType): void {
  if (!type || typeof type !== 'string') return;

  const normalized = normalizeProductType(type);
  if (!normalized) return;

  const existingTypes = getCustomProductTypes();
  const standardTypes: ProductType[] = ['bottle', 'cap', 'inner'];

  // Check if type already exists (in standard or custom types)
  // Compare case-insensitively for standard types
  const normalizedLower = normalized.toLowerCase();
  if (standardTypes.some(std => std.toLowerCase() === normalizedLower) ||
      existingTypes.some(custom => custom.toLowerCase() === normalizedLower)) {
    return;
  }

  // Add new type
  const updatedTypes = [...existingTypes, normalized];
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedTypes));
  } catch (e) {
    console.error('Failed to save custom product type:', e);
  }
}

/**
 * Normalize product type: trim spaces and capitalize first letter
 */
export function normalizeProductType(type: string): string {
  const trimmed = type.trim();
  if (!trimmed) return trimmed;
  // Capitalize first letter, lowercase the rest
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
}

/**
 * Get all available product types (standard + custom)
 */
export function getAllProductTypes(products: any[]): ProductType[] {
  const customTypes = getCustomProductTypes();
  const productTypes = Array.from(new Set(
    products
      .filter(p => p && typeof p === 'object' && p.type)
      .map(p => p.type)
  ));
  const standardTypes: ProductType[] = ['bottle', 'cap', 'inner'];

  const allTypes = Array.from(new Set([...standardTypes, ...customTypes, ...productTypes]));
  return allTypes.sort();
}
