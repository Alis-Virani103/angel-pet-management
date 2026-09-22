import { OrderItem, Product } from '../types';

export function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

export function parsePositiveInteger(value: string): number | '' {
  const digitsOnly = value.replace(/\D/g, '');
  const normalizedValue = digitsOnly.replace(/^0+(?=\d)/, '');
  return normalizedValue ? Number(normalizedValue) : '';
}

export function getProductUnitsPerPacket(product?: Pick<Product, 'unitsPerPacket'> | null): number | undefined {
  return isPositiveInteger(product?.unitsPerPacket) ? product.unitsPerPacket : undefined;
}

export function calculatePacketUnits(packetCount: number, unitsPerPacket: number): number {
  return packetCount * unitsPerPacket;
}

export function orderItemSoldByPacket(item: Pick<OrderItem, 'soldByPacket' | 'packetCount' | 'unitsPerPacket'>): boolean {
  return Boolean(
    item.soldByPacket &&
    isPositiveInteger(item.packetCount) &&
    isPositiveInteger(item.unitsPerPacket)
  );
}
