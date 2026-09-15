import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Customer, Product, Order, OrderItem, PriceCategory } from '../../types';
import { getCustomers, getProducts, getOrders, addOrder, addCustomer } from '../../services/db';
import { ShoppingCart, Check, Plus, AlertCircle, Search } from 'lucide-react';

interface NewOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOrderCreated?: () => void;
}

interface DraftOrderItem {
  id: string;
  productId: string;
  quantity: number | '';
  rate: string;
}

const createDraftItem = (productId = '', id = `line-${Date.now()}-${Math.random()}`): DraftOrderItem => ({
  id,
  productId,
  quantity: 1000,
  rate: ''
});

export const NewOrderModal: React.FC<NewOrderModalProps> = ({
  isOpen,
  onClose,
  onOrderCreated
}) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [previousOrders, setPreviousOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form states
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [items, setItems] = useState<DraftOrderItem[]>([createDraftItem()]);
  const [productSearches, setProductSearches] = useState<Record<string, string>>({});
  const [focusedProductItemId, setFocusedProductItemId] = useState<string | null>(null);
  const [priceCategory, setPriceCategory] = useState<PriceCategory>('A');
  const [includeGst, setIncludeGst] = useState(true);
  const [notes, setNotes] = useState('');

  // Inline new customer toggle state
  const [isInlineCustomer, setIsInlineCustomer] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerCompany, setNewCustomerCompany] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    try {
      const [cusList, prdList, orderList] = await Promise.all([getCustomers(), getProducts(), getOrders()]);
      const activeCustomers = cusList.filter((c) => c.status === 'active');
      setCustomers(activeCustomers);
      setProducts(prdList);
      setPreviousOrders(orderList);

      if (activeCustomers.length > 0 && (!selectedCustomerId || !activeCustomers.some((c) => c.id === selectedCustomerId))) {
        setSelectedCustomerId(activeCustomers[0].id);
        setPriceCategory(activeCustomers[0].priceCategory);
      } else if (activeCustomers.length === 0) {
        setSelectedCustomerId('');
      }

      setItems((currentItems) => currentItems.map((item, index) => (
        item.productId || index > 0 ? item : { ...item, productId: prdList[0]?.id || '' }
      )));
    } catch (e) {
      console.error(e);
    }
  };

  const handleCustomerChange = (cusId: string) => {
    setSelectedCustomerId(cusId);
    const cus = customers.find((c) => c.id === cusId);
    if (cus) {
      setPriceCategory(cus.priceCategory);
    }
  };

  const getPreviousRate = (customerId: string, productId: string): number | null => {
    if (!customerId || !productId) return null;
    const matchingItems = previousOrders
      .filter((order) => order.customerId === customerId && order.orderStatus !== 'cancelled')
      .sort((first, second) => second.orderDate.localeCompare(first.orderDate))
      .flatMap((order) => order.items.filter((item) => item.productId === productId));
    return matchingItems[0]?.unitPrice ?? null;
  };

  const normalizeRateInput = (value: string): string => {
    const sanitized = value.replace(/[^\d.]/g, '');
    const [wholePart, ...decimalParts] = sanitized.split('.');
    const decimalPart = decimalParts.join('');
    const normalizedWholePart = wholePart.replace(/^0+(?=\d)/, '');
    return decimalParts.length > 0 ? `${normalizedWholePart}.${decimalPart}` : normalizedWholePart;
  };

  const orderItems = items
    .map((item) => {
      const product = products.find((candidate) => candidate.id === item.productId);
      const quantity = item.quantity === '' ? 0 : item.quantity;
      const unitPrice = item.rate === '' ? 0 : Number(item.rate);
      if (!product) return null;
      return {
        productId: product.id,
        productName: product.name,
        productType: product.type,
        priceCategory,
        unitPrice,
        quantity,
        subtotal: unitPrice * quantity
      } satisfies OrderItem;
    })
    .filter((item): item is OrderItem => item !== null);
  const subtotal = orderItems.reduce((sum, item) => sum + item.subtotal, 0);
  const gstAmount = includeGst ? subtotal * 0.18 : 0;
  const grandTotal = subtotal + gstAmount;

  const updateItem = (id: string, updates: Partial<DraftOrderItem>) => {
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

  const handleProductSearchChange = (id: string, value: string) => {
    setProductSearches((currentSearches) => ({ ...currentSearches, [id]: value }));
  };

  const handleProductSelect = (itemId: string, productId: string) => {
    updateItem(itemId, { productId });
    setProductSearches((currentSearches) => ({ ...currentSearches, [itemId]: '' }));
    setFocusedProductItemId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (orderItems.length === 0 || items.some((item) => !item.productId)) {
      setError('Please select a product for every order item.');
      return;
    }

    if (items.some((item) => item.quantity === '' || item.quantity <= 0)) {
      setError('Please enter a valid positive whole quantity for every item.');
      return;
    }

    if (items.some((item) => !item.rate || !Number.isFinite(Number(item.rate)) || Number(item.rate) <= 0)) {
      setError('Please enter a valid positive rate for every item.');
      return;
    }

    setLoading(true);
    try {
      let finalCustomerId = selectedCustomerId;
      let finalCustomerName = '';
      let finalCompanyName = '';

      if (isInlineCustomer) {
        if (!newCustomerName || !newCustomerCompany) {
          setError('Please enter inline customer details.');
          setLoading(false);
          return;
        }
        const createdCustomer = await addCustomer({
          name: newCustomerName,
          company: newCustomerCompany,
          phone: newCustomerPhone || '+91 90000 00000',
          address: 'Main Office',
          customerType: 'Direct Customer',
          priceCategory,
          status: 'active'
        });
        finalCustomerId = createdCustomer.id;
        finalCustomerName = createdCustomer.name;
        finalCompanyName = createdCustomer.company;
      } else {
        const cus = customers.find((c) => c.id === selectedCustomerId);
        if (cus) {
          finalCustomerName = cus.name;
          finalCompanyName = cus.company;
        }
      }

      await addOrder({
        customerId: finalCustomerId,
        customerName: finalCustomerName,
        companyName: finalCompanyName,
        items: orderItems,
        subtotal,
        gstAmount,
        gstRate: includeGst ? 18 : 0,
        totalAmount: grandTotal,
        totalQuantity: orderItems.reduce((sum, item) => sum + item.quantity, 0),
        notes
      });

      if (onOrderCreated) onOrderCreated();
      onClose();
    } catch (err) {
      console.error(err);
      setError('Failed to create order. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create New Sales Order"
      subtitle="Build one order with any combination of products"
      maxWidth="2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2 font-medium">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Customer Selection */}
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Customer Information
            </label>
            <button
              type="button"
              onClick={() => setIsInlineCustomer(!isInlineCustomer)}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              {isInlineCustomer ? 'Select Existing Customer' : 'Add New Customer'}
            </button>
          </div>

          {!isInlineCustomer ? (
            <div>
              <select
                value={selectedCustomerId}
                onChange={(e) => handleCustomerChange(e.target.value)}
                className="w-full px-3 py-2 bg-white text-xs font-medium text-slate-800 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              >
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} — {c.company} — Tier {c.priceCategory}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Company Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Acme Pharma"
                  value={newCustomerCompany}
                  onChange={(e) => setNewCustomerCompany(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Contact Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. John Doe"
                  value={newCustomerName}
                  onChange={(e) => setNewCustomerName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Phone</label>
                <input
                  type="text"
                  placeholder="+91 98980 00000"
                  value={newCustomerPhone}
                  onChange={(e) => setNewCustomerPhone(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>
          )}
        </div>

        {/* Multi-item Order Builder */}
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Order Items</h2>
              <p className="text-[11px] text-slate-500 mt-1">Add bottles, caps, or any combination of products.</p>
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

          <div className="space-y-2">
            {items.map((item, index) => {
              const product = products.find((candidate) => candidate.id === item.productId);
              const unitPrice = item.rate === '' ? 0 : Number(item.rate);
              const previousRate = getPreviousRate(selectedCustomerId, item.productId);
              const itemQuantity = item.quantity === '' ? 0 : item.quantity;
              const productSearch = productSearches[item.id] || '';
              const isProductSearchFocused = focusedProductItemId === item.id;
              const matchingProducts = products.filter((candidate) => {
                const searchText = productSearch.trim().toLowerCase();
                if (!searchText) return true;
                return [candidate.name, candidate.type, candidate.sku, candidate.sizeOrType]
                  .filter(Boolean)
                  .some((value) => value.toLowerCase().includes(searchText));
              });
              return (
                <div key={item.id} className="grid grid-cols-1 md:grid-cols-[minmax(0,2fr)_90px_110px_110px_minmax(140px,1fr)_auto] gap-2 items-end p-3 bg-white rounded-xl border border-slate-200">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Product {index + 1}</label>
                    <div className="relative">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 w-3.5 h-3.5 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          role="combobox"
                          aria-label={`Search product ${index + 1}`}
                          aria-expanded={isProductSearchFocused}
                          aria-controls={`product-options-${item.id}`}
                          value={isProductSearchFocused ? productSearch : product?.name || ''}
                          placeholder={product ? `${product.name} (${product.type === 'bottle' ? 'Bottle' : 'Cap'})` : 'Search products'}
                          onFocus={() => {
                            setFocusedProductItemId(item.id);
                            setProductSearches((currentSearches) => ({ ...currentSearches, [item.id]: '' }));
                          }}
                          onChange={(e) => handleProductSearchChange(item.id, e.target.value)}
                          onBlur={() => {
                            window.setTimeout(() => setFocusedProductItemId((currentId) => currentId === item.id ? null : currentId), 150);
                          }}
                          className="w-full pl-8 pr-3 py-2 bg-slate-50 text-xs font-medium text-slate-800 rounded-xl border border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                        />
                      </div>
                      {isProductSearchFocused && (
                        <div id={`product-options-${item.id}`} role="listbox" className="absolute z-20 mt-1 w-full max-h-52 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
                          {matchingProducts.length > 0 ? matchingProducts.map((candidate) => (
                            <button
                              key={candidate.id}
                              type="button"
                              role="option"
                              aria-selected={candidate.id === item.productId}
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => handleProductSelect(item.id, candidate.id)}
                              className={`w-full rounded-lg px-3 py-2 text-left text-xs hover:bg-blue-50 ${candidate.id === item.productId ? 'bg-blue-50 text-blue-700' : 'text-slate-700'}`}
                            >
                              <span className="block font-semibold">{candidate.name}</span>
                              <span className="block text-[10px] text-slate-500">
                                {candidate.type === 'bottle' ? 'Bottle' : 'Cap'}{candidate.sku ? ` · ${candidate.sku}` : ''} · Stock: {candidate.currentStock.toLocaleString()}
                              </span>
                            </button>
                          )) : (
                            <div className="px-3 py-3 text-xs text-slate-500">No products found</div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Type</label>
                    <div className="px-3 py-2 bg-slate-100 text-xs font-semibold text-slate-600 rounded-xl min-h-[34px]">
                      {product ? (product.type === 'bottle' ? 'Bottle' : 'Cap') : '-'}
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Quantity</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      required
                      value={item.quantity === '' ? '' : String(item.quantity)}
                      onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 text-xs font-medium text-slate-800 rounded-xl border border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Rate</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="Enter rate"
                      required
                      value={item.rate}
                      onChange={(e) => handleRateChange(item.id, e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 text-xs font-medium text-slate-800 rounded-xl border border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                    />
                    <div className="text-[10px] text-slate-500 mt-1">Line Subtotal: ₹{(unitPrice * itemQuantity).toFixed(2)}</div>
                    <div className="text-[10px] font-semibold text-amber-700 mt-0.5">
                      Previous Rate: {previousRate === null ? 'No previous rate' : `₹${previousRate.toFixed(2)}`}
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label={`Remove product ${index + 1}`}
                    disabled={items.length === 1}
                    onClick={() => setItems((currentItems) => currentItems.filter((candidate) => candidate.id !== item.id))}
                    className="px-3 py-2 text-xs font-semibold text-rose-600 rounded-xl hover:bg-rose-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Remove
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Pricing Category Selection Cards */}
        <div>
          <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
            Select Customer Price Category
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { key: 'A' as PriceCategory, label: 'Category A (Standard)', desc: 'Standard retail customer pricing' },
              { key: 'B' as PriceCategory, label: 'Category B (Wholesale)', desc: 'Discounted wholesale rate' },
              { key: 'C' as PriceCategory, label: 'Category C (Special)', desc: 'Special volume contract rate' }
            ].map((tier) => {
              const selected = priceCategory === tier.key;

              return (
                <div
                  key={tier.key}
                  onClick={() => setPriceCategory(tier.key)}
                  className={`p-3 rounded-2xl border cursor-pointer transition-all ${
                    selected
                      ? 'border-blue-600 bg-blue-50/50 ring-2 ring-blue-500/20'
                      : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100/50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-xs text-slate-900">{tier.label}</span>
                    {selected && <Check className="w-4 h-4 text-blue-600" />}
                  </div>
                  <p className="text-[11px] text-slate-500">{tier.desc}</p>
                  <div className="mt-2 text-xs font-semibold text-slate-800">
                    {orderItems.length} item{orderItems.length === 1 ? '' : 's'} use this category's product prices
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Order Summary Calculation */}
        <div className="p-4 bg-slate-900 text-white rounded-2xl space-y-2">
          <div className="flex justify-between text-xs text-slate-400">
            <span>Items:</span>
            <span>{orderItems.length}</span>
          </div>
          <div className="flex justify-between text-xs text-slate-300 font-medium pt-1 border-t border-slate-800">
            <span>Subtotal (Excl. Tax):</span>
            <span>₹{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>

          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center space-x-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={includeGst}
                onChange={(e) => setIncludeGst(e.target.checked)}
                className="rounded text-blue-500 focus:ring-0"
              />
              <span>Apply GST (18%)</span>
            </label>
            <span className="text-xs text-slate-400">
              ₹{gstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>

          <div className="flex justify-between text-base font-bold text-white pt-2 border-t border-slate-800">
            <span>Grand Total:</span>
            <span className="text-blue-400">
              ₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Order Notes (Optional)</label>
          <input
            type="text"
            placeholder="e.g. Special packing or dispatch instructions..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 text-xs font-medium text-slate-800 rounded-xl border border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

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
            <ShoppingCart className="w-4 h-4" />
            <span>{loading ? 'Creating Order...' : 'Create Sales Order'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
