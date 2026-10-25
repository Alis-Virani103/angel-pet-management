import { PurchaseItem, RawMaterial } from '../types';

/**
 * Weight-to-pieces calculation for raw materials
 * Formula: pieces = (totalWeightKg × 1000) / weightPerPieceGrams
 * Where totalWeightKg = numberOfBags × weightPerBagKg
 */
export interface WeightToPiecesInput {
  numberOfBags?: number;      // Number of bags (optional)
  weightPerBagKg?: number;    // Weight per bag in kg (optional)
  totalWeightKg?: number;     // Direct total weight in kg (optional)
  weightPerPieceGrams?: number; // Weight per individual piece in grams
}

export interface WeightToPiecesResult {
  totalWeightKg: number | null;
  pieces: number | null;
  isValid: boolean;
  error?: string;
}

/**
 * Calculate pieces from weight inputs
 * @param input - Weight and piece configuration
 * @returns Result with total weight in kg and calculated pieces
 */
export function calculatePiecesFromWeight(input: WeightToPiecesInput): WeightToPiecesResult {
  const { numberOfBags, weightPerBagKg, totalWeightKg, weightPerPieceGrams } = input;

  // Validate weight per piece - required for pieces calculation
  if (!weightPerPieceGrams || weightPerPieceGrams <= 0) {
    return {
      totalWeightKg: null,
      pieces: null,
      isValid: false,
      error: 'Weight per piece must be a positive number'
    };
  }

  // Calculate total weight from bags
  let calculatedTotalWeightKg: number | null = null;
  
  if (numberOfBags && weightPerBagKg) {
    if (numberOfBags <= 0 || weightPerBagKg <= 0) {
      return {
        totalWeightKg: null,
        pieces: null,
        isValid: false,
        error: 'Number of bags and weight per bag must be positive'
      };
    }
    calculatedTotalWeightKg = numberOfBags * weightPerBagKg;
  } else if (totalWeightKg) {
    if (totalWeightKg <= 0) {
      return {
        totalWeightKg: null,
        pieces: null,
        isValid: false,
        error: 'Total weight must be positive'
      };
    }
    calculatedTotalWeightKg = totalWeightKg;
  }

  // If no valid weight input, return invalid
  if (calculatedTotalWeightKg === null) {
    return {
      totalWeightKg: null,
      pieces: null,
      isValid: false,
      error: 'Enter either number of bags with weight per bag, or total weight'
    };
  }

  // Calculate pieces: (totalWeightKg × 1000) / weightPerPieceGrams
  const totalWeightGrams = calculatedTotalWeightKg * 1000;
  const pieces = totalWeightGrams / weightPerPieceGrams;

  return {
    totalWeightKg: calculatedTotalWeightKg,
    pieces,
    isValid: true
  };
}

export interface BagPieceConversion {
  totalWeightGrams: number;
  calculatedPieces: number;
}

const isBagUnit = (unit?: string) => {
  const value = (unit || '').trim().toLowerCase();
  return value === 'bag' || value === 'bags';
};

/**
 * Load bag/piece weights from a saved material only when those specs already exist.
 * Missing values stay undefined so the purchase form never invents them.
 */
export function deriveMaterialBagSpecs(material: Pick<RawMaterial, 'purchaseUnit' | 'baseUnit' | 'unit' | 'conversionFactor' | 'piecesPerBaseUnit'>): {
  weightPerBagKg?: number;
  weightPerPieceGrams?: number;
} {
  const specs: { weightPerBagKg?: number; weightPerPieceGrams?: number } = {};
  const baseUnit = (material.baseUnit || material.unit || '').toLowerCase();
  if (isBagUnit(material.purchaseUnit) && material.conversionFactor > 0) {
    if (baseUnit === 'kg') specs.weightPerBagKg = material.conversionFactor;
    if (baseUnit === 'g') specs.weightPerBagKg = material.conversionFactor / 1000;
  }
  if (material.piecesPerBaseUnit && material.piecesPerBaseUnit > 0) {
    if (baseUnit === 'kg') specs.weightPerPieceGrams = 1000 / material.piecesPerBaseUnit;
    if (baseUnit === 'g') specs.weightPerPieceGrams = 1 / material.piecesPerBaseUnit;
  }
  return specs;
}

export function calculateBagPieceConversion(input: {
  numberOfBags: number;
  weightPerBagKg: number;
  weightPerPieceGrams: number;
}): BagPieceConversion | { error: string } {
  if (!Number.isFinite(input.numberOfBags) || input.numberOfBags <= 0) {
    return { error: 'Number of bags must be greater than 0.' };
  }
  if (!Number.isFinite(input.weightPerBagKg) || input.weightPerBagKg <= 0) {
    return { error: 'Weight per bag must be greater than 0.' };
  }
  if (!Number.isFinite(input.weightPerPieceGrams) || input.weightPerPieceGrams <= 0) {
    return { error: 'Weight per piece must be greater than 0. Division by zero is not allowed.' };
  }
  const totalWeightGrams = input.numberOfBags * input.weightPerBagKg * 1000;
  return {
    totalWeightGrams,
    calculatedPieces: totalWeightGrams / input.weightPerPieceGrams
  };
}

export function bagConversionToBaseQuantity(
  conversion: BagPieceConversion,
  material: Pick<RawMaterial, 'baseUnit' | 'unit'>
): number {
  const baseUnit = (material.baseUnit || material.unit || 'kg').toLowerCase();
  if (baseUnit === 'pcs') return conversion.calculatedPieces;
  if (baseUnit === 'g') return conversion.totalWeightGrams;
  return conversion.totalWeightGrams / 1000;
}

