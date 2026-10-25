import React, { useEffect, useState, useRef } from 'react';
import { Modal } from '../common/Modal';
import { Product, ProductType, RawMaterial } from '../../types';
import {
  addFinishedGoodsLog,
  getProducts,
  getRawMaterials,
  recordRawMaterialUsage
} from '../../services/db';
import {
  calculateEquivalentPieces,
  formatQuantityWithUnit,
  fromBaseQuantity,
  getStockInBothUnits,
  toBaseQuantity
} from '../../utils/unitConversion';
import { calculateNetProductionQuantity } from '../../utils/productionUtils';
import { addCustomProductType, getAllProductTypes, normalizeProductType } from '../../utils/productTypeUtils';
import { formatDateForDisplay, formatDateForInput, parseProductionDate } from '../../utils/dateUtils';
import { AlertCircle, Boxes, Plus, Calendar } from 'lucide-react';

interface AddFinishedGoodsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStockAdded?: () => void;
}

export const AddFinishedGoodsModal: React.FC<AddFinishedGoodsModalProps> = ({
  isOpen,
  onClose,
  onStockAdded
}) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [materials, setMaterials] = useState<RawMaterial[]>([]);
  const [productType, setProductType] = useState<ProductType>('bottle');
  const [customProductType, setCustomProductType] = useState('');
  const [isCustomType, setIsCustomType] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedMaterialId, setSelectedMaterialId] = useState('');
  const [quantityProduced, setQuantityProduced] = useState('');
  const [materialUnit, setMaterialUnit] = useState('');
  const [wastage1, setWastage1] = useState('');
  const [wastage2, setWastage2] = useState('');
  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const submissionInProgress = useRef(false);

  // Get all available product types (standard + custom + from products)
  const availableProductTypes = getAllProductTypes(products);

  useEffect(() => {
    if (isOpen) {
      setQuantityProduced('');
      setWastage1('');
      setWastage2('');
      setDate('');
      setNotes('');
      setCustomProductType('');
      setIsCustomType(false);
      setProductType('bottle');
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    try {
      const [productList, materialList] = await Promise.all([getProducts(), getRawMaterials()]);
      setProducts(productList);
      setMaterials(materialList);

      const filteredProducts = productList.filter((product) => product.type === productType);
      if (filteredProducts.length > 0) setSelectedProductId(filteredProducts[0].id);
      if (materialList.length > 0) {
        setSelectedMaterialId(materialList[0].id);
        setMaterialUnit(materialList[0].consumptionUnit || materialList[0].baseUnit || materialList[0].unit);
      }
    } catch (e) {
      console.error(e);
      setError('Failed to load production materials.');
    }
  };

  const handleTypeChange = (type: ProductType) => {
    setProductType(type);
    setIsCustomType(false);
    setCustomProductType('');
    const filtered = products.filter((product) => product.type === type);
    setSelectedProductId(filtered[0]?.id || '');
  };

  const handleCustomTypeChange = (value: string) => {
    setCustomProductType(value);
    setIsCustomType(value !== 'bottle' && value !== 'cap' && value !== 'inner');
    if (value) {
      const normalizedType = normalizeProductType(value);
      setProductType(normalizedType);
      const filtered = products.filter((product) => product.type === normalizedType);
      setSelectedProductId(filtered[0]?.id || '');
    }
  };

  const handleMaterialChange = (materialId: string) => {
    setSelectedMaterialId(materialId);
    const material = materials.find((item) => item.id === materialId);
    if (material) {
      setMaterialUnit(material.consumptionUnit || material.baseUnit || material.unit);
    }
  };

  const filteredProducts = products.filter((product) => product.type === productType);
  const selectedProduct = products.find((product) => product.id === selectedProductId);
  const selectedMaterial = materials.find((material) => material.id === selectedMaterialId);
  const materialStock = selectedMaterial ? getStockInBothUnits(selectedMaterial) : null;
  const parsedQuantityProduced = Number(quantityProduced) || 0;
  const wastage1Number = Number(wastage1) || 0;
  const wastage2Number = Number(wastage2) || 0;
  // Wastage is piece counts
  const wastage1Quantity = wastage1Number;
  const wastage2Quantity = wastage2Number;
  // Calculate net production pieces
  const netPieces = parsedQuantityProduced - wastage1Number - wastage2Number;
  // Convert quantity to material's base unit for stock deduction
  const materialBaseQuantity = selectedMaterial && parsedQuantityProduced > 0
    ? toBaseQuantity(parsedQuantityProduced, selectedProduct?.unit || 'pcs', selectedMaterial)
    : 0;
  const materialQuantity = selectedMaterial
    ? fromBaseQuantity(materialBaseQuantity, materialUnit, selectedMaterial)
    : 0;
  const equivalentPieces = selectedMaterial && materialBaseQuantity > 0
    ? calculateEquivalentPieces(materialBaseQuantity, selectedMaterial)
    : undefined;

  const getMaterialUnits = (material: RawMaterial) =>
    Array.from(new Set([material.baseUnit, material.consumptionUnit, material.purchaseUnit].filter(Boolean)));

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submissionInProgress.current) return;
    const productionDate = parseProductionDate(date);
    if (!productionDate) {
      setError('Enter a valid production date in DD-MM-YYYY format.');
      return;
    }
    if (isCustomType && !customProductType.trim()) {
      setError('Please enter a valid product type.');
      return;
    }
    if (!selectedProduct) {
      setError('Please select a product.');
      return;
    }

    // Save custom product type to localStorage if it's new
    if (isCustomType && customProductType.trim()) {
      addCustomProductType(customProductType.trim());
    }
    const parsedQuantity = Number(quantityProduced);
    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      setError('Quantity produced must be greater than 0.');
      return;
    }
    if (!selectedMaterial) {
      setError('Please select the raw material used for this production.');
      return;
    }
    if (wastage1Number < 0 || wastage2Number < 0) {
      setError('Wastage values cannot be negative.');
      return;
    }
    if (wastage1Number > 0 && !Number.isInteger(wastage1Number)) {
      setError('Wastage 1 must be a whole number (pieces).');
      return;
    }
    if (wastage2Number > 0 && !Number.isInteger(wastage2Number)) {
      setError('Wastage 2 must be a whole number (pieces).');
      return;
    }
    // Validate that net pieces is not negative
    if (netPieces < 0) {
      setError(`Wastage (${wastage1Number + wastage2Number} pieces) cannot exceed total production (${parsedQuantity.toLocaleString('en-IN', { maximumFractionDigits: 0 })} pieces).`);
      return;
    }
    if (materialBaseQuantity > selectedMaterial.currentStock) {
      setError(`Insufficient stock. Available: ${formatQuantityWithUnit(materialStock?.baseQuantity, materialStock?.baseUnit)}.`);
      return;
    }

    submissionInProgress.current = true;
    setLoading(true);
    setError('');
    try {
      const batch = notes.trim() || `PROD-${productionDate}`;
      await recordRawMaterialUsage({
        materialId: selectedMaterial.id,
        materialName: selectedMaterial.name,
        quantity: materialQuantity,
        unit: materialUnit,
        wastage1: wastage1Quantity > 0 ? wastage1Quantity : undefined,
        wastage2: wastage2Quantity > 0 ? wastage2Quantity : undefined,
        baseQuantity: materialBaseQuantity,
        baseUnit: selectedMaterial.baseUnit,
        equivalentPieces: equivalentPieces || undefined,
        totalDeduction: materialQuantity,
        date: productionDate,
        productionBatch: batch,
        notes: `Consumed for ${selectedProduct.name} production. Wastage: ${wastage1Quantity + wastage2Quantity} pieces`
      });
      await addFinishedGoodsLog({
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        type: productType,
        quantityProduced: parsedQuantity,
        unit: selectedProduct.unit || 'pcs',
        date: productionDate,
        source: 'Production',
        notes: notes.trim(),
        wastagePieces: wastage1Number + wastage2Number > 0 ? wastage1Number + wastage2Number : undefined
      });

      onStockAdded?.();
      onClose();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to record production output.');
    } finally {
      submissionInProgress.current = false;
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Record Daily Finished Production Stock"
      subtitle="Add finished goods and deduct the raw material used in the same entry"
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2 font-medium">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="form-label">Product Type</label>
            <select
              value={isCustomType ? 'custom' : productType}
              onChange={(e) => {
                if (e.target.value === 'custom') {
                  setIsCustomType(true);
                  setCustomProductType('');
                } else {
                  handleTypeChange(e.target.value as ProductType);
                }
              }}
              className="form-select"
            >
              {availableProductTypes.map((type) => (
                <option key={type} value={type}>
                  {type.charAt(0).toUpperCase() + type.slice(1).toLowerCase()}
                </option>
              ))}
              <option value="custom">+ Add New Type...</option>
            </select>
            {isCustomType && (
              <input
                type="text"
                value={customProductType}
                onChange={(e) => handleCustomTypeChange(e.target.value)}
                onBlur={(e) => {
                  const normalized = normalizeProductType(e.target.value);
                  if (normalized) {
                    setCustomProductType(normalized);
                    setProductType(normalized);
                  }
                }}
                placeholder="Enter new product type (e.g., Sprayers)"
                className="form-input mt-2"
                required
              />
            )}
          </div>
          <div>
            <label className="form-label">Select Manufactured Product</label>
            <select value={selectedProductId} onChange={(e) => setSelectedProductId(e.target.value)} className="form-select">
              {filteredProducts.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} (Current Stock: {product.currentStock.toLocaleString()})
                </option>
              ))}
            </select>
          </div>
        </div>

        {selectedProduct && (
          <div className="p-3 bg-purple-50 rounded-xl border border-purple-100 flex justify-between text-xs text-purple-900">
            <span>Product SKU: <strong>{selectedProduct.sku}</strong></span>
            <span>Current Available: <strong>{selectedProduct.currentStock.toLocaleString()} {selectedProduct.unit}</strong></span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="form-label">Quantity Produced (Units)</label>
            <input type="number" min={1} required placeholder="Enter quantity produced" value={quantityProduced} onChange={(e) => setQuantityProduced(e.target.value)} className="form-input font-bold" />
          </div>
          <div>
            <label className="form-label">Production Date (DD-MM-YYYY)</label>
            <div className="relative">
              <input
                type="date"
                required
                value={formatDateForInput(date)}
                onChange={(e) => setDate(formatDateForDisplay(e.target.value))}
                className="form-input pr-10"
              />
              <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </div>

        <div>
          <label className="form-label">Raw Material Used</label>
          <select value={selectedMaterialId} onChange={(e) => handleMaterialChange(e.target.value)} className="form-select">
            {materials.map((material) => (
              <option key={material.id} value={material.id}>
                {material.name} — Stock: {formatQuantityWithUnit(material.currentStock, material.baseUnit || material.unit)}
              </option>
            ))}
          </select>
        </div>

        {selectedMaterial && materialStock && (
          <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 flex justify-between text-xs text-amber-900">
            <span>Supplier: <strong>{selectedMaterial.supplier}</strong></span>
            <span>Available: <strong>{formatQuantityWithUnit(materialStock.baseQuantity, materialStock.baseUnit)}</strong></span>
          </div>
        )}

        <div>
          <label className="form-label">Consumption Unit</label>
          <select value={materialUnit} onChange={(e) => setMaterialUnit(e.target.value)} className="form-select">
            {selectedMaterial && getMaterialUnits(selectedMaterial).map((unit) => <option key={unit} value={unit}>{unit}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="form-label">Wastage 1 (Pieces, Optional)</label>
            <input type="number" min={0} step="1" value={wastage1} onChange={(e) => setWastage1(e.target.value)} className="form-input" />
          </div>
          <div>
            <label className="form-label">Wastage 2 (Pieces, Optional)</label>
            <input type="number" min={0} step="1" value={wastage2} onChange={(e) => setWastage2(e.target.value)} className="form-input" />
          </div>
        </div>

        {selectedMaterial && parsedQuantityProduced > 0 && (
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 flex flex-wrap gap-4">
            <span>
              Net quantity calculation: <strong>
                {parsedQuantityProduced.toLocaleString('en-IN', { maximumFractionDigits: 0 })} pcs - {wastage1Number.toLocaleString('en-IN')} pcs - {wastage2Number.toLocaleString('en-IN')} pcs = {netPieces.toLocaleString('en-IN', { maximumFractionDigits: 0 })} pcs
              </strong>
            </span>
            <span>Stock deduction: <strong>{formatQuantityWithUnit(materialBaseQuantity, selectedMaterial.baseUnit)}</strong></span>
            {equivalentPieces !== undefined && equivalentPieces > 0 && (
              <span>Equivalent pieces: <strong>{formatQuantityWithUnit(equivalentPieces, 'pcs')}</strong></span>
            )}
          </div>
        )}

        <div>
          <label className="form-label">Batch Notes (Optional)</label>
          <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} className="form-input" />
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={loading} className="btn-primary !bg-purple-600 hover:!bg-purple-700">
            <Boxes className="w-4 h-4" />
            <span>{loading ? 'Saving Production...' : 'Record Production Output'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
