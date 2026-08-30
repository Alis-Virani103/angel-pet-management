import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { RawMaterial, RawMaterialCategory, PurchaseStatus } from '../../types';
import { getRawMaterials, addRawMaterial, addPurchase } from '../../services/db';
import { ShoppingBag, Plus, AlertCircle, CheckCircle2 } from 'lucide-react';

interface NewPurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPurchaseCreated?: () => void;
}

export const NewPurchaseModal: React.FC<NewPurchaseModalProps> = ({
  isOpen,
  onClose,
  onPurchaseCreated
}) => {
  const [materials, setMaterials] = useState<RawMaterial[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [selectedMaterialId, setSelectedMaterialId] = useState('');
  const [quantity, setQuantity] = useState<number>(1000);
  const [unitCost, setUnitCost] = useState<number>(0);
  const [supplierName, setSupplierName] = useState('');
  const [supplierPhone, setSupplierPhone] = useState('');
  const [status, setStatus] = useState<PurchaseStatus>('received');
  const [includeGst, setIncludeGst] = useState(true);
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');

  // Inline new material toggle
  const [isInlineMaterial, setIsInlineMaterial] = useState(false);
  const [newMaterialName, setNewMaterialName] = useState('');
  const [newMaterialCode, setNewMaterialCode] = useState('');
  const [newMaterialCategory, setNewMaterialCategory] = useState<RawMaterialCategory>('granules');
  const [newMaterialUnit, setNewMaterialUnit] = useState('kg');

  useEffect(() => {
    if (isOpen) {
      loadMaterials();
    }
  }, [isOpen]);

  const loadMaterials = async () => {
    try {
      const matList = await getRawMaterials();
      setMaterials(matList);

      if (matList.length > 0) {
        if (!selectedMaterialId || !matList.some((m) => m.id === selectedMaterialId)) {
          setSelectedMaterialId(matList[0].id);
          setUnitCost(matList[0].unitCost);
          setSupplierName(matList[0].supplier || '');
        }
      }
    } catch (e) {
      console.error('Error loading raw materials:', e);
    }
  };

  const handleMaterialChange = (matId: string) => {
    setSelectedMaterialId(matId);
    const mat = materials.find((m) => m.id === matId);
    if (mat) {
      setUnitCost(mat.unitCost);
      if (mat.supplier && !supplierName) {
        setSupplierName(mat.supplier);
      }
    }
  };

  const selectedMaterial = materials.find((m) => m.id === selectedMaterialId);
  const effectiveUnitCost = unitCost || (selectedMaterial ? selectedMaterial.unitCost : 0);
  const subtotal = (quantity || 0) * (effectiveUnitCost || 0);
  const gstAmount = includeGst ? subtotal * 0.18 : 0;
  const grandTotal = subtotal + gstAmount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (quantity <= 0) {
      setError('Please enter a valid purchase quantity greater than 0.');
      return;
    }

    if (effectiveUnitCost <= 0) {
      setError('Please enter a valid unit cost greater than 0.');
      return;
    }

    setLoading(true);
    try {
      let finalMaterialId = selectedMaterialId;
      let finalMaterialName = selectedMaterial ? selectedMaterial.name : '';
      let finalCategory: RawMaterialCategory = selectedMaterial ? selectedMaterial.category : 'granules';
      let finalUnit = selectedMaterial ? selectedMaterial.unit : 'kg';

      if (isInlineMaterial) {
        if (!newMaterialName || !newMaterialCode) {
          setError('Please enter the name and code for the new raw material.');
          setLoading(false);
          return;
        }

        const createdMaterial = await addRawMaterial({
          name: newMaterialName,
          code: newMaterialCode,
          category: newMaterialCategory,
          currentStock: 0, // Stock will be added by the purchase order if status is received
          minimumStock: 500,
          unit: newMaterialUnit,
          unitCost: effectiveUnitCost,
          supplier: supplierName || 'Direct Supplier'
        });

        finalMaterialId = createdMaterial.id;
        finalMaterialName = createdMaterial.name;
        finalCategory = createdMaterial.category;
        finalUnit = createdMaterial.unit;
      }

      await addPurchase({
        supplierName: supplierName || 'Standard Supplier',
        supplierPhone: supplierPhone || '',
        items: [
          {
            rawMaterialId: finalMaterialId,
            rawMaterialName: finalMaterialName,
            category: finalCategory,
            unit: finalUnit,
            unitCost: effectiveUnitCost,
            quantity,
            subtotal
          }
        ],
        subtotal,
        gstRate: includeGst ? 18 : 0,
        gstAmount,
        totalAmount: grandTotal,
        totalQuantity: quantity,
        status,
        purchaseDate,
        notes
      });

      if (onPurchaseCreated) onPurchaseCreated();
      onClose();
    } catch (err) {
      console.error('Failed to create purchase order:', err);
      setError('Failed to record purchase entry. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Record New Purchase Entry"
      subtitle="Enter raw material purchase details to track expenditure and update stock"
      maxWidth="2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2 font-medium">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Raw Material Selection */}
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Raw Material Item
            </label>
            <button
              type="button"
              onClick={() => setIsInlineMaterial(!isInlineMaterial)}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              {isInlineMaterial ? 'Select Existing Material' : 'Add New Material'}
            </button>
          </div>

          {!isInlineMaterial ? (
            <div>
              <select
                value={selectedMaterialId}
                onChange={(e) => handleMaterialChange(e.target.value)}
                className="w-full px-3 py-2 bg-white text-xs font-medium text-slate-800 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              >
                {materials.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.code}) — Current Stock: {m.currentStock.toLocaleString()} {m.unit}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Material Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Polypropylene White Granules"
                  value={newMaterialName}
                  onChange={(e) => setNewMaterialName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Code</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. PP-WHT-01"
                  value={newMaterialCode}
                  onChange={(e) => setNewMaterialCode(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Category</label>
                <select
                  value={newMaterialCategory}
                  onChange={(e) => setNewMaterialCategory(e.target.value as RawMaterialCategory)}
                  className="w-full px-3 py-2 text-xs bg-white rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="granules">Granules</option>
                  <option value="masterbatch">Masterbatch</option>
                  <option value="colour">Colour</option>
                  <option value="packaging">Packaging</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Purchase Quantities & Pricing */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Purchase Quantity ({selectedMaterial ? selectedMaterial.unit : newMaterialUnit})
            </label>
            <input
              type="number"
              min={1}
              required
              value={quantity}
              onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 bg-slate-50 text-xs font-medium text-slate-800 rounded-xl border border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Unit Cost (₹ / {selectedMaterial ? selectedMaterial.unit : newMaterialUnit})
            </label>
            <input
              type="number"
              min={0}
              step={0.01}
              required
              value={unitCost}
              onChange={(e) => setUnitCost(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 bg-slate-50 text-xs font-medium text-slate-800 rounded-xl border border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Purchase Date</label>
            <input
              type="date"
              required
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 text-xs font-medium text-slate-800 rounded-xl border border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
        </div>

        {/* Supplier & Receipt Status */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">Supplier Company Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Reliance Polymers Ltd"
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 text-xs font-medium text-slate-800 rounded-xl border border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Entry Delivery Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as PurchaseStatus)}
              className="w-full px-3 py-2 bg-slate-50 text-xs font-medium text-slate-800 rounded-xl border border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="received">Received (Adds to Stock Now)</option>
              <option value="pending">Pending Delivery (Order Placed)</option>
            </select>
          </div>
        </div>

        {/* Stock Addition Information Banner */}
        <div className="p-3 bg-blue-50/70 border border-blue-200 text-blue-800 text-xs rounded-xl flex items-start space-x-2 font-medium">
          <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Stock Maintenance Rule:</span>{' '}
            {status === 'received'
              ? 'Saving this purchase as Received will automatically add ' +
                quantity.toLocaleString() +
                ' ' +
                (selectedMaterial ? selectedMaterial.unit : newMaterialUnit) +
                ' to the Raw Materials inventory.'
              : 'This purchase will be saved as Pending. Stock will be added to Raw Materials inventory only when marked as Received later.'}
          </div>
        </div>

        {/* Total Cost Calculation Summary */}
        <div className="p-4 bg-slate-900 text-white rounded-2xl space-y-2">
          <div className="flex justify-between text-xs text-slate-400">
            <span>Material Subtotal:</span>
            <span>₹{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-slate-800">
            <label className="flex items-center space-x-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={includeGst}
                onChange={(e) => setIncludeGst(e.target.checked)}
                className="rounded text-blue-500 focus:ring-0"
              />
              <span>Apply Input GST (18%)</span>
            </label>
            <span className="text-xs text-slate-400">
              ₹{gstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>

          <div className="flex justify-between text-base font-bold text-white pt-2 border-t border-slate-800">
            <span>Grand Total Purchase Cost:</span>
            <span className="text-blue-400">
              ₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Purchase Notes (Optional)</label>
          <input
            type="text"
            placeholder="e.g. Invoice / Delivery Challan number, batch grade info..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 text-xs font-medium text-slate-800 rounded-xl border border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        {/* Form Actions */}
        <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-md shadow-blue-500/20 disabled:opacity-50 flex items-center space-x-2"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>{loading ? 'Recording Purchase...' : 'Save Purchase Entry'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
