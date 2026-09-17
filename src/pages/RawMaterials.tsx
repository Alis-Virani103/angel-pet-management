import React, { useState, useEffect } from 'react';
import { RawMaterial, RawMaterialUsage } from '../types';
import { getRawMaterials, getRawMaterialUsage, deleteRawMaterial } from '../services/db';
import { Badge } from '../components/common/Badge';
import {
  Layers,
  Plus,
  MinusCircle,
  Search,
  Edit,
  Trash2
} from 'lucide-react';

import { ShoppingBag, ArrowRight } from 'lucide-react';
import { useTranslation } from '../i18n';

interface RawMaterialsProps {
  onOpenAddRawMaterialModal: (material?: RawMaterial) => void;
  onOpenRecordMaterialUsageModal: () => void;
  onOpenNewPurchaseModal?: () => void;
}

export const RawMaterials: React.FC<RawMaterialsProps> = ({
  onOpenAddRawMaterialModal,
  onOpenRecordMaterialUsageModal,
  onOpenNewPurchaseModal
}) => {
  const { t, confirm } = useTranslation();
  const [materials, setMaterials] = useState<RawMaterial[]>([]);
  const [usageLogs, setUsageLogs] = useState<RawMaterialUsage[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRawMaterialsData();
  }, []);

  const loadRawMaterialsData = async () => {
    setLoading(true);
    try {
      const [matList, usgList] = await Promise.all([getRawMaterials(), getRawMaterialUsage()]);
      setMaterials(matList);
      setUsageLogs(usgList);
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
            {t('Stock levels are automatically maintained from Purchases incoming receipts')}
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
          <button
            onClick={() => onOpenAddRawMaterialModal()}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs rounded-xl transition-colors flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>{t('Add Item')}</span>
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
                <th className="py-3.5 px-4">{t('Supplier')}</th>
                <th className="py-3.5 px-4">{t('Status')}</th>
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
                      {m.currentStock.toLocaleString()} {m.unit}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500">
                      {m.minimumStock.toLocaleString()} {m.unit}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-900">₹{m.unitCost.toFixed(2)}</td>
                    <td className="py-3.5 px-4 text-slate-600">{m.supplier}</td>
                    <td className="py-3.5 px-4">
                      <Badge status={isLow ? 'low_stock' : 'healthy'} />
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end space-x-1">
                        <button
                          onClick={() => onOpenAddRawMaterialModal(m)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          title={t('Edit Raw Material')}
                        >
                          <Edit className="w-4 h-4" />
                        </button>
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
                <th className="py-3 px-4">{t('Quantity Used')}</th>
                <th className="py-3 px-4">{t('Production Batch')}</th>
                <th className="py-3 px-4">{t('Notes')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
              {usageLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
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
                    <td className="py-3 px-4 text-slate-600 font-mono text-[11px]">{u.productionBatch || 'BATCH-001'}</td>
                    <td className="py-3 px-4 text-slate-500">{u.notes || 'Routine production deduction'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
