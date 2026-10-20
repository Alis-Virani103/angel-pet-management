export type PurchasedMaterialConversionMode = 'bags' | 'piece_count' | 'packets';

export interface PurchasedMaterialTotals {
  totalWeightKg: number;
  totalPieces?: number;
}

export function calculatePurchasedMaterialTotals(
  mode: PurchasedMaterialConversionMode,
  quantity: number,
  unitWeight: number
): PurchasedMaterialTotals {
  const totalWeightKg = mode === 'piece_count'
    ? quantity * unitWeight / 1000
    : quantity * unitWeight;

  return {
    totalWeightKg: Math.round(totalWeightKg * 10000) / 10000,
    ...(mode === 'piece_count' ? { totalPieces: quantity } : {})
  };
}
