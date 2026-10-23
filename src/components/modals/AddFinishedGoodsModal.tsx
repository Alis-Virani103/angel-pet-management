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
  calculatePiecesFromWeight,
  formatQuantityWithUnit,
  fromBaseQuantity,
  getStockInBothUnits,
  toBaseQuantity
} from '../../utils/unitConversion';
import { calculateNetProductionQuantity } from '../../utils/productionUtils';
import { AlertCircle, Boxes } from 'lucide-react';

interface AddFinishedGoodsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStockAdded?: () => void;
}

const parseProductionDate = (value: string): string | null => {
  const match = /^(\d{2}) (\d{2}) (\d{4})$/.exec(value);
  if (!match) return null;

  const [, dayText, monthText, yearText] = match;
  const day = Number(dayText);
  const month = Number(monthText);
  const year = Number(yearText);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    year < 1 ||
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }

  return `${yearText}-${monthText}-${dayText}`;
};

export const AddFinishedGoodsModal: React.FC<AddFinishedGoodsModalProps> = ({
  isOpen,
  onClose,
  onStockAdded
}) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [materials, setMaterials] = useState<RawMaterial[]>([]);
  const [productType, setProductType] = useState<ProductType>('bottle');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedMaterialId, setSelectedMaterialId] = useState('');
  const [quantityProduced, setQuantityProduced] = useState('');
  const [materialUnit, setMaterialUnit] = useState('');
  const [numberOfBags, setNumberOfBags] = useState('');
  const [weightPerBagKg, setWeightPerBagKg] = useState('');
  const [weightPerPieceGrams, setWeightPerPieceGrams] = useState('');
  const [wastage1, setWastage1] = useState('');
  const [wastage2, setWastage2] = useState('');
  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const submissionInProgress = useRef(false);

  useEffect(() => {
    if (isOpen) {
      setQuantityProduced('');
      setNumberOfBags('');
      setWeightPerBagKg('');
      setWeightPerPieceGrams('');
      setWastage1('');
      setWastage2('');
      setDate('');
      setNotes('');
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
    const filtered = products.filter((product) => product.type === type);
    setSelectedProductId(filtered[0]?.id || '');
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
  const weightCalculation = calculatePiecesFromWeight({
    numberOfBags: Number(numberOfBags) || undefined,
    weightPerBagKg: Number(weightPerBagKg) || undefined,
    weightPerPieceGrams: Number(weightPerPieceGrams) || undefined
  });
  const totalWeightKg = weightCalculation.totalWeightKg || 0;
  const totalMaterialQuantityKg = totalWeightKg;
  const wastage1Number = Number(wastage1) || 0;
  const wastage2Number = Number(wastage2) || 0;
  // Wastage is now piece counts, not kg - do not subtract from raw material kg
  const netMaterialQuantityKg = totalMaterialQuantityKg;
  const toMaterialBaseQuantity = (quantityKg: number) => {
    if (!selectedMaterial) return 0;
    const baseUnit = (selectedMaterial.baseUnit || selectedMaterial.unit).toLowerCase();
    if (baseUnit === 'kg') return quantityKg;
    if (baseUnit === 'g') return quantityKg * 1000;
    if (baseUnit === 'pcs' && Number(weightPerPieceGrams) > 0) {
      return quantityKg * 1000 / Number(weightPerPieceGrams);
    }
    return toBaseQuantity(quantityKg, 'kg', selectedMaterial);
  };
  const totalMaterialBaseQuantity = selectedMaterial && totalMaterialQuantityKg > 0
    ? toMaterialBaseQuantity(totalMaterialQuantityKg)
    : 0;
  const netMaterialBaseQuantity = selectedMaterial && netMaterialQuantityKg > 0
    ? toMaterialBaseQuantity(netMaterialQuantityKg)
    : 0;
  const totalMaterialQuantity = selectedMaterial
    ? fromBaseQuantity(totalMaterialBaseQuantity, materialUnit, selectedMaterial)
    : 0;
  const netMaterialQuantity = selectedMaterial
    ? fromBaseQuantity(netMaterialBaseQuantity, materialUnit, selectedMaterial)
    : 0;
  // Wastage is now piece counts, not kg - save as pieces in 'pcs' unit
  const wastage1Quantity = wastage1Number;
  const wastage2Quantity = wastage2Number;
  const equivalentPieces = selectedMaterial && netMaterialQuantityKg > 0
    ? weightCalculation.isValid && weightCalculation.pieces !== null && totalWeightKg > 0
      ? weightCalculation.pieces * (netMaterialQuantityKg / totalWeightKg)
      : calculateEquivalentPieces(netMaterialBaseQuantity, selectedMaterial)
    : undefined;

  const getMaterialUnits = (material: RawMaterial) =>
    Array.from(new Set([material.baseUnit, material.consumptionUnit, material.purchaseUnit].filter(Boolean)));

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submissionInProgress.current) return;
    const productionDate = parseProductionDate(date);
    if (!productionDate) {
      setError('Enter a valid production date in DD MM YYYY format.');
      return;
    }
    if (!selectedProduct) {
      setError('Please select a product.');
      return;
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
    if (!Number.isFinite(totalMaterialQuantityKg) || totalMaterialQuantityKg <= 0) {
      setError('Raw-material quantity must be greater than 0.');
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
    // Wastage is now separate from raw material consumption, so no need to check netMaterialQuantityKg
    if (totalMaterialBaseQuantity > selectedMaterial.currentStock) {
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
        quantity: netMaterialQuantity,
        unit: materialUnit,
        wastage1: wastage1Quantity > 0 ? wastage1Quantity : undefined,
        wastage2: wastage2Quantity > 0 ? wastage2Quantity : undefined,
        baseQuantity: netMaterialBaseQuantity,
        baseUnit: selectedMaterial.baseUnit,
        equivalentPieces: equivalentPieces || undefined,
        totalDeduction: totalMaterialQuantity,
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
            <select value={productType} onChange={(e) => handleTypeChange(e.target.value as ProductType)} className="form-select">
              <option value="bottle">Bottles</option>
              <option value="cap">Caps</option>
            </select>
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
            <label className="form-label">Production Date (DD MM YYYY)</label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]{2} [0-9]{2} [0-9]{4}"
              maxLength={10}
              required
              placeholder="DD MM YYYY"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="form-input"
            />
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="form-label">Number of Bags</label>
            <input type="number" min={0.01} step="0.01" required value={numberOfBags} onChange={(e) => setNumberOfBags(e.target.value)} className="form-input font-bold" placeholder="e.g. 8" />
          </div>
          <div>
            <label className="form-label">Weight per Bag (kg)</label>
            <input type="number" min={0.01} step="0.01" required value={weightPerBagKg} onChange={(e) => setWeightPerBagKg(e.target.value)} className="form-input font-bold" placeholder="e.g. 25" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="form-label">Weight per Piece (grams)</label>
            <input type="number" min={0.01} step="0.01" required value={weightPerPieceGrams} onChange={(e) => setWeightPerPieceGrams(e.target.value)} className="form-input font-bold" placeholder="e.g. 10" />
          </div>
          <div>
            <label className="form-label">Consumption Unit</label>
            <select value={materialUnit} onChange={(e) => setMaterialUnit(e.target.value)} className="form-select">
              {selectedMaterial && getMaterialUnits(selectedMaterial).map((unit) => <option key={unit} value={unit}>{unit}</option>)}
            </select>
          </div>
        </div>

        {weightCalculation.isValid && weightCalculation.totalWeightKg !== null && (
          <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 text-xs text-blue-900 flex flex-wrap gap-4">
            <span>Total weight: <strong>{weightCalculation.totalWeightKg.toLocaleString('en-IN', { maximumFractionDigits: 2 })} kg</strong></span>
            <span>Net calculation: <strong>{(netMaterialQuantityKg * 1000).toLocaleString('en-IN')} g ÷ {Number(weightPerPieceGrams).toLocaleString('en-IN')} g</strong></span>
            {equivalentPieces !== undefined && equivalentPieces > 0 && (
              <span>Equivalent pieces: <strong>{equivalentPieces.toLocaleString('en-IN', { maximumFractionDigits: 2 })} pcs</strong></span>
            )}
          </div>
        )}

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

        {selectedMaterial && totalMaterialQuantityKg > 0 && (
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 flex flex-wrap gap-4">
            <span>
              Net quantity calculation: <strong>
                {formatQuantityWithUnit(totalMaterialQuantityKg, 'kg')} - {formatQuantityWithUnit(wastage1Number, 'kg')} - {formatQuantityWithUnit(wastage2Number, 'kg')} = {formatQuantityWithUnit(netMaterialQuantityKg, 'kg')}
              </strong>
            </span>
            <span>Stock deduction: <strong>{formatQuantityWithUnit(totalMaterialBaseQuantity, selectedMaterial.baseUnit)}</strong></span>
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
