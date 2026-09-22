import React, { useState, useEffect, useRef } from 'react';
import { Modal } from '../common/Modal';
import { RawMaterial, RawMaterialCategory, PurchaseItem, PurchaseStatus } from '../../types';
import { getRawMaterials, addRawMaterial, addPurchase } from '../../services/db';
import { ShoppingBag, Plus, AlertCircle, CheckCircle2, Search, ChevronDown, Check } from 'lucide-react';

interface NewPurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPurchaseCreated?: () => void;
}

interface DraftPurchaseItem {
  id: string;
  rawMaterialId: string;
  quantity: string;
  unitCost: string;
}

const createDraftItem = (rawMaterialId = ''): DraftPurchaseItem => ({
  id: `line-${Date.now()}-${Math.random()}`,
  rawMaterialId,
  quantity: '1000',
  unitCost: ''
});

interface SearchableMaterialSelectProps {
  value: string;
  materials: RawMaterial[];
  onChange: (materialId: string) => void;
  placeholder?: string;
}

const SearchableMaterialSelect: React.FC<SearchableMaterialSelectProps> = ({
  value,
  materials,
  onChange,
  placeholder = 'Select material'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedMaterial = materials.find((m) => m.id === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    } else {
      setSearchQuery('');
    }
  }, [isOpen]);

  const filteredMaterials = materials.filter((m) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      m.name.toLowerCase().includes(q) ||
      m.code.toLowerCase().includes(q) ||
      (m.category && m.category.toLowerCase().includes(q))
    );
  });

  const handleSelect = (materialId: string) => {
    onChange(materialId);
    setIsOpen(false);
    setSearchQuery('');
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full min-w-0 px-3 py-2.5 bg-slate-50 hover:bg-white text-xs text-left rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 flex items-center justify-between gap-2 transition-colors"
      >
        {selectedMaterial ? (
          <span className="font-semibold text-slate-800 truncate">
            {selectedMaterial.name} <span className="text-slate-400 font-normal">({selectedMaterial.code})</span>
          </span>
        ) : (
          <span className="text-slate-400 font-normal">{placeholder}</span>
        )}
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl p-2 space-y-2 min-w-[260px] animate-in fade-in duration-100">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name or code..."
              className="w-full pl-8 pr-7 py-1.5 text-xs bg-slate-50 rounded-lg border border-slate-200 outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs px-1"
              >
                ✕
              </button>
            )}
          </div>

          <div className="max-h-48 overflow-y-auto divide-y divide-slate-100">
            {filteredMaterials.length === 0 ? (
              <div className="p-3 text-center text-slate-400 text-xs font-medium">
                No materials found {searchQuery ? `matching "${searchQuery}"` : ''}
              </div>
            ) : (
              filteredMaterials.map((m) => {
                const isSelected = m.id === value;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => handleSelect(m.id)}
                    className={`w-full text-left px-2.5 py-2 hover:bg-blue-50/80 rounded-lg transition-colors flex items-center justify-between gap-2 group ${
                      isSelected ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-800'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium text-slate-900 group-hover:text-blue-700 truncate">{m.name}</div>
                      <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                        <span className="font-mono bg-slate-100 px-1 py-0.5 rounded text-[9px] text-slate-600">{m.code}</span>
                        <span>Stock: {m.currentStock.toLocaleString()} {m.unit}</span>
                      </div>
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export const NewPurchaseModal: React.FC<NewPurchaseModalProps> = ({
  isOpen,
  onClose,
  onPurchaseCreated
}) => {
  const [materials, setMaterials] = useState<RawMaterial[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [items, setItems] = useState<DraftPurchaseItem[]>([createDraftItem()]);
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
    } else {
      setItems([createDraftItem()]);
      setError('');
    }
  }, [isOpen]);

  const loadMaterials = async () => {
    try {
      const matList = await getRawMaterials();
      setMaterials(matList);
    } catch (e) {
      console.error('Error loading raw materials:', e);
    }
  };

  const updateItem = (id: string, updates: Partial<DraftPurchaseItem>) => {
    setItems((currentItems) => currentItems.map((item) => item.id === id ? { ...item, ...updates } : item));
  };

  const handleMaterialChange = (id: string, materialId: string) => {
    const material = materials.find((candidate) => candidate.id === materialId);
    updateItem(id, { rawMaterialId: materialId, unitCost: material ? String(material.unitCost) : '' });
    if (material?.supplier && !supplierName) setSupplierName(material.supplier);
  };

  const selectedMaterial = materials.find((m) => m.id === items[0]?.rawMaterialId);
  const purchaseItems = items.map((item): PurchaseItem => {
    const material = materials.find((candidate) => candidate.id === item.rawMaterialId);
    const quantity = Number(item.quantity) || 0;
    const unitCost = Number(item.unitCost) || 0;
    return {
      rawMaterialId: item.rawMaterialId,
      rawMaterialName: material?.name || '',
      hsnSac: material?.code || '',
      category: material?.category || 'granules',
      unit: material?.unit || newMaterialUnit,
      unitCost,
      quantity,
      subtotal: quantity * unitCost,
      taxRate: includeGst ? 18 : 0
    };
  });
  const subtotal = purchaseItems.reduce((sum, item) => sum + item.subtotal, 0);
  const gstAmount = includeGst ? subtotal * 0.18 : 0;
  const grandTotal = subtotal + gstAmount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (items.length === 0 || items.some((item) => !item.rawMaterialId)) {
      setError('Please select a material for every bill item.');
      return;
    }

    if (items.some((item) => Number(item.quantity) <= 0 || Number(item.unitCost) <= 0)) {
      setError('Please enter a valid quantity and unit cost for every item.');
      return;
    }

    setLoading(true);
    try {
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
          unitCost: Number(items[0]?.unitCost) || 0,
          supplier: supplierName || 'Direct Supplier'
        });
        setItems((currentItems) => currentItems.map((item, index) => index === 0 ? { ...item, rawMaterialId: createdMaterial.id } : item));
        purchaseItems[0] = {
          ...purchaseItems[0],
          rawMaterialId: createdMaterial.id,
          rawMaterialName: createdMaterial.name,
          category: createdMaterial.category,
          unit: createdMaterial.unit
        };
      }

      await addPurchase({
        supplierName: supplierName || 'Standard Supplier',
        supplierPhone: supplierPhone || '',
        items: purchaseItems,
        subtotal,
        gstRate: includeGst ? 18 : 0,
        gstAmount,
        totalAmount: grandTotal,
        totalQuantity: purchaseItems.reduce((sum, item) => sum + item.quantity, 0),
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
      maxWidth="4xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2 font-medium">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="p-4 bg-blue-50/60 rounded-2xl border border-blue-100 space-y-2">
          <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">Supplier Company Name</label>
          <input
            type="text"
            required
            list="purchase-suppliers"
            placeholder="Select existing supplier or enter a new supplier"
            value={supplierName}
            onChange={(e) => setSupplierName(e.target.value)}
            className="w-full px-3 py-2.5 bg-white text-xs font-semibold text-slate-800 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500/20"
          />
          <datalist id="purchase-suppliers">
            {Array.from(new Set(materials.map((material) => material.supplier).filter(Boolean))).map((supplier) => (
              <option key={supplier} value={supplier} />
            ))}
          </datalist>
          <p className="text-[11px] text-blue-700">This supplier will apply to every material item in this purchase bill.</p>
        </div>

        {/* Raw Material Selection */}
        <div className="p-4 sm:p-5 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Bill Line Items
              </label>
              <p className="text-[11px] text-slate-500 mt-1">Add each purchased material as a separate line.</p>
            </div>
            <button
              type="button"
              onClick={() => setItems((currentItems) => [...currentItems, createDraftItem()])}
              className="w-full sm:w-auto px-3 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 flex items-center justify-center gap-1.5 shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Item
            </button>
          </div>

          <div className="space-y-3">
            {items.map((item, index) => {
              const material = materials.find((candidate) => candidate.id === item.rawMaterialId);
              const line = purchaseItems[index];
              return (
                <div key={item.id} className="grid grid-cols-1 md:grid-cols-[minmax(220px,2fr)_minmax(120px,0.9fr)_minmax(150px,1fr)_minmax(155px,1fr)_auto] gap-x-3 gap-y-3 items-end p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
                  <div className="min-w-0">
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Product / Material {index + 1}</label>
                    <SearchableMaterialSelect
                      value={item.rawMaterialId}
                      materials={materials}
                      onChange={(materialId) => handleMaterialChange(item.id, materialId)}
                      placeholder="Select material"
                    />
                    <div className="text-[10px] text-slate-400 mt-1.5">{material ? `Stock: ${material.currentStock.toLocaleString()} ${material.unit}` : 'Select a raw material'}</div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Quantity</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      required
                      value={item.quantity}
                      onChange={(e) => updateItem(item.id, { quantity: e.target.value.replace(/[^\d.]/g, '') })}
                      className="w-full px-3 py-2.5 bg-slate-50 text-xs font-medium text-slate-800 rounded-xl border border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                    />
                    <div className="text-[10px] text-slate-400 mt-1.5">Unit: {material?.unit || newMaterialUnit}</div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Rate / Unit Cost</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      required
                      value={item.unitCost}
                      onChange={(e) => updateItem(item.id, { unitCost: e.target.value.replace(/[^\d.]/g, '') })}
                      className="w-full px-3 py-2.5 bg-slate-50 text-xs font-medium text-slate-800 rounded-xl border border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                  <div className="min-h-[42px] flex items-center rounded-xl bg-slate-50 px-3 text-xs font-semibold text-slate-700">
                    <span>Amount: ₹{(line?.subtotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <button
                    type="button"
                    disabled={items.length === 1}
                    onClick={() => setItems((currentItems) => currentItems.filter((candidate) => candidate.id !== item.id))}
                    className="w-full md:w-auto min-h-[42px] px-3 py-2 text-xs font-semibold text-rose-600 rounded-xl hover:bg-rose-50 disabled:opacity-40"
                  >
                    Remove
                  </button>
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => setIsInlineMaterial(!isInlineMaterial)}
            className="text-xs font-semibold text-slate-500 hover:text-blue-600"
          >
            {isInlineMaterial ? 'Use Existing Material' : '+ Add New Material'}
          </button>

          {isInlineMaterial && (
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

        {/* Purchase Date & Receipt Status */}
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Purchase Date</label>
              <input
                type="date"
                required
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                className="w-full px-3 py-2.5 bg-white text-xs font-medium text-slate-800 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Entry Delivery Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as PurchaseStatus)}
              className="w-full px-3 py-2.5 bg-white text-xs font-medium text-slate-800 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="received">Received (Adds to Stock Now)</option>
              <option value="pending">Pending Delivery (Order Placed)</option>
            </select>
            </div>
          </div>
        </div>

        {/* Stock Addition Information Banner */}
        <div className="p-3 bg-blue-50/70 border border-blue-200 text-blue-800 text-xs rounded-xl flex items-start gap-2 font-medium leading-5">
          <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Stock Maintenance Rule:</span>{' '}
            {status === 'received'
              ? 'Saving this purchase as Received will automatically add ' +
                purchaseItems.reduce((sum, item) => sum + item.quantity, 0).toLocaleString() +
                ' ' +
                ' across ' + purchaseItems.length + ' line item(s) to the Raw Materials inventory.'
              : 'This purchase will be saved as Pending. Stock will be added to Raw Materials inventory only when marked as Received later.'}
          </div>
        </div>

        {/* Total Cost Calculation Summary */}
        <div className="p-4 sm:p-5 bg-slate-900 text-white rounded-2xl space-y-3">
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span>Material Subtotal:</span>
            <span>₹{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>

          <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-800">
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

          <div className="flex justify-between items-center gap-3 text-base font-bold text-white pt-3 border-t border-slate-800">
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
