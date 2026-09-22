import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Customer, Product, Order, OrderItem, PriceCategory } from '../../types';
import { getCustomers, getProducts, getOrders, addOrder, addCustomer } from '../../services/db';
import { ShoppingCart, Check, Plus, AlertCircle, Search, Trash2 } from 'lucide-react';
import { useTranslation } from '../../i18n';
import { calculatePacketUnits, getProductUnitsPerPacket, isPositiveInteger, parsePositiveInteger } from '../../utils/packetUtils';

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
  sellByPacket: boolean;
  packetCount: number | '';
}

const createDraftItem = (productId = '', id = `line-${Date.now()}-${Math.random()}`): DraftOrderItem => ({
  id,
  productId,
  quantity: 1000,
  rate: '',
  sellByPacket: false,
  packetCount: ''
});

export const NewOrderModal: React.FC<NewOrderModalProps> = ({
  isOpen,
  onClose,
  onOrderCreated
}) => {
  const { t } = useTranslation();
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
      const unitsPerPacket = getProductUnitsPerPacket(product);
      const sellByPacket = Boolean(item.sellByPacket && unitsPerPacket);
      const packetCount = item.packetCount === '' ? 0 : item.packetCount;
      const quantity = sellByPacket && unitsPerPacket
        ? calculatePacketUnits(packetCount, unitsPerPacket)
        : (item.quantity === '' ? 0 : item.quantity);
      const unitPrice = item.rate === '' ? 0 : Number(item.rate);
      if (!product) return null;
      const orderItem: OrderItem = {
        productId: product.id,
        productName: product.name,
        productType: product.type,
        priceCategory,
        unitPrice,
        quantity,
        subtotal: unitPrice * quantity
      };
      if (sellByPacket && unitsPerPacket) {
        orderItem.soldByPacket = true;
        orderItem.packetCount = packetCount;
        orderItem.unitsPerPacket = unitsPerPacket;
      }
      return orderItem;
    })
    .filter((item): item is OrderItem => item !== null);
  const subtotal = orderItems.reduce((sum, item) => sum + item.subtotal, 0);
  const gstAmount = includeGst ? subtotal * 0.18 : 0;
  const grandTotal = subtotal + gstAmount;

  const updateItem = (id: string, updates: Partial<DraftOrderItem>) => {
    setItems((currentItems) => currentItems.map((item) => item.id === id ? { ...item, ...updates } : item));
  };

  const handleQuantityChange = (id: string, value: string) => {
    updateItem(id, { quantity: parsePositiveInteger(value) });
  };

  const handlePacketCountChange = (id: string, value: string) => {
    updateItem(id, { packetCount: parsePositiveInteger(value) });
  };

  const handleSellByPacketToggle = (id: string, enabled: boolean, product?: Product) => {
    const unitsPerPacket = getProductUnitsPerPacket(product);
    if (!enabled || !unitsPerPacket) {
      const current = items.find((item) => item.id === id);
      const packetCount = current?.packetCount === '' || current?.packetCount == null ? 0 : current.packetCount;
      const derivedQuantity = current?.sellByPacket && unitsPerPacket
        ? calculatePacketUnits(packetCount, unitsPerPacket)
        : (current?.quantity === '' || current?.quantity == null ? 1000 : current.quantity);
      updateItem(id, { sellByPacket: false, quantity: derivedQuantity || 1000 });
      return;
    }
    const current = items.find((item) => item.id === id);
    const currentQty = current?.quantity === '' || current?.quantity == null ? 0 : current.quantity;
    const packetCount = currentQty > 0 && currentQty % unitsPerPacket === 0
      ? currentQty / unitsPerPacket
      : 1;
    updateItem(id, { sellByPacket: true, packetCount });
  };

  const handleRateChange = (id: string, value: string) => {
    updateItem(id, { rate: normalizeRateInput(value) });
  };

  const handleProductSearchChange = (id: string, value: string) => {
    setProductSearches((currentSearches) => ({ ...currentSearches, [id]: value }));
  };

  const handleProductSelect = (itemId: string, productId: string) => {
    updateItem(itemId, { productId, sellByPacket: false, packetCount: '' });
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

    if (items.some((item) => {
      const product = products.find((candidate) => candidate.id === item.productId);
      const unitsPerPacket = getProductUnitsPerPacket(product);
      if (item.sellByPacket && unitsPerPacket) {
        return !isPositiveInteger(item.packetCount);
      }
      return item.quantity === '' || !isPositiveInteger(item.quantity);
    })) {
      setError('Please enter a valid positive whole quantity. For packet selling, Number of Packets must be a positive whole number.');
      return;
    }

    if (items.some((item) => {
      const product = products.find((candidate) => candidate.id === item.productId);
      return item.sellByPacket && !getProductUnitsPerPacket(product);
    })) {
      setError('Packet selling is only available when the product has a valid Units per Packet value.');
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
      title={t('Create New Sales Order')}
      subtitle={t('Build one order with any combination of products')}
      maxWidth="4xl"
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
              {t('Customer Information')}
            </label>
            <button
              type="button"
              onClick={() => setIsInlineCustomer(!isInlineCustomer)}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              {isInlineCustomer ? t('Select Existing Customer') : t('Add New Customer')}
            </button>
          </div>

          {!isInlineCustomer ? (
            <div>
              <select
                value={selectedCustomerId}
                onChange={(e) => handleCustomerChange(e.target.value)}
                className="form-select bg-white"
              >
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} — {c.company} — Tier {c.priceCategory}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="form-label">{t('Company Name')}</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Acme Pharma"
                  value={newCustomerCompany}
                  onChange={(e) => setNewCustomerCompany(e.target.value)}
                  className="form-input bg-white"
                />
              </div>
              <div>
                <label className="form-label">{t('Contact Name')}</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. John Doe"
                  value={newCustomerName}
                  onChange={(e) => setNewCustomerName(e.target.value)}
                  className="form-input bg-white"
                />
              </div>
              <div>
                <label className="form-label">{t('Phone')}</label>
                <input
                  type="text"
                  placeholder="+91 98980 00000"
                  value={newCustomerPhone}
                  onChange={(e) => setNewCustomerPhone(e.target.value)}
                  className="form-input bg-white"
                />
              </div>
            </div>
          )}
        </div>

        {/* Multi-item Order Builder */}
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">{t('Order Items')}</h2>
              <p className="text-[11px] text-slate-500 mt-1">Add bottles, caps, or any combination of products.</p>
            </div>
            <button
              type="button"
              onClick={() => setItems((currentItems) => [...currentItems, createDraftItem()])}
              className="px-3.5 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 flex items-center gap-1.5 shadow-sm shadow-blue-500/20"
            >
              <Plus className="w-3.5 h-3.5" />
              {t('Add Item')}
            </button>
          </div>

          {/* Desktop Table Header */}
          <div className="hidden md:grid grid-cols-[minmax(240px,3.5fr)_85px_110px_120px_130px_40px] gap-3 px-3.5 py-2 bg-slate-200/50 rounded-xl text-[11px] font-bold text-slate-600 uppercase tracking-wider">
            <div>{t('Product Name')}</div>
            <div>{t('Type')}</div>
            <div>{t('Quantity')}</div>
            <div>{t('Rate (₹)')}</div>
            <div className="text-right">{t('Subtotal (₹)')}</div>
            <div className="text-center">{t('Action')}</div>
          </div>

          <div className="space-y-2.5">
            {items.map((item, index) => {
              const product = products.find((candidate) => candidate.id === item.productId);
              const unitPrice = item.rate === '' ? 0 : Number(item.rate);
              const previousRate = getPreviousRate(selectedCustomerId, item.productId);
              const unitsPerPacket = getProductUnitsPerPacket(product);
              const canSellByPacket = Boolean(unitsPerPacket);
              const sellByPacket = Boolean(item.sellByPacket && unitsPerPacket);
              const packetCount = item.packetCount === '' ? 0 : item.packetCount;
              const itemQuantity = sellByPacket && unitsPerPacket
                ? calculatePacketUnits(packetCount, unitsPerPacket)
                : (item.quantity === '' ? 0 : item.quantity);
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
                <div key={item.id} className="p-3.5 bg-white rounded-2xl border border-slate-200/90 shadow-sm transition-all hover:border-slate-300">
                <div className="grid grid-cols-1 md:grid-cols-[minmax(240px,3.5fr)_85px_110px_120px_130px_40px] gap-3 items-start">
                  {/* Product Field */}
                  <div>
                    <label className="block md:hidden text-[11px] font-semibold text-slate-600 mb-1">{t('Product')} {index + 1}</label>
                    <div className="relative">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 w-4 h-4 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          role="combobox"
                          aria-label={`Search product ${index + 1}`}
                          aria-expanded={isProductSearchFocused}
                          aria-controls={`product-options-${item.id}`}
                          value={isProductSearchFocused ? productSearch : product?.name || ''}
                          placeholder={product ? `${product.name} (${product.type === 'bottle' ? t('Bottle') : t('Cap')})` : t('Search products...')}
                          onFocus={() => {
                            setFocusedProductItemId(item.id);
                            setProductSearches((currentSearches) => ({ ...currentSearches, [item.id]: '' }));
                          }}
                          onChange={(e) => handleProductSearchChange(item.id, e.target.value)}
                          onBlur={() => {
                            window.setTimeout(() => setFocusedProductItemId((currentId) => currentId === item.id ? null : currentId), 150);
                          }}
                          className="w-full h-10 pl-9 pr-3.5 bg-slate-50 text-xs font-semibold text-slate-900 rounded-xl border border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                        />
                      </div>
                      {isProductSearchFocused && (
                        <div id={`product-options-${item.id}`} role="listbox" className="absolute z-30 mt-1 w-full max-h-60 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl">
                          {matchingProducts.length > 0 ? matchingProducts.map((candidate) => (
                            <button
                              key={candidate.id}
                              type="button"
                              role="option"
                              aria-selected={candidate.id === item.productId}
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => handleProductSelect(item.id, candidate.id)}
                              className={`w-full rounded-xl px-3 py-2 text-left text-xs transition-colors hover:bg-blue-50 ${candidate.id === item.productId ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-800 font-medium'}`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-semibold text-slate-900">{candidate.name}</span>
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${candidate.type === 'bottle' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                                  {candidate.type === 'bottle' ? 'Bottle' : 'Cap'}
                                </span>
                              </div>
                              <div className="flex items-center justify-between gap-2 mt-1 text-[10px] text-slate-500">
                                <span>{candidate.sku ? `SKU: ${candidate.sku}` : candidate.sizeOrType || ''}</span>
                                <span>Stock: {candidate.currentStock.toLocaleString()} {candidate.unit || 'pcs'}</span>
                              </div>
                            </button>
                          )) : (
                            <div className="px-3 py-3 text-xs text-slate-500 text-center">{t('No matching products found')}</div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Type */}
                  <div>
                    <label className="block md:hidden text-[11px] font-semibold text-slate-600 mb-1">{t('Type')}</label>
                    <div className="h-10 flex items-center justify-center px-2 bg-slate-100 text-xs font-bold text-slate-700 rounded-xl border border-slate-200/50">
                      {product ? (product.type === 'bottle' ? 'Bottle' : 'Cap') : '-'}
                    </div>
                  </div>

                  {/* Quantity */}
                  <div>
                    <label className="block md:hidden text-[11px] font-semibold text-slate-600 mb-1">{t('Quantity')}</label>
                    {sellByPacket ? (
                      <div className="h-10 flex items-center justify-end px-3 bg-slate-100 text-xs font-bold text-slate-800 rounded-xl border border-slate-200/80">
                        {itemQuantity.toLocaleString('en-IN')}
                      </div>
                    ) : (
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        required
                        value={item.quantity === '' ? '' : String(item.quantity)}
                        onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                        className="w-full h-10 px-3 bg-slate-50 text-xs font-semibold text-slate-900 rounded-xl border border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                      />
                    )}
                    {sellByPacket && (
                      <div className="text-[10px] font-medium text-slate-500 mt-1">{t('Total Units')}</div>
                    )}
                  </div>

                  {/* Rate */}
                  <div>
                    <label className="block md:hidden text-[11px] font-semibold text-slate-600 mb-1">{t('Rate (₹)')}</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="0.00"
                      required
                      value={item.rate}
                      onChange={(e) => handleRateChange(item.id, e.target.value)}
                      className="w-full h-10 px-3 bg-slate-50 text-xs font-semibold text-slate-900 rounded-xl border border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                    />
                    <div className="text-[10px] font-medium text-amber-700 mt-1 truncate">
                      {previousRate === null ? t('New rate') : `Prev: ₹${previousRate.toFixed(2)}`}
                    </div>
                  </div>

                  {/* Line Subtotal */}
                  <div>
                    <label className="block md:hidden text-[11px] font-semibold text-slate-600 mb-1">{t('Subtotal (₹)')}</label>
                    <div className="h-10 flex items-center justify-end px-3 bg-slate-50 text-slate-900 font-bold text-xs rounded-xl border border-slate-200/80">
                      ₹{(unitPrice * itemQuantity).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>

                  {/* Remove Button */}
                  <div>
                    <label className="block md:hidden text-[11px] font-semibold text-slate-600 mb-1">&nbsp;</label>
                    <button
                      type="button"
                      aria-label={`Remove product ${index + 1}`}
                      disabled={items.length === 1}
                      onClick={() => setItems((currentItems) => currentItems.filter((candidate) => candidate.id !== item.id))}
                      className="h-10 w-10 flex items-center justify-center text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl border border-rose-200/80 transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                      title={t('Remove item')}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {canSellByPacket && (
                  <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-1 md:grid-cols-[auto_110px_110px_minmax(0,1fr)] gap-3 items-end">
                    <label className="flex items-center gap-2 h-10 text-xs font-semibold text-slate-700 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={sellByPacket}
                        onChange={(e) => handleSellByPacketToggle(item.id, e.target.checked, product)}
                        className="rounded text-blue-600 focus:ring-0"
                      />
                      <span>{t('Sell by Packet')}</span>
                    </label>
                    {sellByPacket ? (
                      <>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">{t('Number of Packets')}</label>
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={item.packetCount === '' ? '' : String(item.packetCount)}
                            onChange={(e) => handlePacketCountChange(item.id, e.target.value)}
                            className="w-full h-10 px-3 bg-slate-50 text-xs font-semibold text-slate-900 rounded-xl border border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">{t('Units per Packet')}</label>
                          <div className="h-10 flex items-center px-3 bg-slate-100 text-xs font-semibold text-slate-700 rounded-xl border border-slate-200/80">
                            {unitsPerPacket?.toLocaleString('en-IN')}
                          </div>
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">{t('Total Units')}</label>
                          <div className="h-10 flex items-center px-3 bg-blue-50 text-xs font-bold text-blue-700 rounded-xl border border-blue-100">
                            {packetCount} × {unitsPerPacket} = {itemQuantity.toLocaleString('en-IN')}
                          </div>
                        </div>
                      </>
                    ) : (
                      <p className="md:col-span-3 text-[11px] text-slate-500 h-10 flex items-center">
                        {t('Enter quantity in units, or check Sell by Packet to convert packets into total units.')}
                      </p>
                    )}
                  </div>
                )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Pricing Category Selection Cards */}
        <div>
          <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
            {t('Select Customer Price Category')}
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { key: 'A' as PriceCategory, label: t('Category A (Standard)'), desc: t('Standard retail customer pricing') },
              { key: 'B' as PriceCategory, label: t('Category B (Wholesale)'), desc: t('Discounted wholesale rate') },
              { key: 'C' as PriceCategory, label: t('Category C (Special)'), desc: t('Special volume contract rate') }
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
                    {orderItems.length} {t(orderItems.length === 1 ? 'item' : 'items')} {t("use this category's product prices")}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Order Summary Calculation */}
        <div className="p-4 bg-slate-900 text-white rounded-2xl space-y-2">
          <div className="flex justify-between text-xs text-slate-400">
            <span>{t('Items:')}</span>
            <span>{orderItems.length}</span>
          </div>
          <div className="flex justify-between text-xs text-slate-300 font-medium pt-1 border-t border-slate-800">
            <span>{t('Subtotal (Excl. Tax):')}</span>
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
              <span>{t('Apply GST (18%)')}</span>
            </label>
            <span className="text-xs text-slate-400">
              ₹{gstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>

          <div className="flex justify-between text-base font-bold text-white pt-2 border-t border-slate-800">
            <span>{t('Grand Total:')}</span>
            <span className="text-blue-400">
              ₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="form-label">{t('Order Notes (Optional)')}</label>
          <input
            type="text"
            placeholder="e.g. Special packing or dispatch instructions..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="form-input"
          />
        </div>

        {/* Form Actions */}
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
            <ShoppingCart className="w-4 h-4" />
            <span>{loading ? 'Creating Order...' : 'Create Sales Order'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