export function getReceivedPurchaseBaseQuantity(
  item: Pick<PurchaseItem, 'quantity' | 'unit' | 'numberOfBags' | 'weightPerBagKg' | 'weightPerPieceGrams'>,
  material: RawMaterial
): number {
  const conversion = calculateBagPieceConversion({
    numberOfBags: item.numberOfBags ?? 0,
    weightPerBagKg: item.weightPerBagKg ?? 0,
    weightPerPieceGrams: item.weightPerPieceGrams ?? 0
  });
  if (!('error' in conversion)) {
    return bagConversionToBaseQuantity(conversion, material);
  }
  return toBaseQuantity(item.quantity, item.unit, material);
}

/**
 * Convert a quantity from any unit to the base unit
 * @param quantity - The quantity to convert
 * @param fromUnit - The unit to convert from
 * @param material - The raw material with conversion configuration
 * @returns The quantity in base units
 */
export function toBaseQuantity(
  quantity: number,
  fromUnit: string | undefined,
  material: RawMaterial
): number {
  if (typeof quantity !== 'number' || isNaN(quantity)) return 0;
  if (!material) return quantity;

  const baseUnit = (material.baseUnit || material.unit || 'kg').toLowerCase();
  const purchaseUnit = (material.purchaseUnit || material.unit || 'kg').toLowerCase();
  const consumptionUnit = (material.consumptionUnit || material.baseUnit || material.unit || 'kg').toLowerCase();
  const from = (fromUnit || baseUnit).toLowerCase();

  // If already in base unit, return as-is
  if (from === baseUnit) {
    return quantity;
  }

  // If converting from purchase unit
  if (from === purchaseUnit) {
    return quantity * (material.conversionFactor || 1);
  }

  // Pieces can be purchased for materials whose stock is tracked by weight.
  if (from === 'pcs' && baseUnit !== 'pcs' && material.piecesPerBaseUnit && material.piecesPerBaseUnit > 0) {
    return quantity / material.piecesPerBaseUnit;
  }

  // If converting from consumption unit (should be same as base, but handle gracefully)
  if (from === consumptionUnit) {
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
  toUnit: string | undefined,
  material: RawMaterial
): number {
  if (typeof baseQuantity !== 'number' || isNaN(baseQuantity)) return 0;
  if (!material) return baseQuantity;

  const baseUnit = (material.baseUnit || material.unit || 'kg').toLowerCase();
  const purchaseUnit = (material.purchaseUnit || material.unit || 'kg').toLowerCase();
  const consumptionUnit = (material.consumptionUnit || material.baseUnit || material.unit || 'kg').toLowerCase();
  const target = (toUnit || baseUnit).toLowerCase();

  // If converting to base unit, return as-is
  if (target === baseUnit) {
    return baseQuantity;
  }

  // If converting to purchase unit
  if (target === purchaseUnit) {
    if (material.conversionFactor && material.conversionFactor > 0) {
      return baseQuantity / material.conversionFactor;
    }
    return baseQuantity;
  }

  // If converting to consumption unit (should be same as base)
  if (target === consumptionUnit) {
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
export function getUnitDisplayName(unit: string | undefined | null): string {
  if (!unit || typeof unit !== 'string') return '';
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
export function formatQuantityWithUnit(quantity: number | undefined | null, unit: string | undefined | null): string {
  const safeQty = typeof quantity === 'number' && !isNaN(quantity) ? quantity : 0;
  const displayUnit = getUnitDisplayName(unit);
  return `${safeQty.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${displayUnit}`.trim();
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
  unit: string | undefined,
  material: RawMaterial
): { isValid: boolean; error?: string } {
  if (typeof quantity !== 'number' || quantity <= 0 || isNaN(quantity)) {
    return { isValid: false, error: 'Quantity must be greater than 0' };
  }
  if (!material) {
    return { isValid: false, error: 'Material not found' };
  }

  const baseQuantity = toBaseQuantity(quantity, unit, material);
  const currentStock = material.currentStock ?? 0;

  if (baseQuantity > currentStock) {
    const availableBase = currentStock;
    const availableDisplay = formatQuantityWithUnit(availableBase, material.baseUnit || material.unit || 'kg');
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
  const baseQuantity = material?.currentStock ?? 0;
  const baseUnit = material?.baseUnit || material?.unit || 'kg';
  const purchaseUnit = material?.purchaseUnit || material?.unit || baseUnit;
  const purchaseQuantity = fromBaseQuantity(
    baseQuantity,
    purchaseUnit,
    material
  );

  return {
    baseQuantity,
    baseUnit,
    purchaseQuantity,
    purchaseUnit
  };
}

/**
 * Calculate equivalent pieces from base quantity
 * @param baseQuantity - The quantity in base units
 * @param material - The raw material with pieces conversion
 * @returns Equivalent pieces or undefined if no conversion exists
 */
export function calculateEquivalentPieces(baseQuantity: number | undefined | null, material: RawMaterial): number | undefined {
  if (typeof baseQuantity !== 'number' || isNaN(baseQuantity) || !material) return undefined;
  if (material.piecesPerBaseUnit && material.piecesPerBaseUnit > 0) {
    return baseQuantity * material.piecesPerBaseUnit;
  }
  return undefined;
}
