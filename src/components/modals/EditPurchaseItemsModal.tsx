import React, { useEffect, useState } from 'react';
import { Modal } from '../common/Modal';
import { PurchaseItem, PurchaseOrder, RawMaterial } from '../../types';
import { getRawMaterials, updatePurchase } from '../../services/db';
import { AlertCircle, Plus, Save, Trash2 } from 'lucide-react';

interface EditPurchaseItemsModalProps {
  isOpen: boolean;
  purchase: PurchaseOrder;
  onClose: () => void;
  onSaved: (purchase: PurchaseOrder) => void;
}

interface DraftItem {
  id: string;
  rawMaterialId: string;
  quantity: string;
  unitCost: string;
}

const createDraftItem = (item?: PurchaseItem): DraftItem => ({
  id: item?.rawMaterialId || `line-${Date.now()}-${Math.random()}`,
  rawMaterialId: item?.rawMaterialId || '',
  quantity: item ? String(item.quantity) : '',
  unitCost: item ? String(item.unitCost) : ''
});

export const EditPurchaseItemsModal: React.FC<EditPurchaseItemsModalProps> = ({
  isOpen,
  purchase,
  onClose,
  onSaved
}) => {
  const [materials, setMaterials] = useState<RawMaterial[]>([]);
  const [items, setItems] = useState<DraftItem[]>([]);
  const [notes, setNotes] = useState(purchase.notes || '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setItems(purchase.items.map(createDraftItem));
    setNotes(purchase.notes || '');
    setError('');
    getRawMaterials().then(setMaterials).catch(() => setError('Unable to load raw materials.'));
  }, [isOpen, purchase]);

  const updateItem = (id: string, updates: Partial<DraftItem>) => {
    setItems((currentItems) => currentItems.map((item) => item.id === id ? { ...item, ...updates } : item));
  };

  const getPurchaseItems = (): PurchaseItem[] => items.map((item) => {
    const material = materials.find((candidate) => candidate.id === item.rawMaterialId);
    const quantity = Number(item.quantity) || 0;
    const unitCost = Number(item.unitCost) || 0;
    return {
      rawMaterialId: item.rawMaterialId,
      rawMaterialName: material?.name || 'Unknown material',
      hsnSac: material?.code || '',
      category: material?.category || 'granules',
      unit: material?.unit || 'kg',
      unitCost,
      quantity,
      subtotal: quantity * unitCost,
      taxRate: purchase.gstRate
    };
  });

  const purchaseItems = getPurchaseItems();
  const subtotal = purchaseItems.reduce((sum, item) => sum + item.subtotal, 0);
  const gstAmount = purchase.gstRate > 0 ? subtotal * (purchase.gstRate / 100) : 0;
  const totalAmount = subtotal + gstAmount;

  const handleSubmit = async () => {
    setError('');
    if (items.length === 0 || items.some((item) => !item.rawMaterialId)) {
      setError('Please select a material for every bill item.');
      return;
    }
    if (items.some((item) => Number(item.quantity) <= 0 || Number(item.unitCost) <= 0)) {
      setError('Please enter a valid quantity and rate for every item.');
      return;
    }

    setLoading(true);
    try {
      const updated = await updatePurchase(purchase.id, {
        items: purchaseItems,
        subtotal,
        gstAmount,
        totalAmount,
        totalQuantity: purchaseItems.reduce((sum, item) => sum + item.quantity, 0),
        notes
      });
      onSaved(updated);
      onClose();
    } catch (e) {
      console.error('Failed to update purchase:', e);
      setError('Failed to update purchase bill.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Edit ${purchase.purchaseNumber}`} subtitle="Update all bill items, quantities, rates, or notes" maxWidth="2xl">
      <div className="space-y-4">
        {error && <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2"><AlertCircle className="w-4 h-4" /><span>{error}</span></div>}
        <div className="flex items-center justify-between">
          <div><h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Bill Items</h2><p className="text-[11px] text-slate-500 mt-1">All lines remain under this one bill number.</p></div>
          <button type="button" onClick={() => setItems((currentItems) => [...currentItems, createDraftItem()])} className="px-3 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5"><Plus className="w-3.5 h-3.5" />Add Item</button>
        </div>
        <div className="space-y-2 max-h-[45vh] overflow-y-auto pr-1">
          {items.map((item, index) => {
            const material = materials.find((candidate) => candidate.id === item.rawMaterialId);
            const line = purchaseItems[index];
            return <div key={item.id} className="grid grid-cols-1 md:grid-cols-[minmax(0,2fr)_110px_140px_140px_auto] gap-2 items-end p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div><label className="block text-[11px] font-semibold text-slate-600 mb-1">Product {index + 1}</label><select value={item.rawMaterialId} onChange={(e) => { const next = materials.find((candidate) => candidate.id === e.target.value); updateItem(item.id, { rawMaterialId: e.target.value, unitCost: next ? String(next.unitCost) : '' }); }} className="w-full px-3 py-2 bg-white text-xs rounded-xl border border-slate-200"><option value="">Select material</option>{materials.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name} ({candidate.code})</option>)}</select></div>
              <div><label className="block text-[11px] font-semibold text-slate-600 mb-1">Quantity</label><input type="text" inputMode="decimal" value={item.quantity} onChange={(e) => updateItem(item.id, { quantity: e.target.value.replace(/[^\d.]/g, '') })} className="w-full px-3 py-2 bg-white text-xs rounded-xl border border-slate-200" /><div className="text-[10px] text-slate-400 mt-1">{material?.unit || 'Unit'}</div></div>
              <div><label className="block text-[11px] font-semibold text-slate-600 mb-1">Rate</label><input type="text" inputMode="decimal" value={item.unitCost} onChange={(e) => updateItem(item.id, { unitCost: e.target.value.replace(/[^\d.]/g, '') })} className="w-full px-3 py-2 bg-white text-xs rounded-xl border border-slate-200" /></div>
              <div className="text-xs font-semibold text-slate-700 pb-2">Amount: ₹{(line?.subtotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
              <button type="button" disabled={items.length === 1} onClick={() => setItems((currentItems) => currentItems.filter((candidate) => candidate.id !== item.id))} className="p-2 text-rose-600 rounded-xl hover:bg-rose-50 disabled:opacity-40"><Trash2 className="w-4 h-4" /></button>
            </div>;
          })}
        </div>
        <div><label className="block text-xs font-semibold text-slate-700 mb-1">Purchase Notes</label><textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full px-3 py-2 bg-slate-50 text-xs rounded-xl border border-slate-200" /></div>
        <div className="p-4 bg-slate-900 text-white rounded-2xl space-y-2 text-xs"><div className="flex justify-between text-slate-400"><span>Subtotal:</span><span>₹{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div><div className="flex justify-between text-slate-400"><span>GST ({purchase.gstRate}%):</span><span>₹{gstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div><div className="flex justify-between text-base font-bold pt-2 border-t border-slate-800"><span>Grand Total:</span><span className="text-blue-400">₹{totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div></div>
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100"><button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600">Cancel</button><button type="button" onClick={handleSubmit} disabled={loading} className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 disabled:opacity-50 flex items-center gap-1.5"><Save className="w-3.5 h-3.5" />{loading ? 'Saving...' : 'Save Changes'}</button></div>
      </div>
    </Modal>
  );
};
