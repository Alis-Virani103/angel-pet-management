import React from 'react';
import { Modal } from '../common/Modal';
import { RawMaterial, RawMaterialUsage, PurchaseOrder } from '../../types';
import { formatQuantityWithUnit, getStockInBothUnits, calculateEquivalentPieces } from '../../utils/unitConversion';
import { Clock, TrendingUp, TrendingDown, Package, ShoppingCart } from 'lucide-react';
import { formatDate } from '../../utils/dateUtils';

interface RawMaterialInventoryHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  material: RawMaterial;
  usageLogs: RawMaterialUsage[];
  purchases: PurchaseOrder[];
}

export const RawMaterialInventoryHistoryModal: React.FC<RawMaterialInventoryHistoryModalProps> = ({
  isOpen,
  onClose,
  material,
  usageLogs,
  purchases
}) => {
  const stockDisplay = getStockInBothUnits(material);

  // Filter usage logs for this material
  const materialUsageLogs = (usageLogs || []).filter((log) => log && log.materialId === material?.id);

  // Filter purchase items for this material
  const materialPurchases = (purchases || [])
    .filter((purchase) => 
      purchase && Array.isArray(purchase.items) && purchase.items.some((item) => item && item.rawMaterialId === material?.id)
    )
    .map((purchase) => ({
      ...purchase,
      item: purchase.items.find((item) => item && item.rawMaterialId === material?.id)
    }))
    .filter((purchase) => purchase.item !== undefined);

  // Combine and sort all transactions by date
  const allTransactions = [
    ...materialPurchases.map((purchase) => ({
      type: 'purchase' as const,
      date: purchase.purchaseDate || '',
      quantity: purchase.item!.quantity || 0,
      unit: purchase.item!.unit || material.baseUnit || 'kg',
      wastage1: undefined,
      wastage2: undefined,
      totalDeduction: purchase.item!.quantity || 0,
      convertedQuantity: (material.conversionFactor || 0) > 0 
        ? (purchase.item!.quantity || 0) * material.conversionFactor 
        : (purchase.item!.quantity || 0),
      convertedUnit: material.baseUnit || material.unit || 'kg',
      equivalentPieces: material.piecesPerBaseUnit && material.piecesPerBaseUnit > 0
        ? ((material.conversionFactor || 0) > 0 
            ? (purchase.item!.quantity || 0) * material.conversionFactor 
            : (purchase.item!.quantity || 0)) * material.piecesPerBaseUnit
        : undefined,
      source: 'Purchase',
      notes: purchase.notes || (purchase.purchaseNumber ? `PO-${purchase.purchaseNumber}` : 'Purchase order')
    })),
    ...materialUsageLogs.map((usage) => ({
      type: 'consumption' as const,
      date: usage.date || '',
      quantity: usage.quantity || 0,
      unit: usage.unit || material.baseUnit || 'kg',
      wastage1: usage.wastage1,
      wastage2: usage.wastage2,
      totalDeduction: usage.totalDeduction || usage.quantity || 0,
      convertedQuantity: usage.baseTotalDeduction || usage.baseQuantity || usage.quantity || 0,
      convertedUnit: usage.baseUnit || usage.unit || material.baseUnit || 'kg',
      equivalentPieces: usage.equivalentPieces,
      source: 'Production Consumption',
      notes: usage.notes || usage.productionBatch || 'Routine deduction'
    }))
  ].sort((a, b) => {
    const dateA = a.date ? new Date(a.date).getTime() : 0;
    const dateB = b.date ? new Date(b.date).getTime() : 0;
    return dateB - dateA; // Newest first
  });

  const formatDateTime = (dateStr: string): string => {
    return formatDate(dateStr);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Raw Material Inventory History"
      subtitle={`Stock history for ${material.name}`}
      maxWidth="lg"
    >
      <div className="space-y-4">
        {/* Current Stock Summary */}
        <div className="bg-blue-50 rounded-xl border border-blue-100 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <Package className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <div className="text-xs text-blue-600 font-medium">Current Stock</div>
              <div className="text-lg font-bold text-blue-900">
                {formatQuantityWithUnit(stockDisplay.baseQuantity, stockDisplay.baseUnit)}
              </div>
              {stockDisplay.purchaseUnit !== stockDisplay.baseUnit && (
                <div className="text-xs text-blue-600">
                  Equivalent: {formatQuantityWithUnit(stockDisplay.purchaseQuantity, stockDisplay.purchaseUnit)}
                </div>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-blue-600 font-medium">Total Transactions</div>
            <div className="text-lg font-bold text-blue-900">{allTransactions.length}</div>
          </div>
        </div>

        {/* History Table */}
        {allTransactions.length === 0 ? (
          <div className="text-center py-12 bg-slate-50 rounded-xl border border-slate-100">
            <Clock className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <div className="text-sm font-medium text-slate-500">No inventory history found</div>
            <div className="text-xs text-slate-400 mt-1">Purchases and consumption will appear here</div>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Quantity</th>
                    <th className="py-3 px-4">Wastage 1</th>
                    <th className="py-3 px-4">Wastage 2</th>
                    <th className="py-3 px-4">Total</th>
                    <th className="py-3 px-4">Converted</th>
                    <th className="py-3 px-4">Pieces</th>
                    <th className="py-3 px-4">Source</th>
                    <th className="py-3 px-4">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                  {allTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-8 text-center text-slate-400">
                        No inventory history found
                      </td>
                    </tr>
                  ) : (
                    allTransactions.map((transaction, index) => (
                    <tr key={`${transaction.type}-${transaction.date}-${index}`} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 text-slate-600">{formatDateTime(transaction.date)}</td>
                      <td className="py-3 px-4">
                        {transaction.type === 'purchase' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-[10px] font-semibold">
                            <ShoppingCart className="w-3 h-3" />
                            Purchase
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-50 text-amber-700 rounded-lg text-[10px] font-semibold">
                            <TrendingDown className="w-3 h-3" />
                            Consumption
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`font-bold ${transaction.type === 'purchase' ? 'text-emerald-600' : 'text-amber-600'}`}>
                          {transaction.type === 'purchase' ? '+' : '-'}
                          {formatQuantityWithUnit(transaction.quantity, transaction.unit)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {transaction.wastage1 && transaction.wastage1 > 0 ? (
                          <span className="text-rose-600">
                            -{formatQuantityWithUnit(transaction.wastage1, transaction.unit)}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {transaction.wastage2 && transaction.wastage2 > 0 ? (
                          <span className="text-rose-600">
                            -{formatQuantityWithUnit(transaction.wastage2, transaction.unit)}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900">
                        {transaction.type === 'purchase' ? '+' : '-'}
                        {formatQuantityWithUnit(transaction.totalDeduction, transaction.unit)}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {transaction.convertedQuantity !== transaction.quantity ? (
                          <span className="text-blue-600">
                            {transaction.type === 'purchase' ? '+' : '-'}
                            {formatQuantityWithUnit(transaction.convertedQuantity, transaction.convertedUnit)}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {transaction.equivalentPieces && transaction.equivalentPieces > 0 ? (
                          <span className="text-purple-600">
                            {transaction.type === 'purchase' ? '+' : '-'}
                            {formatQuantityWithUnit(transaction.equivalentPieces, 'pcs')}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-600">{transaction.source}</td>
                      <td className="py-3 px-4 text-slate-500">{transaction.notes}</td>
                    </tr>
                  ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
