import React, { useState, useEffect, useRef } from 'react';
import { Modal } from '../common/Modal';
import { RawMaterial, RawMaterialCategory, PurchaseItem, PurchaseStatus, Supplier, PurchasedMaterial } from '../../types';
import { getRawMaterials, addRawMaterial, addPurchase, getSuppliers, getPurchasedMaterials } from '../../services/db';
import {
  toBaseQuantity,
  deriveMaterialBagSpecs,
  calculateBagPieceConversion,
  getReceivedPurchaseBaseQuantity
} from '../../utils/unitConversion';
import { cleanDecimalInput } from '../../utils/packetUtils';
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
  unit: string;
  unitCost: string;
  numberOfBags: string;
  weightPerBagKg: string;
  weightPerPieceGrams: string;
  wastage1Pieces: string;
  wastage2Pieces: string;
}

const createDraftItem = (rawMaterialId = '', quantity = '', unit = '', unitCost = ''): DraftPurchaseItem => ({
  id: `line-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
  rawMaterialId,
  quantity,
  unit,
  unitCost,
  numberOfBags: '',
  weightPerBagKg: '',
  weightPerPieceGrams: '',
  wastage1Pieces: '',
  wastage2Pieces: ''
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

interface SearchableSupplierSelectProps {
  value: string;
  suppliers: Supplier[];
  onChange: (supplierId: string) => void;
}

const supplierDisplayName = (supplier: Supplier): string => supplier.company?.trim() || supplier.name;

const SearchableSupplierSelect: React.FC<SearchableSupplierSelectProps> = ({ value, suppliers, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const selectedSupplier = suppliers.find((supplier) => supplier.id === value);

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

  const query = searchQuery.trim().toLowerCase();
  const filteredSuppliers = suppliers.filter((supplier) =>
    [supplier.company || '', supplier.name, supplier.phone || '']
      .some((valueToSearch) => valueToSearch.toLowerCase().includes(query))
  );

  const handleSelect = (supplierId: string) => {
    onChange(supplierId);
    setIsOpen(false);
    setSearchQuery('');
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
        className="w-full min-w-0 px-3 py-2.5 bg-white text-xs text-left rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 flex items-center justify-between gap-2"
      >
        {selectedSupplier ? (
          <span className="min-w-0 truncate font-semibold text-slate-800">
            {supplierDisplayName(selectedSupplier)}
            {selectedSupplier.company && selectedSupplier.name !== selectedSupplier.company && (
              <span className="font-normal text-slate-500"> · {selectedSupplier.name}</span>
            )}
          </span>
        ) : (
          <span className="text-slate-400">Select a saved supplier</span>
        )}
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl p-2 space-y-2 animate-in fade-in duration-100">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              ref={searchInputRef}
              type="text"
              aria-label="Search saved suppliers"
              role="combobox"
              aria-expanded="true"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search company, contact, or phone..."
              className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 rounded-lg border border-slate-200 outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          <div role="listbox" aria-label="Saved suppliers" className="max-h-48 overflow-y-auto divide-y divide-slate-100">
            {filteredSuppliers.length === 0 ? (
              <div className="p-3 text-center text-slate-400 text-xs font-medium">
                No saved suppliers match{query ? ` "${searchQuery}"` : ''}.
              </div>
            ) : filteredSuppliers.map((supplier) => {
              const isSelected = supplier.id === value;
              return (
                <button
                  key={supplier.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelect(supplier.id)}
                  className={`w-full text-left px-2.5 py-2 hover:bg-blue-50/80 rounded-lg transition-colors flex items-center justify-between gap-2 ${
                    isSelected ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-800'
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-medium text-slate-900">{supplierDisplayName(supplier)}</span>
                    {supplier.company && supplier.name !== supplier.company && (
                      <span className="block truncate text-[10px] text-slate-500">Contact: {supplier.name}</span>
                    )}
                  </span>
                  {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                </button>
              );
            })}
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
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [suppliersLoading, setSuppliersLoading] = useState(false);
  const [supplierLoadError, setSupplierLoadError] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const submissionInProgress = useRef(false);

  // Form state
  const [items, setItems] = useState<DraftPurchaseItem[]>([createDraftItem()]);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
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
  const [newMaterialBaseUnit, setNewMaterialBaseUnit] = useState('kg');
  const [newMaterialPurchaseUnit, setNewMaterialPurchaseUnit] = useState('kg');
  const [newMaterialConsumptionUnit, setNewMaterialConsumptionUnit] = useState('kg');
  const [newMaterialConversionFactor, setNewMaterialConversionFactor] = useState<number | string>(1);
  const [newMaterialPiecesPerBaseUnit, setNewMaterialPiecesPerBaseUnit] = useState<number | string>('');

  useEffect(() => {
    if (isOpen) {
      loadMaterials();
    } else {
      setItems([createDraftItem()]);
      setSelectedSupplierId('');
      setError('');
    }
  }, [isOpen]);

  const loadMaterials = async () => {
    setSuppliersLoading(true);
    setSupplierLoadError('');
    setSuppliers([]);
    setSelectedSupplierId('');
    const [rawMaterialsResult, purchasedMaterialsResult, suppliersResult] = await Promise.allSettled([
      getRawMaterials(),
      getPurchasedMaterials(),
      getSuppliers()
    ]);
    
    // Combine raw materials and purchased materials into a single list
    const allMaterials: RawMaterial[] = [];
    
    if (rawMaterialsResult.status === 'fulfilled') {
      allMaterials.push(...rawMaterialsResult.value);
    } else {
      console.error('Error loading raw materials:', rawMaterialsResult.reason);
    }
    
    if (purchasedMaterialsResult.status === 'fulfilled') {
      // Convert PurchasedMaterial to RawMaterial format for dropdown
      const purchasedAsRaw = purchasedMaterialsResult.value.map((pm): RawMaterial => ({
        id: pm.id,
        name: pm.materialName,
        code: pm.materialName, // Use material name as code/SKU if not available
        category: 'granules', // Default category for purchased materials
        currentStock: pm.totalPieces || 0, // Use pieces if available
        minimumStock: 0,
        unit: 'pcs',
        baseUnit: 'pcs',
        purchaseUnit: 'pcs',
        consumptionUnit: 'pcs',
        conversionFactor: 1,
        piecesPerBaseUnit: undefined,
        unitCost: 0,
        supplier: pm.supplier,
        status: 'healthy',
        lastRestocked: pm.createdAt
      }));
      
      // Merge with existing materials, avoiding duplicates by name
      const existingNames = new Set(allMaterials.map(m => m.name.toLowerCase()));
      purchasedAsRaw.forEach(pm => {
        if (!existingNames.has(pm.name.toLowerCase())) {
          allMaterials.push(pm);
        }
      });
    } else {
      console.error('Error loading purchased materials:', purchasedMaterialsResult.reason);
    }
    
    setMaterials(allMaterials);
    
    if (suppliersResult.status === 'fulfilled') {
      setSuppliers(suppliersResult.value);
    } else {
      console.error('Error loading saved suppliers:', suppliersResult.reason);
      setSupplierLoadError('Could not load saved suppliers. Check supplier-view access and try again.');
    }
    setSuppliersLoading(false);
  };

  const selectedSupplier = suppliers.find((supplier) => supplier.id === selectedSupplierId);
  const selectedSupplierName = selectedSupplier ? supplierDisplayName(selectedSupplier) : '';

  const isItemComplete = (item: DraftPurchaseItem, index?: number): boolean => {
    const isFirstItemWithInline = isInlineMaterial && (index === 0 || (index === undefined && item.id === items[0]?.id));
    if (!isFirstItemWithInline && !item.rawMaterialId) return false;
    const qty = Number(item.quantity);
    if (!item.quantity || isNaN(qty) || qty <= 0) return false;
    if (item.unitCost === '' || isNaN(Number(item.unitCost)) || Number(item.unitCost) < 0) return false;
    return true;
  };

  // Automatically append next empty line when last line is complete, and trim excess empty lines
  useEffect(() => {
    setItems((currentItems) => {
      if (currentItems.length === 0) {
        return [createDraftItem()];
      }

      const lastIndex = currentItems.length - 1;
      const lastItem = currentItems[lastIndex];
      const isLastComplete = isItemComplete(lastItem, lastIndex);

      // If last item is complete and has a selected material (or is the inline new material), append one blank row
      if (isLastComplete && (lastItem.rawMaterialId || (isInlineMaterial && lastIndex === 0))) {
        return [...currentItems, createDraftItem()];
      }

      // If there are multiple trailing blank rows, trim to exactly one
      if (currentItems.length >= 2) {
        const secondLastIndex = currentItems.length - 2;
        const secondLast = currentItems[secondLastIndex];
        const isLastBlank = !lastItem.rawMaterialId && !lastItem.quantity && !lastItem.unitCost && !lastItem.numberOfBags;
        const isSecondLastIncomplete = !isItemComplete(secondLast, secondLastIndex);
        if (isSecondLastIncomplete && isLastBlank) {
          return currentItems.slice(0, -1);
        }
      }

      return currentItems;
    });
  }, [items, isInlineMaterial]);

  const updateItem = (id: string, updates: Partial<DraftPurchaseItem>) => {
    setItems((currentItems) => currentItems.map((item) => item.id === id ? { ...item, ...updates } : item));
  };

  const updateBagConversion = (id: string, field: 'numberOfBags' | 'weightPerBagKg' | 'weightPerPieceGrams', value: string) => {
    setItems((currentItems) => currentItems.map((item) => {
      if (item.id !== id) return item;
      const next = { ...item, [field]: value };
      const unit = (item.unit || '').toLowerCase();
      if (field === 'numberOfBags' && (unit === 'bag' || unit === 'bags' || !item.quantity || item.quantity === item.numberOfBags)) {
        next.quantity = value;
      }
      return next;
    }));
  };

  const removeItem = (id: string) => {
    setItems((currentItems) => {
      const filtered = currentItems.filter((candidate) => candidate.id !== id);
      if (filtered.length === 0) {
        return [createDraftItem()];
      }
      return filtered;
    });
  };

  const handleMaterialChange = (id: string, materialId: string) => {
    const material = materials.find((candidate) => candidate.id === materialId);
    const specs = material ? deriveMaterialBagSpecs(material) : {};
    updateItem(id, {
      rawMaterialId: materialId,
      unit: material?.purchaseUnit || material?.unit || '',
      unitCost: material ? String(material.unitCost) : '',
      numberOfBags: '',
      weightPerBagKg: specs.weightPerBagKg ? String(specs.weightPerBagKg) : '',
      weightPerPieceGrams: specs.weightPerPieceGrams ? String(specs.weightPerPieceGrams) : ''
    });
    if (material?.supplier && !selectedSupplier) {
      const materialSupplier = material.supplier.trim().toLowerCase();
      const matchingSupplier = suppliers.find((supplier) =>
        supplierDisplayName(supplier).trim().toLowerCase() === materialSupplier ||
        supplier.name.trim().toLowerCase() === materialSupplier
      );
      if (matchingSupplier) setSelectedSupplierId(matchingSupplier.id);
    }
  };

  const toPurchaseItem = (item: DraftPurchaseItem, index: number, useInlineName: boolean): PurchaseItem => {
    const isFirstItemWithInline = isInlineMaterial && (index === 0 || item.id === items[0]?.id);
    const material = materials.find((candidate) => candidate.id === item.rawMaterialId);
    const quantity = Number(item.quantity) || 0;
    const unitCost = Number(item.unitCost) || 0;
    const conversion = Number(item.numberOfBags) > 0
      ? calculateBagPieceConversion({
          numberOfBags: Number(item.numberOfBags),
          weightPerBagKg: Number(item.weightPerBagKg),
          weightPerPieceGrams: Number(item.weightPerPieceGrams)
        })
      : null;
    const conversionFields = conversion && !('error' in conversion)
      ? {
          numberOfBags: Number(item.numberOfBags),
          weightPerBagKg: Number(item.weightPerBagKg),
          weightPerPieceGrams: Number(item.weightPerPieceGrams),
          totalWeightGrams: conversion.totalWeightGrams,
          calculatedPieces: conversion.calculatedPieces
        }
      : {};
    const wastage1Pieces = Number(item.wastage1Pieces) || 0;
    const wastage2Pieces = Number(item.wastage2Pieces) || 0;
    const totalWastage = wastage1Pieces + wastage2Pieces;
    const netAvailablePieces = conversion && !('error' in conversion)
      ? Math.max(0, conversion.calculatedPieces - totalWastage)
      : undefined;
    return {
      rawMaterialId: useInlineName && isFirstItemWithInline ? '' : item.rawMaterialId,
      rawMaterialName: isFirstItemWithInline ? (newMaterialName.trim() || 'New Raw Material') : (material?.name || ''),
      hsnSac: isFirstItemWithInline ? newMaterialCode.trim() : (material?.code || ''),
      category: isFirstItemWithInline ? newMaterialCategory : (material?.category || 'granules'),
      unit: item.unit || (isFirstItemWithInline ? newMaterialPurchaseUnit : material?.purchaseUnit) || material?.unit || newMaterialUnit,
      unitCost,
      quantity,
      subtotal: quantity * unitCost,
      taxRate: includeGst ? 18 : 0,
      ...conversionFields,
      wastage1Pieces: wastage1Pieces > 0 ? wastage1Pieces : undefined,
      wastage2Pieces: wastage2Pieces > 0 ? wastage2Pieces : undefined,
      netAvailablePieces
    };
  };

  const validPurchaseItems = items
    .filter((item, index) => isItemComplete(item, index))
    .map((item, index): PurchaseItem => toPurchaseItem(item, index, true));
  const subtotal = validPurchaseItems.reduce((sum, item) => sum + item.subtotal, 0);
  const gstAmount = includeGst ? subtotal * 0.18 : 0;
  const grandTotal = subtotal + gstAmount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submissionInProgress.current) return;
    setError('');

    const nonBlankItems = items.filter((item, index) => {
      const isFirstItemWithInline = isInlineMaterial && (index === 0 || item.id === items[0]?.id);
      if (isFirstItemWithInline) {
        return item.quantity !== '' || item.unitCost !== '' || item.numberOfBags !== '' || newMaterialName.trim() !== '' || newMaterialCode.trim() !== '';
      }
      return item.rawMaterialId || item.quantity !== '' || item.unitCost !== '' || item.numberOfBags !== '';
    });

    if (nonBlankItems.length === 0) {
      setError('Please add at least one complete purchase line item.');
      return;
    }

    if (isInlineMaterial && (!newMaterialName.trim() || !newMaterialCode.trim())) {
      setError('Please enter the name and code for the new raw material.');
      return;
    }

    const invalidItem = nonBlankItems.find((item) => {
      const itemIndex = items.findIndex((i) => i.id === item.id);
      return !isItemComplete(item, itemIndex);
    });
    if (invalidItem) {
      setError('Please enter a valid material, quantity (> 0), and rate (>= 0) for all started line items.');
      return;
    }

    const invalidConversion = nonBlankItems.find((item) => {
      if (!item.numberOfBags.trim()) return false;
      const conversion = calculateBagPieceConversion({
        numberOfBags: Number(item.numberOfBags),
        weightPerBagKg: Number(item.weightPerBagKg),
        weightPerPieceGrams: Number(item.weightPerPieceGrams)
      });
      return 'error' in conversion;
    });
    if (invalidConversion) {
      const conversion = calculateBagPieceConversion({
        numberOfBags: Number(invalidConversion.numberOfBags),
        weightPerBagKg: Number(invalidConversion.weightPerBagKg),
        weightPerPieceGrams: Number(invalidConversion.weightPerPieceGrams)
      });
      setError('error' in conversion ? conversion.error : 'Enter number of bags, weight per bag (kg), and weight per piece (g).');
      return;
    }

    // Validate wastage doesn't exceed calculated pieces
    const invalidWastage = nonBlankItems.find((item) => {
      if (!item.numberOfBags.trim()) return false;
      const conversion = calculateBagPieceConversion({
        numberOfBags: Number(item.numberOfBags),
        weightPerBagKg: Number(item.weightPerBagKg),
        weightPerPieceGrams: Number(item.weightPerPieceGrams)
      });
      if ('error' in conversion) return false;
      const totalWastage = (Number(item.wastage1Pieces) || 0) + (Number(item.wastage2Pieces) || 0);
      return totalWastage > conversion.calculatedPieces;
    });
    if (invalidWastage) {
      const conversion = calculateBagPieceConversion({
        numberOfBags: Number(invalidWastage.numberOfBags),
        weightPerBagKg: Number(invalidWastage.weightPerBagKg),
        weightPerPieceGrams: Number(invalidWastage.weightPerPieceGrams)
      });
      if ('error' in conversion) {
        setError(conversion.error);
        return;
      }
      const totalWastage = (Number(invalidWastage.wastage1Pieces) || 0) + (Number(invalidWastage.wastage2Pieces) || 0);
      setError(`Total wastage (${totalWastage} pieces) cannot exceed calculated pieces (${conversion.calculatedPieces.toLocaleString()}).`);
      return;
    }
    if (!selectedSupplier) {
      setError(suppliers.length === 0
        ? 'No saved suppliers are available. Add a supplier before recording a purchase.'
        : 'Select a supplier from the saved supplier records.');
      return;
    }

    const completedPurchaseItems = nonBlankItems.map((item, index): PurchaseItem => {
      const mapped = toPurchaseItem(item, index, false);
      return { ...mapped, rawMaterialId: item.rawMaterialId };
    });

    submissionInProgress.current = true;
    setLoading(true);
    try {
      if (isInlineMaterial) {
        const createdMaterial = await addRawMaterial({
          name: newMaterialName.trim(),
          code: newMaterialCode.trim(),
          category: newMaterialCategory,
          currentStock: 0, // Stock will be added by the purchase order if status is received
          minimumStock: 500,
          unit: newMaterialPurchaseUnit || newMaterialBaseUnit || 'kg',
          baseUnit: newMaterialBaseUnit,
          purchaseUnit: newMaterialPurchaseUnit,
          consumptionUnit: newMaterialConsumptionUnit,
          conversionFactor: Number(newMaterialConversionFactor) || 1,
          piecesPerBaseUnit: newMaterialPiecesPerBaseUnit !== '' ? Number(newMaterialPiecesPerBaseUnit) : undefined,
          unitCost: Number(completedPurchaseItems[0]?.unitCost) || 0,
          supplier: selectedSupplierName
        });
        setItems((currentItems) => currentItems.map((item, index) => index === 0 ? { ...item, rawMaterialId: createdMaterial.id } : item));
        completedPurchaseItems[0] = {
          ...completedPurchaseItems[0],
          rawMaterialId: createdMaterial.id,
          rawMaterialName: createdMaterial.name,
          category: createdMaterial.category,
          unit: createdMaterial.purchaseUnit
        };
      }

      const purchaseSubtotal = completedPurchaseItems.reduce((sum, item) => sum + item.subtotal, 0);
      const purchaseGstAmount = includeGst ? purchaseSubtotal * 0.18 : 0;
      const purchaseGrandTotal = purchaseSubtotal + purchaseGstAmount;

      await addPurchase({
        supplierId: selectedSupplier.id,
        supplierName: selectedSupplierName,
        supplierPhone: selectedSupplier.phone || '',
        items: completedPurchaseItems,
        subtotal: purchaseSubtotal,
        gstRate: includeGst ? 18 : 0,
        gstAmount: purchaseGstAmount,
        totalAmount: purchaseGrandTotal,
        totalQuantity: completedPurchaseItems.reduce((sum, item) => sum + item.quantity, 0),
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
      submissionInProgress.current = false;
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
          {suppliersLoading ? (
            <div className="w-full px-3 py-2.5 bg-white text-xs text-slate-500 rounded-xl border border-slate-200">Loading saved suppliers...</div>
          ) : supplierLoadError ? (
            <div className="rounded-xl border border-rose-200 bg-white p-3 text-xs text-rose-700">{supplierLoadError}</div>
          ) : suppliers.length === 0 ? (
            <div className="rounded-xl border border-amber-200 bg-white p-3 text-xs text-amber-800">
              No suppliers are saved yet. Add a supplier in Supplier Management before recording a purchase.
            </div>
          ) : (
            <SearchableSupplierSelect
              value={selectedSupplierId}
              suppliers={suppliers}
              onChange={setSelectedSupplierId}
            />
          )}
          <p className="text-[11px] text-blue-700">This supplier will apply to every material item in this purchase bill.</p>
        </div>

        {/* Raw Material Selection */}
        <div className="p-4 sm:p-5 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Bill Line Items
            </label>
            <p className="text-[11px] text-slate-500 mt-1">Add each purchased material as a separate line.</p>
          </div>

          <div className="space-y-3">
            {items.map((item, index) => {
              const material = materials.find((candidate) => candidate.id === item.rawMaterialId);
              const isFirstItemWithInline = isInlineMaterial && (index === 0 || item.id === items[0]?.id);
              const lineQty = Number(item.quantity) || 0;
              const lineCost = Number(item.unitCost) || 0;
              const lineSubtotal = lineQty * lineCost;
              const isOnlyBlankRow = items.length === 1 && !item.rawMaterialId && !item.quantity && !item.unitCost && !item.numberOfBags;
              const bagConversion = Number(item.numberOfBags) > 0
                ? calculateBagPieceConversion({
                    numberOfBags: Number(item.numberOfBags),
                    weightPerBagKg: Number(item.weightPerBagKg),
                    weightPerPieceGrams: Number(item.weightPerPieceGrams)
                  })
                : null;
              const inlineMaterialForStock: RawMaterial = {
                id: '',
                name: newMaterialName,
                code: newMaterialCode,
                category: newMaterialCategory,
                currentStock: 0,
                minimumStock: 0,
                unit: newMaterialUnit,
                baseUnit: newMaterialBaseUnit,
                purchaseUnit: newMaterialPurchaseUnit,
                consumptionUnit: newMaterialConsumptionUnit,
                conversionFactor: Number(newMaterialConversionFactor) || 1,
                piecesPerBaseUnit: newMaterialPiecesPerBaseUnit !== '' ? Number(newMaterialPiecesPerBaseUnit) : undefined,
                unitCost: 0,
                supplier: '',
                status: 'healthy',
                lastRestocked: ''
              };
              const stockMaterial = isFirstItemWithInline ? inlineMaterialForStock : material;
              const previewPurchaseItem = toPurchaseItem(item, index, false);
              const stockAddition = stockMaterial
                ? getReceivedPurchaseBaseQuantity(previewPurchaseItem, stockMaterial)
                : toBaseQuantity(lineQty, item.unit, inlineMaterialForStock);

              return (
                <div key={item.id} className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-[minmax(220px,2fr)_minmax(120px,0.9fr)_minmax(110px,0.8fr)_minmax(150px,1fr)_minmax(155px,1fr)_auto] gap-x-3 gap-y-3 items-end">
                  <div className="min-w-0">
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Product / Material {index + 1}</label>
                    {isFirstItemWithInline ? (
                      <div className="w-full min-w-0 px-3 py-2.5 bg-blue-50/80 text-xs rounded-xl border border-blue-200 flex items-center justify-between gap-2">
                        <span className="font-semibold text-blue-900 truncate">
                          ✨ {newMaterialName.trim() || 'New Material (Enter below)'}
                          {newMaterialCode.trim() && <span className="text-blue-500 font-normal ml-1">({newMaterialCode.trim()})</span>}
                        </span>
                        <span className="text-[10px] uppercase font-bold bg-blue-200 text-blue-800 px-1.5 py-0.5 rounded shrink-0">New</span>
                      </div>
                    ) : (
                      <SearchableMaterialSelect
                        value={item.rawMaterialId}
                        materials={materials}
                        onChange={(materialId) => handleMaterialChange(item.id, materialId)}
                        placeholder="Select material"
                      />
                    )}
                    <div className="text-[10px] text-slate-400 mt-1.5">
                      {isFirstItemWithInline
                        ? 'New material defined in the section below'
                        : material ? `Stock: ${material.currentStock.toLocaleString()} ${material.unit}` : 'Select a raw material'}
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Quantity</label>
                    <input
                      type="text"
                      aria-label={`Quantity for purchase item ${index + 1}`}
                      inputMode="decimal"
                      value={item.quantity}
                      onChange={(e) => updateItem(item.id, { quantity: cleanDecimalInput(e.target.value) })}
                      className="w-full px-3 py-2.5 bg-slate-50 text-xs font-medium text-slate-800 rounded-xl border border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                    />
                    <div className="text-[10px] text-slate-400 mt-1.5">
                      Unit: {item.unit || (isFirstItemWithInline ? newMaterialPurchaseUnit : material?.purchaseUnit) || material?.unit || newMaterialUnit}
                      {isFirstItemWithInline && newMaterialPurchaseUnit.toLowerCase() !== newMaterialBaseUnit.toLowerCase() && (
                        <span className="ml-1 text-blue-600">
                          (1 {newMaterialPurchaseUnit} = {newMaterialConversionFactor} {newMaterialBaseUnit})
                        </span>
                      )}
                      {!isFirstItemWithInline && material && item.unit && item.unit.toLowerCase() === material.purchaseUnit.toLowerCase() &&
                        material.purchaseUnit.toLowerCase() !== material.baseUnit.toLowerCase() && (
                        <span className="ml-1 text-blue-600">
                          (1 {material.purchaseUnit} = {material.conversionFactor} {material.baseUnit})
                        </span>
                      )}
                      {!isFirstItemWithInline && material && item.unit?.toLowerCase() === 'pcs' &&
                        material.baseUnit.toLowerCase() !== 'pcs' &&
                        material.piecesPerBaseUnit && material.piecesPerBaseUnit > 0 && (
                        <span className="ml-1 text-blue-600">
                          (1 pcs = {(1 / material.piecesPerBaseUnit).toLocaleString('en-IN')} {material.baseUnit})
                        </span>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Purchase Unit</label>
                    <select
                      value={item.unit || (isFirstItemWithInline ? newMaterialPurchaseUnit : material?.purchaseUnit) || material?.unit || ''}
                      onChange={(e) => updateItem(item.id, { unit: e.target.value })}
                      disabled={!material && !isFirstItemWithInline}
                      className="w-full px-3 py-2.5 bg-slate-50 text-xs font-medium text-slate-800 rounded-xl border border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500/20 disabled:opacity-60"
                    >
                      {isFirstItemWithInline ? (
                        Array.from(new Set([
                          newMaterialPurchaseUnit,
                          newMaterialBaseUnit,
                          newMaterialConsumptionUnit,
                          newMaterialPiecesPerBaseUnit ? 'pcs' : ''
                        ].filter(Boolean))).map((unit) => (
                          <option key={unit} value={unit}>{unit}</option>
                        ))
                      ) : material ? (
                        Array.from(new Set([
                          material.purchaseUnit,
                          material.baseUnit,
                          material.consumptionUnit,
                          material.piecesPerBaseUnit ? 'pcs' : ''
                        ].filter(Boolean))).map((unit) => (
                          <option key={unit} value={unit}>{unit}</option>
                        ))
                      ) : null}
                    </select>
                    {(isFirstItemWithInline || (material && item.unit)) && (item.quantity || item.numberOfBags) && (
                      <div className="text-[10px] text-slate-500 mt-1.5">
                        Stock addition: {stockAddition.toLocaleString('en-IN', { maximumFractionDigits: 3 })} {stockMaterial?.baseUnit || item.unit}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Rate / Unit Cost</label>
                    <input
                      type="text"
                      aria-label={`Rate for purchase item ${index + 1}`}
                      inputMode="decimal"
                      value={item.unitCost}
                      onChange={(e) => updateItem(item.id, { unitCost: cleanDecimalInput(e.target.value) })}
                      className="w-full px-3 py-2.5 bg-slate-50 text-xs font-medium text-slate-800 rounded-xl border border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                  <div className="min-h-[42px] flex items-center rounded-xl bg-slate-50 px-3 text-xs font-semibold text-slate-700">
                    <span>Amount: ₹{lineSubtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <button
                    type="button"
                    disabled={isOnlyBlankRow}
                    onClick={() => removeItem(item.id)}
                    className="w-full md:w-auto min-h-[42px] px-3 py-2 text-xs font-semibold text-rose-600 rounded-xl hover:bg-rose-50 disabled:opacity-40"
                  >
                    Remove
                  </button>
                </div>
                {(item.rawMaterialId || isFirstItemWithInline) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-3 border-t border-slate-100">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Number of bags</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        aria-label={`Number of bags for purchase item ${index + 1}`}
                        value={item.numberOfBags}
                        onChange={(e) => updateBagConversion(item.id, 'numberOfBags', cleanDecimalInput(e.target.value))}
                        className="w-full px-3 py-2.5 bg-slate-50 text-xs font-medium text-slate-800 rounded-xl border border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Weight per bag (kg)</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        aria-label={`Weight per bag for purchase item ${index + 1}`}
                        value={item.weightPerBagKg}
                        onChange={(e) => updateBagConversion(item.id, 'weightPerBagKg', cleanDecimalInput(e.target.value))}
                        className="w-full px-3 py-2.5 bg-slate-50 text-xs font-medium text-slate-800 rounded-xl border border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Weight per piece (g)</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        aria-label={`Weight per piece for purchase item ${index + 1}`}
                        value={item.weightPerPieceGrams}
                        onChange={(e) => updateBagConversion(item.id, 'weightPerPieceGrams', cleanDecimalInput(e.target.value))}
                        className="w-full px-3 py-2.5 bg-slate-50 text-xs font-medium text-slate-800 rounded-xl border border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>
                    <div className="rounded-xl bg-slate-50 px-3 py-2.5">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Total weight</div>
                      <div className="text-sm font-bold text-slate-900 mt-0.5">
                        {bagConversion && !('error' in bagConversion)
                          ? `${(bagConversion.totalWeightGrams / 1000).toLocaleString('en-IN', { maximumFractionDigits: 2 })} kg`
                          : '—'}
                      </div>
                      {bagConversion && !('error' in bagConversion) && (
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          {bagConversion.totalWeightGrams.toLocaleString('en-IN')} g
                        </div>
                      )}
                    </div>
                    <div className="rounded-xl bg-blue-50 px-3 py-2.5">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-blue-700">Calculated pieces</div>
                      <div className="text-sm font-bold text-blue-800 mt-0.5">
                        {bagConversion && !('error' in bagConversion)
                          ? bagConversion.calculatedPieces.toLocaleString('en-IN')
                          : '—'}
                      </div>
                      {bagConversion && 'error' in bagConversion && Number(item.numberOfBags) > 0 && (
                        <div className="text-[10px] text-rose-600 mt-1">{bagConversion.error}</div>
                      )}
                    </div>
                  </div>
                )}
                {/* Wastage Section - Only show when pieces are calculated */}
                {bagConversion && !('error' in bagConversion) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t border-slate-100">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Wastage 1 (pieces)</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        aria-label={`Wastage 1 for purchase item ${index + 1}`}
                        value={item.wastage1Pieces}
                        onChange={(e) => updateItem(item.id, { wastage1Pieces: e.target.value.replace(/\D/g, '') })}
                        className="w-full px-3 py-2.5 bg-slate-50 text-xs font-medium text-slate-800 rounded-xl border border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Wastage 2 (pieces)</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        aria-label={`Wastage 2 for purchase item ${index + 1}`}
                        value={item.wastage2Pieces}
                        onChange={(e) => updateItem(item.id, { wastage2Pieces: e.target.value.replace(/\D/g, '') })}
                        className="w-full px-3 py-2.5 bg-slate-50 text-xs font-medium text-slate-800 rounded-xl border border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                        placeholder="0"
                      />
                    </div>
                    <div className="rounded-xl bg-amber-50 px-3 py-2.5">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-amber-700">Total wastage</div>
                      <div className="text-sm font-bold text-amber-800 mt-0.5">
                        {(Number(item.wastage1Pieces) || 0) + (Number(item.wastage2Pieces) || 0)} pcs
                      </div>
                    </div>
                    <div className="rounded-xl bg-emerald-50 px-3 py-2.5">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700">Net available</div>
                      <div className="text-sm font-bold text-emerald-800 mt-0.5">
                        {Math.max(0, bagConversion.calculatedPieces - (Number(item.wastage1Pieces) || 0) - (Number(item.wastage2Pieces) || 0)).toLocaleString('en-IN')} pcs
                      </div>
                    </div>
                  </div>
                )}
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => {
              const nextState = !isInlineMaterial;
              setIsInlineMaterial(nextState);
              if (nextState && items[0]) {
                updateItem(items[0].id, { unit: newMaterialPurchaseUnit });
              }
            }}
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
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Base Unit</label>
                <select
                  value={newMaterialBaseUnit}
                  onChange={(e) => setNewMaterialBaseUnit(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="kg">kg</option>
                  <option value="g">g</option>
                  <option value="pcs">pcs</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Purchase Unit</label>
                <select
                  value={newMaterialPurchaseUnit}
                  onChange={(e) => {
                    setNewMaterialPurchaseUnit(e.target.value);
                    if (isInlineMaterial && items[0]) {
                      updateItem(items[0].id, { unit: e.target.value });
                    }
                  }}
                  className="w-full px-3 py-2 text-xs bg-white rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="kg">kg</option>
                  <option value="g">g</option>
                  <option value="pcs">pcs</option>
                  <option value="Bag">Bag</option>
                  <option value="Carton">Carton</option>
                  <option value="Packet">Packet</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Consumption Unit</label>
                <select
                  value={newMaterialConsumptionUnit}
                  onChange={(e) => setNewMaterialConsumptionUnit(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="kg">kg</option>
                  <option value="g">g</option>
                  <option value="pcs">pcs</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Conversion Factor</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={newMaterialConversionFactor}
                  onChange={(e) => setNewMaterialConversionFactor(cleanDecimalInput(e.target.value))}
                  className="w-full px-3 py-2 text-xs bg-white rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Pieces per {newMaterialBaseUnit}</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={newMaterialPiecesPerBaseUnit}
                  onChange={(e) => setNewMaterialPiecesPerBaseUnit(cleanDecimalInput(e.target.value))}
                  className="w-full px-3 py-2 text-xs bg-white rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500/20"
                />
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
              aria-label="Entry Delivery Status"
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
              ?               'Saving this purchase as Received will convert each line into its material base unit and add the result across ' +
              validPurchaseItems.length + ' line item(s) to the Raw Materials inventory.'
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
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 text-xs font-medium text-slate-800 rounded-xl border border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2 font-medium">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

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
