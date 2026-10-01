import React, { useState, useEffect } from 'react';
import { RawMaterial, RawMaterialUsage, PurchaseOrder } from '../types';
import { getRawMaterials, getRawMaterialUsage, deleteRawMaterial, getPurchases } from '../services/db';
import { Badge } from '../components/common/Badge';
import { RawMaterialInventoryHistoryModal } from '../components/modals/RawMaterialInventoryHistoryModal';
import { getStockInBothUnits, formatQuantityWithUnit } from '../utils/unitConversion';
import {
  MinusCircle,
  Search,
  Trash2,
  ShoppingBag,
  History
} from 'lucide-react';
import { useTranslation } from '../i18n';

interface RawMaterialsProps {
  onOpenAddRawMaterialModal?: (material?: RawMaterial) => void;
  onOpenRecordMaterialUsageModal: () => void;
  onOpenNewPurchaseModal?: () => void;
}

export const RawMaterials: React.FC<RawMaterialsProps> = ({
  onOpenRecordMaterialUsageModal,
  onOpenNewPurchaseModal
}) => {
  const { t, confirm } = useTranslation();
  const [materials, setMaterials] = useState<RawMaterial[]>([]);
  const [usageLogs, setUsageLogs] = useState<RawMaterialUsage[]>([]);
  const [purchases, setPurchases] = useState<PurchaseOrder[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<RawMaterial | null>(null);

  useEffect(() => {
    loadRawMaterialsData();
  }, []);

  const loadRawMaterialsData = async () => {
    setLoading(true);
    try {
      const [matList, usgList, purList] = await Promise.all([getRawMaterials(), getRawMaterialUsage(), getPurchases()]);
      setMaterials(matList);
      setUsageLogs(usgList);
      setPurchases(purList);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this raw material item?')) {
      try {
        await deleteRawMaterial(id);
        loadRawMaterialsData();
      } catch (e) {
        console.error(e);
      }
    }
  };

  const filteredMaterials = materials.filter((m) => {
    const q = searchQuery.toLowerCase();
    return (
      m.name.toLowerCase().includes(q) ||
      m.code.toLowerCase().includes(q) ||
      m.supplier.toLowerCase().includes(q) ||
      m.category.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{t('Raw Materials Inventory')}</h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            {t('Stock levels and raw materials are automatically created & maintained from Purchase entries')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onOpenNewPurchaseModal && (
            <button
              onClick={onOpenNewPurchaseModal}
              className="px-3.5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-md shadow-blue-500/20 transition-colors flex items-center space-x-1.5"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>{t('Record Purchase')}</span>
            </button>
          )}
          <button
            onClick={onOpenRecordMaterialUsageModal}
            className="px-3.5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl transition-colors flex items-center space-x-1.5"
          >
            <MinusCircle className="w-4 h-4 text-amber-400" />
            <span>{t('Record Usage')}</span>
          </button>
        </div>
      </div>

      {/* Raw Materials Inventory Table */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">{t('Raw Material Inventory')}</h2>
            <p className="text-xs text-slate-500">{t('Live stock tracking and low-material warning limits')}</p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder={t('Search granules or codes...')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 text-xs font-medium text-slate-800 rounded-xl border border-slate-200 focus:bg-white"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="py-3.5 px-4">{t('Material Name')}</th>
                <th className="py-3.5 px-4">{t('Code')}</th>
                <th className="py-3.5 px-4">{t('Category')}</th>
                <th className="py-3.5 px-4">{t('Current Stock')}</th>
                <th className="py-3.5 px-4">{t('Minimum Stock')}</th>
                <th className="py-3.5 px-4">{t('Unit Cost')}</th>
                <th className="py-3.5 px-4">{t('Base Unit')}</th>
                <th className="py-3.5 px-4">{t('Supplier')}</th>
                <th className="py-3.5 px-4">{t('Status')}</th>
                <th className="py-3.5 px-4">{t('History')}</th>
                <th className="py-3.5 px-4 text-right">{t('Actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
              {filteredMaterials.map((m) => {
                const isLow = m.currentStock <= m.minimumStock;
                return (
                  <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-slate-900">{m.name}</td>
                    <td className="py-3.5 px-4 font-mono text-[11px] text-slate-600">{m.code}</td>
                    <td className="py-3.5 px-4 capitalize text-slate-600">{m.category}</td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      {(() => {
                        const stock = getStockInBothUnits(m);
                        if (stock.purchaseUnit !== stock.baseUnit) {
                          return (
                            <div>
                              <div>{formatQuantityWithUnit(stock.baseQuantity, stock.baseUnit)}</div>
                              <div className="text-[10px] text-slate-400">
                                ({formatQuantityWithUnit(stock.purchaseQuantity, stock.purchaseUnit)})
                              </div>
                            </div>
                          );
                        }
                        return formatQuantityWithUnit(stock.baseQuantity, stock.baseUnit);
                      })()}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500">
                      {m.minimumStock.toLocaleString()} {m.baseUnit}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-900">₹{m.unitCost.toFixed(2)}</td>
                    <td className="py-3.5 px-4 text-slate-600">{m.baseUnit}</td>
                    <td className="py-3.5 px-4 text-slate-600">{m.supplier}</td>
                    <td className="py-3.5 px-4">
                      <Badge status={isLow ? 'low_stock' : 'healthy'} />
                    </td>
                    <td className="py-3.5 px-4">
                      <button
                        onClick={() => {
                          setSelectedMaterial(m);
                          setHistoryModalOpen(true);
                        }}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold rounded-lg transition-colors flex items-center gap-1.5"
                      >
                        <History className="w-3.5 h-3.5" />
                        <span>History</span>
                      </button>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end space-x-1">
                        <button
                          onClick={() => handleDelete(m.id)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          title={t('Delete Raw Material')}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Usage History Section */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">{t('Raw Material Usage History')}</h2>
          <p className="text-xs text-slate-500">{t('Log of raw material consumption per production batch')}</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-4">{t('Date')}</th>
                <th className="py-3 px-4">{t('Material Name')}</th>
                <th className="py-3 px-4">{t('Consumed')}</th>
                <th className="py-3 px-4">{t('Wastage 1')}</th>
                <th className="py-3 px-4">{t('Wastage 2')}</th>
                <th className="py-3 px-4">{t('Total')}</th>
                <th className="py-3 px-4">{t('Converted')}</th>
                <th className="py-3 px-4">{t('Pieces')}</th>
                <th className="py-3 px-4">{t('Batch')}</th>
                <th className="py-3 px-4">{t('Notes')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
              {usageLogs.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-400">
                    {t('No material usage recorded yet.')}
                  </td>
                </tr>
              ) : (
                usageLogs.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 text-slate-500">{u.date}</td>
                    <td className="py-3 px-4 font-bold text-slate-900">{u.materialName}</td>
                    <td className="py-3 px-4 font-bold text-amber-600">
                      -{u.quantity.toLocaleString()} {u.unit}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {u.wastage1 && u.wastage1 > 0 ? (
                        <span className="text-rose-600">
                          -{u.wastage1.toLocaleString()} {u.unit}
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {u.wastage2 && u.wastage2 > 0 ? (
                        <span className="text-rose-600">
                          -{u.wastage2.toLocaleString()} {u.unit}
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900">
                      -{u.totalDeduction ? u.totalDeduction.toLocaleString() : u.quantity.toLocaleString()} {u.unit}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {u.baseQuantity && u.baseUnit && u.baseQuantity !== u.quantity ? (
                        <span className="text-blue-600">
                          -{formatQuantityWithUnit(u.baseQuantity, u.baseUnit)}
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {u.equivalentPieces && u.equivalentPieces > 0 ? (
                        <span className="text-purple-600">
                          {formatQuantityWithUnit(u.equivalentPieces, 'pcs')}
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-600 font-mono text-[11px]">{u.productionBatch || 'BATCH-001'}</td>
                    <td className="py-3 px-4 text-slate-500">{u.notes || 'Routine production deduction'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Raw Material Inventory History Modal */}
      {selectedMaterial && (
        <RawMaterialInventoryHistoryModal
          isOpen={historyModalOpen}
          onClose={() => {
            setHistoryModalOpen(false);
            setSelectedMaterial(null);
          }}
          material={selectedMaterial}
          usageLogs={usageLogs}
          purchases={purchases}
        />
      )}
    </div>
  );
};
