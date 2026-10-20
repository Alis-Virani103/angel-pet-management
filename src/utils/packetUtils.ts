import { OrderItem, Product } from '../types';

export function isPositiveInteger(value: unknown): value is number {
  if (typeof value === 'number') {
    return Number.isInteger(value) && value > 0;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const num = Number(value);
    return Number.isInteger(num) && num > 0;
  }
  return false;
}

export function isPositiveNumber(value: unknown): value is number {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const num = Number(value);
    return Number.isFinite(num) && num > 0;
  }
  return false;
}

export function parsePositiveInteger(value: string): number | '' {
  const digitsOnly = value.replace(/\D/g, '');
  const normalizedValue = digitsOnly.replace(/^0+(?=\d)/, '');
  return normalizedValue ? Number(normalizedValue) : '';
}

export function parsePositiveNumber(value: string): number | '' {
  if (!value) return '';
  
  // Allow only digits and one decimal point
  const cleaned = value.replace(/[^0-9.]/g, '');
  
  // Ensure only one decimal point
  const parts = cleaned.split('.');
  if (parts.length > 2) {
    return '';
  }
  
  const normalizedValue = parts.join('.');
  
  // Allow partial input like "1." or ".5" for typing
  if (!normalizedValue || normalizedValue === '.') {
    return '';
  }
  
  const num = Number(normalizedValue);
  
  // If it's a valid positive number, return it
  if (Number.isFinite(num) && num > 0) {
    return num;
  }
  
  // If it's zero or negative, return empty
  return '';
}

/**
 * Clean decimal input for display (allows partial input like "1." and "0.25")
 */
export function cleanDecimalInput(value: string): string {
  if (!value) return '';
  
  // Allow only digits and one decimal point
  const cleaned = value.replace(/[^0-9.]/g, '');
  
  // Ensure at most one decimal point
  const parts = cleaned.split('.');
  if (parts.length > 2) {
    return parts[0] + '.' + parts.slice(1).join('');
  }
  
  return cleaned;
}

/**
 * Formats a number cleanly using Indian locale ('en-IN') without trailing zeros,
 * preserving decimals up to maxDecimals.
 */
export function formatNumberDisplay(value: number | undefined | null, maxDecimals: number = 4): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '0';
  if (Number.isInteger(value)) {
    return value.toLocaleString('en-IN');
  }
  return value.toLocaleString('en-IN', { maximumFractionDigits: maxDecimals });
}

/**
 * Checks whether fractional packets make business sense for a product.
 * Returns true if fractional packets are allowed, false if packets must be whole.
 */
export function canProductUseFractionalPackets(product?: Pick<Product, 'allowFractionalPackets'> | null): boolean {
  if (!product) return true;
  return product.allowFractionalPackets !== false;
}

export function getProductUnitsPerPacket(product?: Pick<Product, 'unitsPerPacket'> | null): number | undefined {
  if (!isPositiveInteger(product?.unitsPerPacket)) return undefined;
  return typeof product.unitsPerPacket === 'number'
    ? product.unitsPerPacket
    : Number(product.unitsPerPacket);
}

export function getOrderItemUnitsPerPacket(
  orderItem?: Pick<OrderItem, 'unitsPerPacket'> | null,
  product?: Pick<Product, 'unitsPerPacket'> | null
): number | undefined {
  return getProductUnitsPerPacket(orderItem) ?? getProductUnitsPerPacket(product);
}

export function calculatePacketUnits(packetCount: number, unitsPerPacket: number): number {
  if (!packetCount || !unitsPerPacket) return 0;
  const total = packetCount * unitsPerPacket;
  // Clean floating point arithmetic without losing precision (e.g., 2.5 * 1000 = 2500, 0.25 * 500 = 125)
  return Math.round(total * 10000) / 10000;
}

export function calculatePacketsFromQuantity(quantity: number, unitsPerPacket: number): number {
  if (!quantity || !unitsPerPacket) return 0;
  const count = quantity / unitsPerPacket;
  return Number.isInteger(count) ? count : Math.round(count * 10000) / 10000;
}

export function calculateTotalWeightKg(numberOfBags: number, weightPerBagKg: number): number {
  if (!isPositiveNumber(numberOfBags) || !isPositiveNumber(weightPerBagKg)) return 0;
  return Math.round(numberOfBags * weightPerBagKg * 10000) / 10000;
}

export function calculateEquivalentPieces(totalWeightKg: number, weightPerPieceGrams: number): number {
  if (!isPositiveNumber(totalWeightKg) || !isPositiveNumber(weightPerPieceGrams)) return 0;
  return Math.round((totalWeightKg * 1000 / weightPerPieceGrams) * 10000) / 10000;
}

export function calculatePiecesFromPackets(packetQuantity: number, unitsPerPacket: number): number {
  if (!isPositiveNumber(packetQuantity) || !isPositiveInteger(unitsPerPacket)) return 0;
  return Math.round(packetQuantity * unitsPerPacket * 10000) / 10000;
}

export function calculateWeightFromPieces(totalPieces: number, weightPerPieceGrams: number): number {
  if (!isPositiveNumber(totalPieces) || !isPositiveNumber(weightPerPieceGrams)) return 0;
  return Math.round((totalPieces * weightPerPieceGrams / 1000) * 10000) / 10000;
}

export function formatPacketBreakdown(quantity: number, unitsPerPacket: number) {
  if (!quantity || !unitsPerPacket) {
    return { packets: 0, fullPackets: 0, remainderUnits: 0, displayText: '0 Packets' };
  }
  const packets = calculatePacketsFromQuantity(quantity, unitsPerPacket);
  const fullPackets = Math.floor(quantity / unitsPerPacket);
  const remainderUnits = Math.round((quantity % unitsPerPacket) * 10000) / 10000;
  
  // Format display based on whether it's a whole number or decimal
  const packetsDisplay = formatNumberDisplay(packets);
  const looseDisplay = formatNumberDisplay(remainderUnits);
  
  const displayText = remainderUnits === 0
    ? `${packetsDisplay} ${packets === 1 ? 'Packet' : 'Packets'}`
    : `${packetsDisplay} Packets (${fullPackets} pkts + ${looseDisplay} loose pcs)`;

  return { packets, fullPackets, remainderUnits, displayText };
}

export function orderItemSoldByPacket(item: Pick<OrderItem, 'soldByPacket' | 'packetCount' | 'unitsPerPacket'>): boolean {
  return Boolean(
    item.soldByPacket &&
    isPositiveNumber(item.packetCount) &&
    isPositiveInteger(item.unitsPerPacket)
  );
}
