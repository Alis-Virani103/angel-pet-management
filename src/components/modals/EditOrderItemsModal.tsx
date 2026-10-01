import React, { useEffect, useState } from 'react';
import { Order, OrderItem, PackagingMode, PriceCategory, Product } from '../../types';
import { getProducts, updateOrder } from '../../services/db';
import { Modal } from '../common/Modal';
import { AlertCircle, Link2, Package, Plus, Save, Trash2, Layers } from 'lucide-react';
import { calculatePacketUnits, getProductUnitsPerPacket, isPositiveInteger, parsePositiveInteger } from '../../utils/packetUtils';
import { getProductPriceForCategory, isValidProductPrice, calculateEffectiveItemRate, getBottleComboPrice } from '../../utils/pricingUtils';
import { formatPackagingMode } from '../../utils/packagingUtils';
import { formatWeight, formatPieceWeight, calculateItemWeightGrams, calculateOrderTotalWeightGrams } from '../../utils/weightUtils';

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
  sellByPacket: boolean;
  packetCount: number | '';
  savedUnitsPerPacket?: number;
  initialProductId?: string;
  initialPriceCategory?: PriceCategory;
  initialUnitPrice?: number;
  selectedInnerId?: string;
  selectedCapId?: string;
}

const createDraftItem = (item?: OrderItem, defaultCategory: PriceCategory = 'A'): DraftItem => {
  const itemId = item?.id || (item?.productId ? `${item.productId}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}` : `line-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`);
  return {
    id: itemId,
    productId: item?.productId || '',
    priceCategory: item?.priceCategory || defaultCategory,
    quantity: item?.quantity || '',
    sellByPacket: Boolean(item?.soldByPacket && item.packetCount && item.unitsPerPacket),
    packetCount: item?.soldByPacket && item.packetCount ? item.packetCount : '',
    savedUnitsPerPacket: item?.unitsPerPacket,
    initialProductId: item?.productId,
    initialPriceCategory: item?.priceCategory,
    initialUnitPrice: item ? item.unitPrice : undefined,
    selectedInnerId: item?.selectedInnerId || '',
    selectedCapId: item?.selectedCapId || ''
  };
};

