import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { RawMaterial } from '../../types';
import { getRawMaterials, recordRawMaterialUsage } from '../../services/db';
import { toBaseQuantity, validateConsumption, formatQuantityWithUnit, getStockInBothUnits, calculateEquivalentPieces } from '../../utils/unitConversion';
import { Layers, AlertCircle } from 'lucide-react';

interface RecordMaterialUsageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUsageRecorded?: () => void;
}

export const RecordMaterialUsageModal: React.FC<RecordMaterialUsageModalProps> = ({
  isOpen,
  onClose,
  onUsageRecorded
}) => {
  const [materials, setMaterials] = useState<RawMaterial[]>([]);
  const [selectedMaterialId, setSelectedMaterialId] = useState('');
  const [quantity, setQuantity] = useState<number>(100);
  const [wastage1, setWastage1] = useState<number>(0);
  const [wastage2, setWastage2] = useState<number>(0);
  const [selectedUnit, setSelectedUnit] = useState<string>('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [productionBatch, setProductionBatch] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadMaterials();
    }
  }, [isOpen]);

  const loadMaterials = async () => {
    try {
      const list = await getRawMaterials();
      setMaterials(list);
      if (list.length > 0) setSelectedMaterialId(list[0].id);
    } catch (e) {
      console.error(e);
    }
  };

  const selectedMaterial = materials.find((m) => m.id === selectedMaterialId);

  // Update selected unit when material changes
  useEffect(() => {
    if (selectedMaterial) {
      setSelectedUnit(selectedMaterial.consumptionUnit || selectedMaterial.baseUnit || 'kg');
    }
  }, [selectedMaterial]);

  // Get available units for selected material
  const getAvailableUnits = (): string[] => {
    if (!selectedMaterial) return [];
    const units = new Set<string>();
    units.add(selectedMaterial.baseUnit);
    units.add(selectedMaterial.consumptionUnit);
    if (selectedMaterial.purchaseUnit !== selectedMaterial.baseUnit) {
      units.add(selectedMaterial.purchaseUnit);
    }
    return Array.from(units);
  };

  // Calculate converted quantity
  const convertedQuantity = selectedMaterial && quantity > 0
    ? toBaseQuantity(quantity, selectedUnit, selectedMaterial)
    : 0;

  // Calculate converted wastage
  const convertedWastage1 = selectedMaterial && wastage1 > 0
    ? toBaseQuantity(wastage1, selectedUnit, selectedMaterial)
    : 0;

  const convertedWastage2 = selectedMaterial && wastage2 > 0
    ? toBaseQuantity(wastage2, selectedUnit, selectedMaterial)
    : 0;

  // Calculate total deduction
  const totalDeduction = convertedQuantity + convertedWastage1 + convertedWastage2;

  // Calculate equivalent pieces for total
  const equivalentPieces = selectedMaterial && totalDeduction > 0
    ? calculateEquivalentPieces(totalDeduction, selectedMaterial)
    : undefined;

  // Get stock in both units for display
  const stockDisplay = selectedMaterial ? getStockInBothUnits(selectedMaterial) : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMaterial) {
      setError('Please select a raw material.');
      return;
    }
    if (quantity <= 0) {
      setError('Quantity used must be greater than 0.');
      return;
    }
    if (wastage1 < 0 || wastage2 < 0) {
      setError('Wastage values cannot be negative.');
      return;
    }

    // Validate total consumption with unit conversion
    const totalConsumption = quantity + wastage1 + wastage2;
    const validation = validateConsumption(totalConsumption, selectedUnit, selectedMaterial);
    if (!validation.isValid) {
      setError(validation.error || 'Invalid consumption');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await recordRawMaterialUsage({
        materialId: selectedMaterial.id,
        materialName: selectedMaterial.name,
        quantity: Number(quantity),
        unit: selectedUnit,
        wastage1: Number(wastage1) || undefined,
        wastage2: Number(wastage2) || undefined,
        totalDeduction: totalConsumption,
        date,
        productionBatch: productionBatch.trim() || `BATCH-${new Date().toISOString().split('T')[0]}`,
        notes: notes.trim()
      });

      if (onUsageRecorded) onUsageRecorded();
      onClose();
    } catch (err) {
      console.error(err);
      setError('Failed to record raw material usage.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Record Raw Material Consumption"
      subtitle="Log factory granules/dye usage for production batches & auto-deduct stock"
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2 font-medium">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div>
          <label className="form-label">Select Raw Material</label>
          <select
            value={selectedMaterialId}
            onChange={(e) => setSelectedMaterialId(e.target.value)}
            className="form-select"
          >
            {materials.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} — Current Stock: {m.currentStock.toLocaleString()} {m.unit}
              </option>
            ))}
          </select>
        </div>

        {selectedMaterial && stockDisplay && (
          <div className="p-3 bg-slate-100 rounded-xl border border-slate-200 flex justify-between text-xs text-slate-700">
            <span>Supplier: <strong>{selectedMaterial.supplier}</strong></span>
            <span>
              Available Stock: <strong>{formatQuantityWithUnit(stockDisplay.baseQuantity, stockDisplay.baseUnit)}</strong>
              {stockDisplay.purchaseUnit !== stockDisplay.baseUnit && (
                <span className="ml-2 text-slate-500">
                  ({formatQuantityWithUnit(stockDisplay.purchaseQuantity, stockDisplay.purchaseUnit)})
                </span>
              )}
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="form-label">Quantity Consumed</label>
            <input
              type="number"
              min={0.01}
              step="0.01"
              required
              value={quantity}
              onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
              className="form-input font-bold"
            />
          </div>

          <div>
            <label className="form-label">Unit</label>
            <select
              value={selectedUnit}
              onChange={(e) => setSelectedUnit(e.target.value)}
              className="form-select"
            >
              {getAvailableUnits().map((unit) => (
                <option key={unit} value={unit}>
                  {unit}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="form-label">Wastage 1 (Optional)</label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={wastage1}
              onChange={(e) => setWastage1(parseFloat(e.target.value) || 0)}
              className="form-input"
            />
          </div>

          <div>
            <label className="form-label">Wastage 2 (Optional)</label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={wastage2}
              onChange={(e) => setWastage2(parseFloat(e.target.value) || 0)}
              className="form-input"
            />
          </div>
        </div>

        {selectedMaterial && totalDeduction > 0 && (
          <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 text-xs text-amber-800">
            <div className="flex flex-wrap gap-4">
              <span>Converted Consumption: <strong>{formatQuantityWithUnit(convertedQuantity, selectedMaterial.baseUnit)}</strong></span>
              {convertedWastage1 > 0 && (
                <span>Wastage 1: <strong>{formatQuantityWithUnit(convertedWastage1, selectedMaterial.baseUnit)}</strong></span>
              )}
              {convertedWastage2 > 0 && (
                <span>Wastage 2: <strong>{formatQuantityWithUnit(convertedWastage2, selectedMaterial.baseUnit)}</strong></span>
              )}
              <span className="ml-auto">Total Deduction: <strong>{formatQuantityWithUnit(totalDeduction, selectedMaterial.baseUnit)}</strong></span>
            </div>
            {equivalentPieces && equivalentPieces > 0 && (
              <div className="mt-2 pt-2 border-t border-amber-200">
                <span>Equivalent Pieces: <strong>{formatQuantityWithUnit(equivalentPieces, 'pcs')}</strong></span>
              </div>
            )}
          </div>
        )}

        <div>
          <label className="form-label">Consumption Date</label>
          <input
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="form-input"
          />
        </div>

        <div>
          <label className="form-label">Production Batch / Machine Line</label>
          <input
            type="text"
            value={productionBatch}
            onChange={(e) => setProductionBatch(e.target.value)}
            className="form-input"
          />
        </div>

        <div>
          <label className="form-label">Usage Notes (Optional)</label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="form-input"
          />
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
            className="btn-primary !bg-amber-600 hover:!bg-amber-700"
          >
            <Layers className="w-4 h-4" />
            <span>{loading ? 'Deducting...' : 'Record Consumption'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
