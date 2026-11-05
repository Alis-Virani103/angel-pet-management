import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { RawMaterial, RawMaterialCategory } from '../../types';
import { addRawMaterial, updateRawMaterial, getCustomCategories, addCustomCategory } from '../../services/db';
import { cleanDecimalInput } from '../../utils/packetUtils';
import { Layers, AlertCircle, Plus } from 'lucide-react';

interface AddRawMaterialModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMaterial?: RawMaterial | null;
  onMaterialAdded?: () => void;
}

export const AddRawMaterialModal: React.FC<AddRawMaterialModalProps> = ({
  isOpen,
  onClose,
  initialMaterial,
  onMaterialAdded
}) => {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [category, setCategory] = useState<RawMaterialCategory>('granules');
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [isAddingNewCategory, setIsAddingNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [currentStock, setCurrentStock] = useState<number | string>(1000);
  const [minimumStock, setMinimumStock] = useState<number | string>(500);
  const [unit, setUnit] = useState('kg');
  const [baseUnit, setBaseUnit] = useState('kg');
  const [purchaseUnit, setPurchaseUnit] = useState('kg');
  const [consumptionUnit, setConsumptionUnit] = useState('kg');
  const [conversionFactor, setConversionFactor] = useState<number | string>(1);
  const [piecesPerBaseUnit, setPiecesPerBaseUnit] = useState<number | string>('');
  const [unitCost, setUnitCost] = useState<number | string>(120);
  const [supplier, setSupplier] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [categoryError, setCategoryError] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadCustomCategories();
      if (initialMaterial) {
        setName(initialMaterial.name || '');
        setCode(initialMaterial.code || '');
        setCategory(initialMaterial.category || 'granules');
        setCurrentStock(initialMaterial.currentStock !== undefined && initialMaterial.currentStock !== null ? cleanDecimalInput(String(initialMaterial.currentStock)) : '0');
        setMinimumStock(initialMaterial.minimumStock !== undefined && initialMaterial.minimumStock !== null ? cleanDecimalInput(String(initialMaterial.minimumStock)) : '0');
        setUnit(initialMaterial.unit || 'kg');
        setBaseUnit(initialMaterial.baseUnit || initialMaterial.unit || 'kg');
        setPurchaseUnit(initialMaterial.purchaseUnit || initialMaterial.unit || 'kg');
        setConsumptionUnit(initialMaterial.consumptionUnit || initialMaterial.unit || 'kg');
        setConversionFactor(initialMaterial.conversionFactor !== undefined && initialMaterial.conversionFactor !== null ? cleanDecimalInput(String(initialMaterial.conversionFactor)) : '1');
        setPiecesPerBaseUnit(initialMaterial.piecesPerBaseUnit !== undefined && initialMaterial.piecesPerBaseUnit !== null ? cleanDecimalInput(String(initialMaterial.piecesPerBaseUnit)) : '');
        setUnitCost(initialMaterial.unitCost !== undefined && initialMaterial.unitCost !== null ? cleanDecimalInput(String(initialMaterial.unitCost)) : '0');
        setSupplier(initialMaterial.supplier || '');
      } else {
        setName('');
        setCode('');
        setCategory('granules');
        setCurrentStock('1000');
        setMinimumStock('500');
        setUnit('kg');
        setBaseUnit('kg');
        setPurchaseUnit('kg');
        setConsumptionUnit('kg');
        setConversionFactor('1');
        setPiecesPerBaseUnit('');
        setUnitCost('120');
        setSupplier('');
      }
      setError('');
      setCategoryError('');
      setIsAddingNewCategory(false);
      setNewCategoryName('');
    }
  }, [isOpen, initialMaterial]);

  const loadCustomCategories = async () => {
    try {
      const categories = await getCustomCategories();
      setCustomCategories(categories);
    } catch (err) {
      console.error('Failed to load custom categories:', err);
    }
  };

  const handleAddNewCategory = async () => {
    setCategoryError('');
    if (!newCategoryName.trim()) {
      setCategoryError('Please enter a category name');
      return;
    }

    try {
      const addedCategory = await addCustomCategory(newCategoryName);
      setCategory(addedCategory as RawMaterialCategory);
      setCustomCategories([...customCategories, addedCategory]);
      setIsAddingNewCategory(false);
      setNewCategoryName('');
    } catch (err) {
      setCategoryError(err instanceof Error ? err.message : 'Failed to add category');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Material name is required.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      if (initialMaterial) {
        await updateRawMaterial(initialMaterial.id, {
          name: name.trim(),
          code: code.trim() || initialMaterial.code,
          category,
          currentStock: Number(currentStock),
          minimumStock: Number(minimumStock),
          unit,
          baseUnit,
          purchaseUnit,
          consumptionUnit,
          conversionFactor: Number(conversionFactor),
          piecesPerBaseUnit: Number(piecesPerBaseUnit) || undefined,
          unitCost: Number(unitCost),
          supplier: supplier.trim() || 'Reliance Polymers'
        });
      } else {
        await addRawMaterial({
          name: name.trim(),
          code: code.trim() || `RM-${Math.floor(100 + Math.random() * 900)}`,
          category,
          currentStock: Number(currentStock),
          minimumStock: Number(minimumStock),
          unit,
          baseUnit,
          purchaseUnit,
          consumptionUnit,
          conversionFactor: Number(conversionFactor),
          piecesPerBaseUnit: Number(piecesPerBaseUnit) || undefined,
          unitCost: Number(unitCost),
          supplier: supplier.trim() || 'Reliance Polymers'
        });
      }

      if (onMaterialAdded) onMaterialAdded();
      onClose();
    } catch (err) {
      console.error(err);
      setError(initialMaterial ? 'Failed to update raw material.' : 'Failed to add raw material.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialMaterial ? 'Edit Raw Material' : 'Add Raw Material'}
      subtitle={initialMaterial ? 'Update stock levels and pricing' : 'Register polymer granules, masterbatch, dyes or packing inventory'}
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
            <label className="form-label">Material Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="form-input"
            />
          </div>

          <div>
            <label className="form-label">Category</label>
            {isAddingNewCategory ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="Enter new category name"
                  className="form-input flex-1"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleAddNewCategory}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-colors"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingNewCategory(false);
                    setNewCategoryName('');
                    setCategoryError('');
                  }}
                  className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold rounded-xl transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <select
                value={category}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === '__add_new__') {
                    setIsAddingNewCategory(true);
                  } else {
                    setCategory(value as RawMaterialCategory);
                  }
                }}
                className="form-select"
              >
                <option value="granules">Plastic Polymers / Granules</option>
                <option value="masterbatch">Masterbatch</option>
                <option value="colour">Colours & Dyes</option>
                <option value="packaging">Packaging Consumables</option>
                {customCategories.length > 0 && (
                  <optgroup label="Custom Categories">
                    {customCategories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </optgroup>
                )}
                <option value="__add_new__" className="font-semibold text-blue-600">
                  + Add New Category
                </option>
              </select>
            )}
            {categoryError && (
              <p className="text-[10px] text-rose-600 mt-1">{categoryError}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="form-label">Material Code / SKU</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="form-input"
            />
          </div>

          <div>
            <label className="form-label">Supplier Name</label>
            <input
              type="text"
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              className="form-input"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="form-label">Current Stock</label>
            <input
              type="number"
              required
              value={currentStock}
              onChange={(e) => setCurrentStock(cleanDecimalInput(e.target.value))}
              className="form-input"
            />
          </div>

          <div>
            <label className="form-label">Minimum Alert Stock</label>
            <input
              type="number"
              required
              value={minimumStock}
              onChange={(e) => setMinimumStock(cleanDecimalInput(e.target.value))}
              className="form-input"
            />
          </div>

          <div>
            <label className="form-label">Base Unit</label>
            <select
              value={baseUnit}
              onChange={(e) => setBaseUnit(e.target.value)}
              className="form-select"
            >
              <option value="kg">kg</option>
              <option value="g">g</option>
              <option value="pcs">pcs</option>
            </select>
          </div>
        </div>

        {/* Unit Configuration */}
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">Unit Configuration</label>
            <p className="text-[11px] text-slate-500 mt-1">Configure purchase and consumption units with conversion factor</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="form-label">Purchase Unit</label>
              <select
                value={purchaseUnit}
                onChange={(e) => setPurchaseUnit(e.target.value)}
                className="form-select"
              >
                <option value="kg">kg</option>
                <option value="g">g</option>
                <option value="pcs">pcs</option>
                <option value="Bag">Bag</option>
                <option value="Carton">Carton</option>
              </select>
            </div>

            <div>
              <label className="form-label">Consumption Unit</label>
              <select
                value={consumptionUnit}
                onChange={(e) => setConsumptionUnit(e.target.value)}
                className="form-select"
              >
                <option value="kg">kg</option>
                <option value="g">g</option>
                <option value="pcs">pcs</option>
              </select>
            </div>

            <div>
              <label className="form-label">Conversion Factor</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={conversionFactor}
                onChange={(e) => setConversionFactor(cleanDecimalInput(e.target.value))}
                className="form-input"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                1 {purchaseUnit} = {conversionFactor} {baseUnit}
              </p>
            </div>
          </div>

          {/* Pieces Conversion */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="form-label">Pieces per {baseUnit} (Optional)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={piecesPerBaseUnit}
                onChange={(e) => setPiecesPerBaseUnit(cleanDecimalInput(e.target.value))}
                className="form-input"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                {Number(piecesPerBaseUnit) > 0 ? `1 ${baseUnit} = ${piecesPerBaseUnit} pcs` : 'No pieces conversion'}
              </p>
            </div>
            <div className="flex items-end">
              <p className="text-[11px] text-slate-500">
                Used to calculate equivalent pieces when consuming raw material by weight
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="form-label">Unit Cost (₹)</label>
            <input
              type="number"
              step="0.01"
              required
              value={unitCost}
              onChange={(e) => setUnitCost(cleanDecimalInput(e.target.value))}
              className="form-input font-semibold"
            />
          </div>

          <div>
            <label className="form-label">Legacy Unit (for compatibility)</label>
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="form-select"
            >
              <option value="kg">kg</option>
              <option value="tons">tons</option>
              <option value="bags">bags</option>
              <option value="boxes">boxes</option>
              <option value="pcs">pcs</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="btn-primary"
          >
            <Layers className="w-4 h-4" />
            <span>{loading ? 'Saving...' : initialMaterial ? 'Update Material' : 'Add Material'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
