import React, { useEffect, useState } from 'react';
import { Order, OrderItem, PriceCategory, Product } from '../../types';
import { getProducts, updateOrder } from '../../services/db';
import { Modal } from '../common/Modal';
import { AlertCircle, Plus, Save, Trash2 } from 'lucide-react';

interface EditOrderItemsModalProps {
  isOpen: boolean;
  order: Order;
  onClose: () => void;
  onSaved: (order: Order) => void;
}

interface DraftItem {
  id: string;
  productId: string;
  priceCategory: PriceCategory;
  quantity: number | '';
  rate: string;
}

const createDraftItem = (item?: OrderItem): DraftItem => ({
  id: item?.productId || `line-${Date.now()}-${Math.random()}`,
  productId: item?.productId || '',
  priceCategory: item?.priceCategory || 'A',
  quantity: item?.quantity || '',
  rate: item ? item.unitPrice.toFixed(2) : ''
});

const normalizeRateInput = (value: string): string => {
  const sanitized = value.replace(/[^\d.]/g, '');
  const [wholePart, ...decimalParts] = sanitized.split('.');
  const decimalPart = decimalParts.join('');
  const normalizedWholePart = wholePart.replace(/^0+(?=\d)/, '');
  return decimalParts.length > 0 ? `${normalizedWholePart}.${decimalPart}` : normalizedWholePart;
};

