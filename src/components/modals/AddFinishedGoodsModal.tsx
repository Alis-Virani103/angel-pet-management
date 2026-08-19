import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Product, ProductType } from '../../types';
import { getProducts, addFinishedGoodsLog } from '../../services/db';
import { Boxes, AlertCircle } from 'lucide-react';

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
  const [productType, setProductType] = useState<ProductType>('bottle');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantityProduced, setQuantityProduced] = useState<number>(5000);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadProducts();
    }
  }, [isOpen]);

  const loadProducts = async () => {
    try {
      const prdList = await getProducts();
      setProducts(prdList);
      const filtered = prdList.filter((p) => p.type === productType);
      if (filtered.length > 0) setSelectedProductId(filtered[0].id);
    } catch (e) {
      console.error(e);
    }
  };

  const handleTypeChange = (type: ProductType) => {
    setProductType(type);
    const filtered = products.filter((p) => p.type === type);
    if (filtered.length > 0) setSelectedProductId(filtered[0].id);
    else setSelectedProductId('');
  };

  const filteredProducts = products.filter((p) => p.type === productType);
  const selectedProduct = products.find((p) => p.id === selectedProductId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) {
      setError('Please select a product.');
      return;
    }
    if (quantityProduced <= 0) {
      setError('Quantity produced must be greater than 0.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await addFinishedGoodsLog({
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        type: productType,
        quantityProduced: Number(quantityProduced),
        unit: selectedProduct.unit || 'pcs',
        date,
        notes: notes.trim()
      });

      if (onStockAdded) onStockAdded();
      onClose();
    } catch (err) {
      console.error(err);
      setError('Failed to record production output.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Record Daily Finished Production Stock"
      subtitle="Add newly manufactured bottle or cap outputs directly into warehouse stock"
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
            <label className="block text-xs font-semibold text-slate-700 mb-1">Product Type</label>
            <select
              value={productType}
              onChange={(e) => handleTypeChange(e.target.value as ProductType)}
              className="w-full px-3 py-2 bg-slate-50 text-xs font-medium text-slate-800 rounded-xl border border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="bottle">Bottles</option>
              <option value="cap">Caps</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Select Manufactured Product</label>
            <select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 text-xs font-medium text-slate-800 rounded-xl border border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
            >
              {filteredProducts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} (Current Stock: {p.currentStock.toLocaleString()})
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
            <label className="block text-xs font-semibold text-slate-700 mb-1">Quantity Produced (Units)</label>
            <input
              type="number"
              min={1}
              required
              value={quantityProduced}
              onChange={(e) => setQuantityProduced(parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 bg-slate-50 text-xs font-bold text-slate-900 rounded-xl border border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Production Date</label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 text-xs font-medium text-slate-800 rounded-xl border border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Batch Notes (Optional)</label>
          <input
            type="text"
            placeholder="e.g. Mold Machine #2 Shift A output"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
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
            className="px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 transition-colors shadow-md shadow-purple-500/20 disabled:opacity-50 flex items-center space-x-2"
          >
            <Boxes className="w-4 h-4" />
            <span>{loading ? 'Adding Stock...' : 'Add Stock'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
