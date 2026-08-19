import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { RawMaterial, RawMaterialCategory } from '../../types';
import { addRawMaterial, updateRawMaterial } from '../../services/db';
import { Layers, AlertCircle } from 'lucide-react';

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
  const [currentStock, setCurrentStock] = useState<number>(1000);
  const [minimumStock, setMinimumStock] = useState<number>(500);
  const [unit, setUnit] = useState('kg');
  const [unitCost, setUnitCost] = useState<number>(120);
  const [supplier, setSupplier] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (initialMaterial) {
        setName(initialMaterial.name || '');
        setCode(initialMaterial.code || '');
        setCategory(initialMaterial.category || 'granules');
        setCurrentStock(initialMaterial.currentStock || 0);
        setMinimumStock(initialMaterial.minimumStock || 0);
        setUnit(initialMaterial.unit || 'kg');
        setUnitCost(initialMaterial.unitCost || 0);
        setSupplier(initialMaterial.supplier || '');
      } else {
        setName('');
        setCode('');
        setCategory('granules');
        setCurrentStock(1000);
        setMinimumStock(500);
        setUnit('kg');
        setUnitCost(120);
        setSupplier('');
      }
      setError('');
    }
  }, [isOpen, initialMaterial]);

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
            <label className="block text-xs font-semibold text-slate-700 mb-1">Material Name</label>
            <input
              type="text"
              required
              placeholder="e.g. PET Granules Grade A"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 text-xs font-medium text-slate-800 rounded-xl border border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as RawMaterialCategory)}
              className="w-full px-3 py-2 bg-slate-50 text-xs font-medium text-slate-800 rounded-xl border border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="granules">Plastic Polymers / Granules</option>
              <option value="masterbatch">Masterbatch</option>
              <option value="colour">Colours & Dyes</option>
              <option value="packaging">Packaging Consumables</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Material Code / SKU</label>
            <input
              type="text"
              placeholder="e.g. PET-GRA-01"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 text-xs font-medium text-slate-800 rounded-xl border border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Supplier Name</label>
            <input
              type="text"
              placeholder="e.g. Reliance Polymers Ltd"
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 text-xs font-medium text-slate-800 rounded-xl border border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Current Stock</label>
            <input
              type="number"
              required
              value={currentStock}
              onChange={(e) => setCurrentStock(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 bg-slate-50 text-xs font-medium text-slate-800 rounded-xl border border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Minimum Alert Stock</label>
            <input
              type="number"
              required
              value={minimumStock}
              onChange={(e) => setMinimumStock(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 bg-slate-50 text-xs font-medium text-slate-800 rounded-xl border border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Unit</label>
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 text-xs font-medium text-slate-800 rounded-xl border border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="kg">kg</option>
              <option value="tons">tons</option>
              <option value="bags">bags</option>
              <option value="boxes">boxes</option>
              <option value="pcs">pcs</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Unit Cost (₹)</label>
          <input
            type="number"
            step="0.01"
            required
            value={unitCost}
            onChange={(e) => setUnitCost(parseFloat(e.target.value) || 0)}
            className="w-full px-3 py-2 bg-slate-50 text-xs font-medium text-slate-800 rounded-xl border border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

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
            className="px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 transition-colors shadow-md shadow-slate-900/20 disabled:opacity-50 flex items-center space-x-2"
          >
            <Layers className="w-4 h-4" />
            <span>{loading ? 'Saving...' : initialMaterial ? 'Update Material' : 'Add Material'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
