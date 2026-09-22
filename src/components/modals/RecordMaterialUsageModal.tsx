import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { RawMaterial } from '../../types';
import { getRawMaterials, recordRawMaterialUsage } from '../../services/db';
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
    if (quantity > selectedMaterial.currentStock) {
      setError(`Cannot deduct ${quantity} ${selectedMaterial.unit} — only ${selectedMaterial.currentStock} in stock.`);
      return;
    }

    setLoading(true);
    setError('');
    try {
      await recordRawMaterialUsage({
        materialId: selectedMaterial.id,
        materialName: selectedMaterial.name,
        quantity: Number(quantity),
        unit: selectedMaterial.unit,
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

        {selectedMaterial && (
          <div className="p-3 bg-slate-100 rounded-xl border border-slate-200 flex justify-between text-xs text-slate-700">
            <span>Supplier: <strong>{selectedMaterial.supplier}</strong></span>
            <span>Available Stock: <strong>{selectedMaterial.currentStock.toLocaleString()} {selectedMaterial.unit}</strong></span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="form-label">
              Quantity Consumed ({selectedMaterial?.unit || 'units'})
            </label>
            <input
              type="number"
              min={1}
              required
              value={quantity}
              onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
              className="form-input font-bold"
            />
          </div>

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
        </div>

        <div>
          <label className="form-label">Production Batch / Machine Line</label>
          <input
            type="text"
            placeholder="e.g. BATCH-2026-08-18A"
            value={productionBatch}
            onChange={(e) => setProductionBatch(e.target.value)}
            className="form-input"
          />
        </div>

        <div>
          <label className="form-label">Usage Notes (Optional)</label>
          <input
            type="text"
            placeholder="e.g. Used for 5,000 units of 1L Bottle molding"
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
