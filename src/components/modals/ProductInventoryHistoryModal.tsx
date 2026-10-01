import React from 'react';
import { Modal } from '../common/Modal';
import { FinishedGoodsLog } from '../../types';
import { Clock, TrendingUp, Package } from 'lucide-react';

interface ProductInventoryHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  productId: string;
  productName: string;
  currentStock: number;
  unit: string;
  logs: FinishedGoodsLog[];
}

export const ProductInventoryHistoryModal: React.FC<ProductInventoryHistoryModalProps> = ({
  isOpen,
  onClose,
  productId,
  productName,
  currentStock,
  unit,
  logs
}) => {
  // Filter logs for this specific product and sort by createdAt (newest first)
  const productLogs = logs
    .filter((log) => log.productId === productId)
    .sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : new Date(a.date).getTime();
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : new Date(b.date).getTime();
      return dateB - dateA;
    });

  const formatDateTime = (log: FinishedGoodsLog): string => {
    if (log.createdAt) {
      const date = new Date(log.createdAt);
      const day = date.getDate();
      const month = date.toLocaleString('en-US', { month: 'short' });
      const year = date.getFullYear();
      const hours = date.getHours();
      const minutes = date.getMinutes().toString().padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours % 12 || 12;
      return `${day} ${month} ${year}, ${displayHours}:${minutes} ${ampm}`;
    }
    // Fallback to date only if createdAt is not available
    return `${log.date} (Time unavailable)`;
  };

  const getSource = (log: FinishedGoodsLog): string => {
    return log.source || 'Source unavailable';
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Inventory History"
      subtitle={`Stock addition history for ${productName}`}
      maxWidth="lg"
    >
      <div className="space-y-4">
        {/* Current Stock Summary */}
        <div className="bg-purple-50 rounded-xl border border-purple-100 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
              <Package className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <div className="text-xs text-purple-600 font-medium">Current Stock</div>
              <div className="text-lg font-bold text-purple-900">
                {currentStock.toLocaleString()} {unit}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-purple-600 font-medium">Total History Entries</div>
            <div className="text-lg font-bold text-purple-900">{productLogs.length}</div>
          </div>
        </div>

        {/* History Table */}
        {productLogs.length === 0 ? (
          <div className="text-center py-12 bg-slate-50 rounded-xl border border-slate-100">
            <Clock className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <div className="text-sm font-medium text-slate-500">No inventory history found</div>
            <div className="text-xs text-slate-400 mt-1">Stock additions will appear here</div>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-4">Date & Time</th>
                    <th className="py-3 px-4">Quantity Added</th>
                    <th className="py-3 px-4">Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                  {productLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 text-slate-600">{formatDateTime(log)}</td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1 font-bold text-emerald-600">
                          <TrendingUp className="w-3.5 h-3.5" />
                          +{log.quantityProduced.toLocaleString()} {log.unit}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600">{getSource(log)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