function getItemUnitPrice(item: DraftItem, products: Product[]): number | null {
  const product = products.find((p) => p.id === item.productId);
  if (!product) return null;

  // Preserve historical rate if product, category, and inner/cap selections are untouched
  const isUnchangedHistorical =
    item.initialProductId !== undefined &&
    item.initialProductId === item.productId &&
    item.initialPriceCategory === item.priceCategory &&
    !item.selectedInnerId &&
    !item.selectedCapId &&
    typeof item.initialUnitPrice === 'number' &&
    item.initialUnitPrice > 0;

  if (isUnchangedHistorical) {
    return item.initialUnitPrice!;
  }

  const innerProduct = item.selectedInnerId ? products.find((p) => p.id === item.selectedInnerId) : null;
  const capProduct = item.selectedCapId ? products.find((p) => p.id === item.selectedCapId) : null;

  return calculateEffectiveItemRate({
    product,
    category: item.priceCategory,
    innerProduct,
    capProduct
  });
}

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
    const defaultCat = order.items[0]?.priceCategory || 'A';
    setItems(order.items.map((it) => createDraftItem(it, defaultCat)));
    setNotes(order.notes || '');
    setError('');
    getProducts().then(setProducts).catch(() => setError('Unable to load products.'));
  }, [isOpen, order]);

  const updateItem = (id: string, updates: Partial<DraftItem>) => {
    setItems((currentItems) => currentItems.map((item) => item.id === id ? { ...item, ...updates } : item));
  };

  const handleProductChange = (itemId: string, productId: string) => {
    const product = products.find((p) => p.id === productId);
    let defaultInnerId = '';
    let defaultCapId = '';
    if (product && product.type === 'bottle') {
      defaultInnerId = product.compatibleInnerId || '';
      defaultCapId = product.compatibleCapId || '';
    }

    updateItem(itemId, {
      productId,
      selectedInnerId: defaultInnerId,
      selectedCapId: defaultCapId,
      sellByPacket: false,
      packetCount: '',
      savedUnitsPerPacket: undefined
    });
  };

  const handleQuantityChange = (id: string, value: string) => {
    const newQuantity = parsePositiveInteger(value);
    updateItem(id, { quantity: newQuantity });
  };

  const handlePacketCountChange = (id: string, value: string) => {
    const newPacketCount = parsePositiveInteger(value);
    updateItem(id, { packetCount: newPacketCount });
  };

  const handleSellByPacketToggle = (id: string, enabled: boolean, unitsPerPacket?: number) => {
    if (!enabled || !unitsPerPacket) {
      const current = items.find((item) => item.id === id);
      const packetCount = current?.packetCount === '' || current?.packetCount == null ? 0 : current.packetCount;
      const derivedQuantity = current?.sellByPacket && unitsPerPacket
        ? calculatePacketUnits(packetCount, unitsPerPacket)
        : (current?.quantity === '' || current?.quantity == null ? 1 : current.quantity);
      const finalQty = derivedQuantity || 1;
      updateItem(id, { sellByPacket: false, quantity: finalQty });
      return;
    }
    const current = items.find((item) => item.id === id);
    const currentQty = current?.quantity === '' || current?.quantity == null ? 0 : current.quantity;
    const packetCount = currentQty > 0 && currentQty % unitsPerPacket === 0
      ? currentQty / unitsPerPacket
      : 1;
    updateItem(id, { sellByPacket: true, packetCount });
  };

  const handleRemoveItem = (id: string) => {
    setItems((currentItems) => currentItems.filter((candidate) => candidate.id !== id));
  };

  const getOrderItems = (): OrderItem[] => items.map((item) => {
    const product = products.find((candidate) => candidate.id === item.productId);
    const innerProduct = item.selectedInnerId ? products.find((p) => p.id === item.selectedInnerId) : null;
    const capProduct = item.selectedCapId ? products.find((p) => p.id === item.selectedCapId) : null;

    const unitsPerPacket = getProductUnitsPerPacket(product) || (isPositiveInteger(item.savedUnitsPerPacket) ? item.savedUnitsPerPacket : undefined);
    const sellByPacket = Boolean(item.sellByPacket && unitsPerPacket);
    const packetCount = item.packetCount === '' ? 0 : item.packetCount;
    const quantity = sellByPacket && unitsPerPacket
      ? calculatePacketUnits(packetCount, unitsPerPacket)
      : (item.quantity === '' ? 0 : Number(item.quantity));
    const calculatedUnitPrice = getItemUnitPrice(item, products);
    const unitPrice = calculatedUnitPrice ?? 0;
    const isCombo = Boolean(product?.type === 'bottle' && (innerProduct || capProduct));
    const packagingMode: PackagingMode =
      innerProduct && capProduct
        ? 'bottle_inner_cap'
        : capProduct
        ? 'bottle_cap'
        : 'bottle_only';

    const itemWeightGrams = calculateItemWeightGrams({
      product,
      quantity,
      innerProduct,
      capProduct
    });

    const orderItem: OrderItem = {
      id: item.id,
      productId: item.productId,
      productName: product?.name || 'Unknown product',
      productType: product?.type || 'bottle',
      priceCategory: item.priceCategory,
      unitPrice,
      quantity,
      subtotal: Number((unitPrice * quantity).toFixed(2)),
      selectedInnerId: innerProduct?.id,
      selectedInnerName: innerProduct?.name,
      selectedCapId: capProduct?.id,
      selectedCapName: capProduct?.name,
      isCombo,
      comboRate: isCombo ? unitPrice : undefined,
      packagingMode,
      weightPerPiece: product?.weightPerPiece,
      weightUnit: product?.weightUnit,
      totalWeightGrams: itemWeightGrams ?? undefined,
      totalWeightDisplay: itemWeightGrams ? formatWeight(itemWeightGrams) : undefined
    };
    if (sellByPacket && unitsPerPacket) {
      orderItem.soldByPacket = true;
      orderItem.packetCount = packetCount;
      orderItem.unitsPerPacket = unitsPerPacket;
    }
    return orderItem;
  });

  const orderItems = getOrderItems();
  const subtotal = orderItems.reduce((sum, item) => sum + item.subtotal, 0);
  const gstAmount = order.gstRate > 0 ? subtotal * (order.gstRate / 100) : 0;
  const grandTotal = subtotal + gstAmount;
  const totalOrderWeightGrams = calculateOrderTotalWeightGrams(orderItems, products);
  const totalOrderWeightDisplay = formatWeight(totalOrderWeightGrams);

  const handleSubmit = async () => {
    setError('');
    if (items.length === 0 || items.some((item) => !item.productId)) {
      setError('Please select a valid product for every item.');
      return;
    }

    const invalidPriceItem = items.find((item) => {
      const product = products.find((candidate) => candidate.id === item.productId);
      if (!product) return true;
      const unitPrice = getItemUnitPrice(item, products);
      return !isValidProductPrice(unitPrice);
    });

    if (invalidPriceItem) {
      const product = products.find((candidate) => candidate.id === invalidPriceItem.productId);
      setError(`Product "${product?.name || 'Selected product'}" does not have a valid price for Category ${invalidPriceItem.priceCategory}. Please configure price before saving.`);
      return;
    }

    if (items.some((item) => {
      const product = products.find((candidate) => candidate.id === item.productId);
      const unitsPerPacket = getProductUnitsPerPacket(product) || (isPositiveInteger(item.savedUnitsPerPacket) ? item.savedUnitsPerPacket : undefined);
      if (item.sellByPacket && unitsPerPacket) {
        return !isPositiveInteger(item.packetCount);
      }
      return item.quantity === '' || !isPositiveInteger(item.quantity);
    })) {
      setError('Please enter a positive whole quantity. For packet selling, Number of Packets must be a positive whole number.');
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
        totalWeightGrams: totalOrderWeightGrams ?? undefined,
        totalWeightDisplay: totalOrderWeightDisplay || undefined,
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
    <Modal isOpen={isOpen} onClose={onClose} title={`Edit ${order.orderNumber}`} subtitle="Update products, quantities, packaging combo components, or pricing categories" maxWidth="2xl">
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
            onClick={() => setItems((currentItems) => [...currentItems, createDraftItem(undefined, order.items[0]?.priceCategory || 'A')])}
            className="px-3 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 flex items-center gap-1.5 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Item
          </button>
        </div>

        <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
          {items.map((item, index) => {
            const product = products.find((candidate) => candidate.id === item.productId);
            const innerProduct = item.selectedInnerId ? products.find((p) => p.id === item.selectedInnerId) : null;
            const capProduct = item.selectedCapId ? products.find((p) => p.id === item.selectedCapId) : null;

            const calculatedUnitPrice = getItemUnitPrice(item, products);
            const hasValidPrice = isValidProductPrice(calculatedUnitPrice);
            const unitPrice = calculatedUnitPrice ?? 0;
            const unitsPerPacket = getProductUnitsPerPacket(product) || (isPositiveInteger(item.savedUnitsPerPacket) ? item.savedUnitsPerPacket : undefined);
            const canSellByPacket = Boolean(unitsPerPacket);
            const sellByPacket = Boolean(item.sellByPacket && unitsPerPacket);
            const packetCount = item.packetCount === '' ? 0 : item.packetCount;
            const quantity = sellByPacket && unitsPerPacket
              ? calculatePacketUnits(packetCount, unitsPerPacket)
              : (item.quantity === '' ? 0 : Number(item.quantity));

            const isBottle = product?.type === 'bottle';
            const hasComboConfigured = isBottle && (innerProduct || capProduct);
            const configuredComboPrice = isBottle && innerProduct && capProduct ? getBottleComboPrice(product, item.priceCategory) : null;

            return (
              <div
                key={item.id}
                className="p-3.5 rounded-2xl border bg-white border-slate-200 shadow-sm space-y-3"
              >
                <div className="grid grid-cols-1 md:grid-cols-[minmax(0,2fr)_80px_100px_100px_110px_auto] gap-2.5 items-end">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Product {index + 1}</label>
                    <select
                      value={item.productId}
                      onChange={(e) => handleProductChange(item.id, e.target.value)}
                      className="w-full px-3 py-2 text-xs font-medium rounded-xl border bg-white text-slate-800 border-slate-200"
                    >
                      <option value="">Select product</option>
                      {products.map((candidate) => (
                        <option key={candidate.id} value={candidate.id}>
                          {candidate.name} ({candidate.type})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Type</label>
                    <div className="px-3 py-2 bg-slate-100 text-xs font-semibold text-slate-600 rounded-xl min-h-[36px] flex items-center capitalize">
                      {product?.type || '-'}
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Category</label>
                    <select
                      value={item.priceCategory}
                      onChange={(e) => updateItem(item.id, { priceCategory: e.target.value as PriceCategory })}
                      className="w-full px-3 py-2 bg-white text-xs font-medium text-slate-800 rounded-xl border border-slate-200 min-h-[36px]"
                    >
                      <option value="A">Category A</option>
                      <option value="B">Category B</option>
                      <option value="C">Category C</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Quantity</label>
                    {sellByPacket ? (
                      <div className="px-3 py-2 bg-white text-xs font-semibold text-slate-800 rounded-xl border border-slate-200 min-h-[36px] flex items-center justify-end">
                        {quantity.toLocaleString('en-IN')}
                      </div>
                    ) : (
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={item.quantity === '' ? '' : String(item.quantity)}
                        onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                        className="w-full px-3 py-2 bg-white text-xs font-medium text-slate-800 rounded-xl border border-slate-200 min-h-[36px]"
                      />
                    )}
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Rate (₹)</label>
                    <div
                      className={`px-3 py-2 text-xs font-bold rounded-xl border min-h-[36px] flex items-center justify-between ${
                        !product
                          ? 'bg-slate-100 text-slate-400 border-slate-200'
                          : hasValidPrice
                          ? 'bg-slate-100 text-slate-800 border-slate-200/80'
                          : 'bg-rose-50 text-rose-600 border-rose-200'
                      }`}
                    >
                      <span>{hasValidPrice ? `₹${calculatedUnitPrice.toFixed(2)}` : (product ? 'No Price' : '-')}</span>
                    </div>
                    <div className={`text-[9px] font-semibold mt-0.5 truncate ${hasValidPrice ? 'text-blue-600' : 'text-rose-600'}`}>
                      {hasValidPrice
                        ? (isBottle && innerProduct && capProduct && configuredComboPrice
                            ? `Combo (Cat ${item.priceCategory})`
                            : `Cat ${item.priceCategory}`)
                        : (product ? `No Cat ${item.priceCategory} price` : '')}
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label={`Remove product ${index + 1}`}
                    onClick={() => handleRemoveItem(item.id)}
                    className="p-2 text-rose-600 rounded-xl hover:bg-rose-100 min-h-[36px] flex items-center justify-center"
                    title="Remove item"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Bottle Component Selections (Inner & Cap) */}
                {isBottle && (
                  <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-blue-600" />
                        <span>Bottle Components (Qty auto-matched to {quantity.toLocaleString()})</span>
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Inner Liner:
                        </label>
                        <select
                          value={item.selectedInnerId || ''}
                          onChange={(e) => updateItem(item.id, { selectedInnerId: e.target.value })}
                          className="w-full h-8 px-2.5 bg-white text-xs font-semibold text-slate-800 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500/20"
                        >
                          <option value="">None (Bottle Only)</option>
                          {products
                            .filter((p) => p.type === 'inner')
                            .map((inner) => (
                              <option key={inner.id} value={inner.id}>
                                {inner.name} ({inner.sizeOrType || inner.sku})
                              </option>
                            ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Cap / Closure:
                        </label>
                        <select
                          value={item.selectedCapId || ''}
                          onChange={(e) => updateItem(item.id, { selectedCapId: e.target.value })}
                          className="w-full h-8 px-2.5 bg-white text-xs font-semibold text-slate-800 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500/20"
                        >
                          <option value="">None (Bottle Only)</option>
                          {products
                            .filter((p) => p.type === 'cap')
                            .map((cap) => (
                              <option key={cap.id} value={cap.id}>
                                {cap.name} ({cap.sizeOrType || cap.sku})
                              </option>
                            ))}
                        </select>
                      </div>
                    </div>

                    {hasComboConfigured && (
                      <div className="text-[11px] text-blue-800 font-medium pt-1 flex items-center flex-wrap gap-2">
                        <span className="font-bold text-blue-900">
                          Included:
                        </span>
                        {innerProduct && (
                          <span className="bg-white/80 px-2 py-0.5 rounded border border-blue-200/60">
                            Inner: {innerProduct.name} × {quantity.toLocaleString()}
                          </span>
                        )}
                        {capProduct && (
                          <span className="bg-white/80 px-2 py-0.5 rounded border border-blue-200/60">
                            Cap: {capProduct.name} × {quantity.toLocaleString()}
                          </span>
                        )}
                        <span className="text-[10px] text-blue-600 italic">
                          (Billed as 1 combo item @ ₹{unitPrice.toFixed(2)})
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {canSellByPacket && (
                  <div className="grid grid-cols-1 md:grid-cols-[auto_110px_110px_minmax(0,1fr)] gap-2 items-end mt-2 pt-2 border-t border-slate-100">
                    <label className="flex items-center gap-2 h-9 text-xs font-semibold text-slate-700 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={sellByPacket}
                        onChange={(e) => handleSellByPacketToggle(item.id, e.target.checked, unitsPerPacket)}
                        className="rounded text-blue-600 focus:ring-0"
                      />
                      <span>Sell by Packet</span>
                    </label>
                    {sellByPacket && (
                      <>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">Packets</label>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={item.packetCount === '' ? '' : String(item.packetCount)}
                            onChange={(e) => handlePacketCountChange(item.id, e.target.value)}
                            className="w-full px-3 py-2 bg-white text-xs font-medium text-slate-800 rounded-xl border border-slate-200"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">Units/Packet</label>
                          <div className="px-3 py-2 bg-white text-xs font-semibold text-slate-600 rounded-xl border border-slate-200 min-h-[34px] flex items-center">
                            {unitsPerPacket?.toLocaleString('en-IN')}
                          </div>
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">Total Units</label>
                          <div className="px-3 py-2 bg-blue-50 text-xs font-bold text-blue-700 rounded-xl border border-blue-100 min-h-[34px] flex items-center">
                            {quantity.toLocaleString('en-IN')}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
                {/* Informative Weight Breakdown */}
                {(() => {
                  const rowWeightGrams = calculateItemWeightGrams({
                    product,
                    quantity,
                    innerProduct,
                    capProduct
                  });
                  if (rowWeightGrams === null || rowWeightGrams <= 0) return null;
                  return (
                    <div className="flex items-center flex-wrap gap-2 text-[11px] pt-1 px-1 text-slate-600">
                      <span className="font-medium text-slate-500">Weight:</span>
                      {product?.weightPerPiece && product.weightPerPiece > 0 && (
                        <span className="font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                          {formatPieceWeight(product.weightPerPiece, product.weightUnit)}
                        </span>
                      )}
                      <span className="font-medium text-slate-500">Total Weight:</span>
                      <span className="font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded">
                        {formatWeight(rowWeightGrams)}
                      </span>
                    </div>
                  );
                })()}
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
          {totalOrderWeightGrams !== null && totalOrderWeightGrams > 0 && (
            <div className="flex justify-between text-xs text-slate-300 font-medium pt-2 border-t border-slate-800">
              <span>Total Order Weight:</span>
              <span className="text-emerald-400 font-bold">{totalOrderWeightDisplay}</span>
            </div>
          )}
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