export const EditOrderItemsModal: React.FC<EditOrderItemsModalProps> = ({
  isOpen,
  order,
  onClose,
  onSaved
}) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [items, setItems] = useState<DraftItem[]>([]);
  const [notes, setNotes] = useState(order.notes || '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setItems(order.items.map(createDraftItem));
    setNotes(order.notes || '');
    setError('');
    getProducts().then(setProducts).catch(() => setError('Unable to load products.'));
  }, [isOpen, order]);

  const updateItem = (id: string, updates: Partial<DraftItem>) => {
    setItems((currentItems) => currentItems.map((item) => item.id === id ? { ...item, ...updates } : item));
  };

  const handleQuantityChange = (id: string, value: string) => {
    const digitsOnly = value.replace(/\D/g, '');
    const normalizedValue = digitsOnly.replace(/^0+(?=\d)/, '');
    updateItem(id, { quantity: normalizedValue ? Number(normalizedValue) : '' });
  };

  const handleRateChange = (id: string, value: string) => {
    updateItem(id, { rate: normalizeRateInput(value) });
  };

  const getOrderItems = (): OrderItem[] => items.map((item) => {
    const product = products.find((candidate) => candidate.id === item.productId);
    const quantity = item.quantity === '' ? 0 : item.quantity;
    const unitPrice = item.rate === '' ? 0 : Number(item.rate);
    return {
      productId: item.productId,
      productName: product?.name || 'Unknown product',
      productType: product?.type || 'bottle',
      priceCategory: item.priceCategory,
      unitPrice,
      quantity,
      subtotal: unitPrice * quantity
    };
  });

  const orderItems = getOrderItems();
  const subtotal = orderItems.reduce((sum, item) => sum + item.subtotal, 0);
  const gstAmount = order.gstRate > 0 ? subtotal * (order.gstRate / 100) : 0;
  const grandTotal = subtotal + gstAmount;

  const handleSubmit = async () => {
    setError('');
    if (items.length === 0 || items.some((item) => !item.productId)) {
      setError('Please select a valid product for every item.');
      return;
    }
    if (items.some((item) => item.quantity === '' || item.quantity <= 0)) {
      setError('Please enter a positive whole quantity for every item.');
      return;
    }
    if (items.some((item) => !item.rate || !Number.isFinite(Number(item.rate)) || Number(item.rate) <= 0)) {
      setError('Please enter a valid positive rate for every item.');
      return;
    }

    setLoading(true);
    try {
      const updatedOrder = await updateOrder(order.id, {
        items: orderItems,
        subtotal,
        gstAmount,
        totalAmount: grandTotal,
        totalQuantity: orderItems.reduce((sum, item) => sum + item.quantity, 0),
        notes
      });
      onSaved(updatedOrder);
      onClose();
    } catch (e) {
      console.error(e);
      setError('Unable to save order changes.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Edit ${order.orderNumber}`} subtitle="Update products, quantities, pricing categories, or notes" maxWidth="2xl">
      <div className="space-y-4">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2 font-medium">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Order Items</h2>
            <p className="text-[11px] text-slate-500 mt-1">Each line is saved inside this Sales Order.</p>
          </div>
          <button
            type="button"
            onClick={() => setItems((currentItems) => [...currentItems, createDraftItem()])}
            className="px-3 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Item
          </button>
        </div>

        <div className="space-y-2 max-h-[45vh] overflow-y-auto pr-1">
          {items.map((item, index) => {
            const product = products.find((candidate) => candidate.id === item.productId);
            const unitPrice = item.rate === '' ? 0 : Number(item.rate);
            const quantity = item.quantity === '' ? 0 : item.quantity;
            return (
              <div key={item.id} className="grid grid-cols-1 md:grid-cols-[minmax(0,2fr)_80px_100px_110px_110px_auto] gap-2 items-end p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Product {index + 1}</label>
                  <select
                    value={item.productId}
                    onChange={(e) => updateItem(item.id, { productId: e.target.value })}
                    className="w-full px-3 py-2 bg-white text-xs font-medium text-slate-800 rounded-xl border border-slate-200"
                  >
                    <option value="">Select product</option>
                    {products.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name} ({candidate.type})</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Type</label>
                  <div className="px-3 py-2 bg-white text-xs font-semibold text-slate-600 rounded-xl min-h-[34px]">{product?.type || '-'}</div>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Category</label>
                  <select
                    value={item.priceCategory}
                    onChange={(e) => updateItem(item.id, { priceCategory: e.target.value as PriceCategory })}
                    className="w-full px-3 py-2 bg-white text-xs font-medium text-slate-800 rounded-xl border border-slate-200"
                  >
                    <option value="A">Category A</option>
                    <option value="B">Category B</option>
                    <option value="C">Category C</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Quantity</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={item.quantity === '' ? '' : String(item.quantity)}
                    onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                    className="w-full px-3 py-2 bg-white text-xs font-medium text-slate-800 rounded-xl border border-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Rate</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    required
                    value={item.rate}
                    onChange={(e) => handleRateChange(item.id, e.target.value)}
                    className="w-full px-3 py-2 bg-white text-xs font-medium text-slate-800 rounded-xl border border-slate-200"
                  />
                  <div className="text-[10px] text-slate-400 mt-1">Line Subtotal: ₹{(unitPrice * quantity).toFixed(2)}</div>
                </div>
                <button
                  type="button"
                  aria-label={`Remove product ${index + 1}`}
                  onClick={() => setItems((currentItems) => currentItems.filter((candidate) => candidate.id !== item.id))}
                  className="p-2 text-rose-600 rounded-xl hover:bg-rose-100"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Order Notes</label>
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full px-3 py-2 bg-slate-50 text-xs text-slate-800 rounded-xl border border-slate-200" />
        </div>

        <div className="p-4 bg-slate-900 text-white rounded-2xl space-y-2 text-xs">
          <div className="flex justify-between text-slate-400"><span>Subtotal:</span><span>₹{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
          <div className="flex justify-between text-slate-400"><span>GST ({order.gstRate}%):</span><span>₹{gstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
          <div className="flex justify-between text-base font-bold pt-2 border-t border-slate-800"><span>Grand Total:</span><span className="text-blue-400">₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100">Cancel</button>
          <button type="button" onClick={handleSubmit} disabled={loading} className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5">
            <Save className="w-3.5 h-3.5" />
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </Modal>
  );
};
