import React, { useEffect, useState } from 'react';
import { Modal } from '../common/Modal';
import { PurchaseOrder, Supplier } from '../../types';
import { getSuppliers, updatePurchase } from '../../services/db';
import { buildBulkPurchaseUpdates, BulkPurchaseEditDraft } from '../../utils/purchaseBulkUtils';
import { AlertCircle, Calendar, FileText, Save, Building2 } from 'lucide-react';

interface BulkEditPurchasesModalProps {
  isOpen: boolean;
  purchases: PurchaseOrder[];
  onClose: () => void;
  onSaved: (updatedPurchases: PurchaseOrder[]) => void;
}

export const BulkEditPurchasesModal: React.FC<BulkEditPurchasesModalProps> = ({
  isOpen,
  purchases,
  onClose,
  onSaved
}) => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [applySupplier, setApplySupplier] = useState(false);
  const [supplierId, setSupplierId] = useState('');
  const [applyDate, setApplyDate] = useState(false);
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [applyNotes, setApplyNotes] = useState(false);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setApplySupplier(false);
    setSupplierId(purchases[0]?.supplierId || '');
    setApplyDate(false);
    setPurchaseDate(new Date().toISOString().split('T')[0]);
    setApplyNotes(false);
    setNotes('');
    setError('');
    setLoading(false);
    getSuppliers()
      .then(setSuppliers)
      .catch((loadError) => {
        console.error('Failed to load suppliers for bulk purchase edit:', loadError);
        setSuppliers([]);
      });
  }, [isOpen, purchases]);

  const selectedSupplier = suppliers.find((supplier) => supplier.id === supplierId);

  const handleSubmit = async () => {
    setError('');

    if (!applySupplier && !applyDate && !applyNotes) {
      setError('Select at least one field to update.');
      return;
    }
    if (applySupplier && !selectedSupplier) {
      setError('Please select a supplier.');
      return;
    }
    if (applyDate && !purchaseDate) {
      setError('Please select a purchase date.');
      return;
    }

    const draft: BulkPurchaseEditDraft = {};
    if (applySupplier && selectedSupplier) {
      draft.supplierId = selectedSupplier.id;
      draft.supplierName = selectedSupplier.name;
      draft.supplierPhone = selectedSupplier.phone || '';
    }
    if (applyDate) draft.purchaseDate = purchaseDate;
    if (applyNotes) draft.notes = notes;

    const updates = purchases
      .map((purchase) => ({ purchase, changes: buildBulkPurchaseUpdates(purchase, draft) }))
      .filter(({ changes }) => Object.keys(changes).length > 0);

    if (updates.length === 0) {
      setError('No selected purchases need these changes.');
      return;
    }

    setLoading(true);
    const updatedPurchases: PurchaseOrder[] = [];
    const failedNumbers: string[] = [];

    for (const { purchase, changes } of updates) {
      try {
        updatedPurchases.push(await updatePurchase(purchase.id, changes));
      } catch (updateError) {
        console.error(`Failed to bulk update purchase ${purchase.purchaseNumber}:`, updateError);
        failedNumbers.push(purchase.purchaseNumber);
      }
    }

    setLoading(false);

    if (updatedPurchases.length > 0) {
      onSaved(updatedPurchases);
    }

    if (failedNumbers.length > 0) {
      setError(
        `Updated ${updatedPurchases.length} purchase(s). Failed: ${failedNumbers.join(', ')}.`
      );
      return;
    }

    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Selected Purchases"
      subtitle={`${purchases.length} purchase(s) selected. Only checked fields will be changed.`}
      maxWidth="lg"
    >
      <div className="space-y-4">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-3">
          <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50/60 cursor-pointer">
            <input
              type="checkbox"
              checked={applySupplier}
              onChange={(event) => setApplySupplier(event.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-slate-300"
            />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2 text-xs font-bold text-slate-800">
                <Building2 className="w-4 h-4 text-blue-600" />
                Supplier
              </span>
              {applySupplier && (
                <select
                  value={supplierId}
                  onChange={(event) => setSupplierId(event.target.value)}
                  className="mt-2 w-full px-3 py-2 bg-white text-xs rounded-xl border border-slate-200"
                >
                  <option value="">Select supplier</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </option>
                  ))}
                </select>
              )}
            </span>
          </label>

          <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50/60 cursor-pointer">
            <input
              type="checkbox"
              checked={applyDate}
              onChange={(event) => setApplyDate(event.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-slate-300"
            />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2 text-xs font-bold text-slate-800">
                <Calendar className="w-4 h-4 text-emerald-600" />
                Purchase Date
              </span>
              {applyDate && (
                <input
                  type="date"
                  value={purchaseDate}
                  onChange={(event) => setPurchaseDate(event.target.value)}
                  className="mt-2 w-full px-3 py-2 bg-white text-xs rounded-xl border border-slate-200"
                />
              )}
            </span>
          </label>

          <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50/60 cursor-pointer">
            <input
              type="checkbox"
              checked={applyNotes}
              onChange={(event) => setApplyNotes(event.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-slate-300"
            />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2 text-xs font-bold text-slate-800">
                <FileText className="w-4 h-4 text-amber-600" />
                Notes
              </span>
              {applyNotes && (
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  className="mt-2 w-full px-3 py-2 bg-white text-xs rounded-xl border border-slate-200"
                  placeholder="Enter notes to apply to selected purchases"
                />
              )}
            </span>
          </label>
        </div>

        <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-[11px] text-slate-500 leading-relaxed">
          Items, quantities, rates, stock, payment status, and totals are not changed by this bulk edit.
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5"
          >
            <Save className="w-3.5 h-3.5" />
            {loading ? 'Saving...' : 'Apply Changes'}
          </button>
        </div>
      </div>
    </Modal>
  );
};
