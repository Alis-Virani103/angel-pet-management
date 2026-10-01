import { RawMaterial } from '../types';

/**
 * Convert a quantity from any unit to the base unit
 * @param quantity - The quantity to convert
 * @param fromUnit - The unit to convert from
 * @param material - The raw material with conversion configuration
 * @returns The quantity in base units
 */
export function toBaseQuantity(
  quantity: number,
  fromUnit: string,
  material: RawMaterial
): number {
  // If already in base unit, return as-is
  if (fromUnit.toLowerCase() === material.baseUnit.toLowerCase()) {
    return quantity;
  }

  // If converting from purchase unit
  if (fromUnit.toLowerCase() === material.purchaseUnit.toLowerCase()) {
    return quantity * material.conversionFactor;
  }

  // If converting from consumption unit (should be same as base, but handle gracefully)
  if (fromUnit.toLowerCase() === material.consumptionUnit.toLowerCase()) {
    return quantity;
  }

  // For legacy materials without conversion configuration, assume same unit
  if (!material.conversionFactor || material.conversionFactor === 0) {
    return quantity;
  }

  // Default: assume no conversion needed
  return quantity;
}

/**
 * Convert a quantity from base unit to another unit
 * @param baseQuantity - The quantity in base units
 * @param toUnit - The unit to convert to
 * @param material - The raw material with conversion configuration
 * @returns The quantity in the target unit
 */
export function fromBaseQuantity(
  baseQuantity: number,
  toUnit: string,
  material: RawMaterial
): number {
  // If converting to base unit, return as-is
  if (toUnit.toLowerCase() === material.baseUnit.toLowerCase()) {
    return baseQuantity;
  }

  // If converting to purchase unit
  if (toUnit.toLowerCase() === material.purchaseUnit.toLowerCase()) {
    if (material.conversionFactor && material.conversionFactor > 0) {
      return baseQuantity / material.conversionFactor;
    }
    return baseQuantity;
  }

  // If converting to consumption unit (should be same as base)
  if (toUnit.toLowerCase() === material.consumptionUnit.toLowerCase()) {
    return baseQuantity;
  }

  // For legacy materials without conversion configuration, assume same unit
  if (!material.conversionFactor || material.conversionFactor === 0) {
    return baseQuantity;
  }

  // Default: assume no conversion needed
  return baseQuantity;
}

/**
 * Get a user-friendly display name for a unit
 * @param unit - The unit string
 * @returns User-friendly unit name
 */
export function getUnitDisplayName(unit: string): string {
  const unitMap: { [key: string]: string } = {
    'kg': 'kg',
    'g': 'g',
    'pcs': 'pcs',
    'bag': 'Bag',
    'bags': 'Bag',
    'carton': 'Carton',
    'cartons': 'Carton',
    'box': 'Box',
    'boxes': 'Box'
  };

  const lowerUnit = unit.toLowerCase();
  return unitMap[lowerUnit] || unit;
}

/**
 * Format a quantity with unit for display
 * @param quantity - The quantity
 * @param unit - The unit
 * @returns Formatted string (e.g., "5,000 kg")
 */
export function formatQuantityWithUnit(quantity: number, unit: string): string {
  const displayUnit = getUnitDisplayName(unit);
  return `${quantity.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${displayUnit}`;
}

/**
 * Validate if a consumption quantity is valid and within stock limits
 * @param quantity - The quantity to consume
 * @param unit - The unit of the quantity
 * @param material - The raw material
 * @returns Object with isValid flag and error message if invalid
 */
export function validateConsumption(
  quantity: number,
  unit: string,
  material: RawMaterial
): { isValid: boolean; error?: string } {
  if (quantity <= 0) {
    return { isValid: false, error: 'Quantity must be greater than 0' };
  }

  const baseQuantity = toBaseQuantity(quantity, unit, material);

  if (baseQuantity > material.currentStock) {
    const availableBase = material.currentStock;
    const availableDisplay = formatQuantityWithUnit(availableBase, material.baseUnit);
    return {
      isValid: false,
      error: `Insufficient stock. Available: ${availableDisplay}`
    };
  }

  return { isValid: true };
}

/**
 * Get the available stock in both base and purchase units
 * @param material - The raw material
 * @returns Object with stock in both units
 */
export function getStockInBothUnits(material: RawMaterial): {
  baseQuantity: number;
  baseUnit: string;
  purchaseQuantity: number;
  purchaseUnit: string;
} {
  const baseQuantity = material.currentStock;
  const purchaseQuantity = fromBaseQuantity(
    baseQuantity,
    material.purchaseUnit,
    material
  );

  return {
    baseQuantity,
    baseUnit: material.baseUnit,
    purchaseQuantity,
    purchaseUnit: material.purchaseUnit
  };
}

/**
 * Calculate equivalent pieces from base quantity
 * @param baseQuantity - The quantity in base units
 * @param material - The raw material with pieces conversion
 * @returns Equivalent pieces or undefined if no conversion exists
 */
export function calculateEquivalentPieces(baseQuantity: number, material: RawMaterial): number | undefined {
  if (material.piecesPerBaseUnit && material.piecesPerBaseUnit > 0) {
    return baseQuantity * material.piecesPerBaseUnit;
  }
  return undefined;
}
