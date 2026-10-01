import React, { useState, useEffect, useRef } from 'react';
import { Modal } from '../common/Modal';
import { Customer, Product, OrderItem, PriceCategory, Order, Settings, PaymentDocumentType, PackagingMode, OrderType } from '../../types';
import { getCustomers, getProducts, getOrders, getSettings, addOrder, addCustomer } from '../../services/db';
import { ShoppingCart, Check, Plus, AlertCircle, Search, Trash2, Printer, Link2, Package, Layers } from 'lucide-react';
import { useTranslation } from '../../i18n';
import { calculatePacketUnits, getProductUnitsPerPacket, isPositiveInteger, parsePositiveInteger } from '../../utils/packetUtils';
import { getProductPriceForCategory, isValidProductPrice, getPreviousRatesForProduct, formatPreviousRates, calculateEffectiveItemRate, getBottleComboPrice } from '../../utils/pricingUtils';
import { formatPackagingMode } from '../../utils/packagingUtils';
import { printInvoice } from '../../utils/invoicePrintUtils';
import { formatWeight, formatPieceWeight, calculateItemWeightGrams, calculateOrderTotalWeightGrams } from '../../utils/weightUtils';

interface NewOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOrderCreated?: () => void;
}

interface DraftOrderItem {
  id: string;
  productId: string;
  quantity: number | '';
  sellByPacket: boolean;
  packetCount: number | '';
  selectedInnerId?: string; // id of selected inner product or ''
  selectedCapId?: string; // id of selected cap product or ''
}

const createDraftItem = (productId = '', id = `line-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`): DraftOrderItem => ({
  id,
  productId,
  quantity: 1000,
  sellByPacket: false,
  packetCount: '',
  selectedInnerId: '',
  selectedCapId: ''
});

export const NewOrderModal: React.FC<NewOrderModalProps> = ({
  isOpen,
  onClose,
  onOrderCreated
}) => {
  const { t } = useTranslation();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [submittingMode, setSubmittingMode] = useState<'save' | 'save_and_print' | null>(null);
  const loading = submittingMode !== null;
  const [error, setError] = useState('');

  // Form states
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [isCustomerSearchFocused, setIsCustomerSearchFocused] = useState(false);
  const [items, setItems] = useState<DraftOrderItem[]>([createDraftItem('')]);
  const [productSearches, setProductSearches] = useState<Record<string, string>>({});
  const [focusedProductItemId, setFocusedProductItemId] = useState<string | null>(null);
  const [priceCategory, setPriceCategory] = useState<PriceCategory>('A');
  const [paymentType, setPaymentType] = useState<PaymentDocumentType>('debit_memo');
  const [includeGst, setIncludeGst] = useState(true);
  const [notes, setNotes] = useState('');
  const [orderType, setOrderType] = useState<OrderType>('REGULAR');

  // Refs and focus state for automatic next row navigation
  const productSearchInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [pendingFocusItemId, setPendingFocusItemId] = useState<string | null>(null);

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
      const [cusList, prdList, ordList, stg] = await Promise.all([getCustomers(), getProducts(), getOrders(), getSettings()]);
      const activeCustomers = cusList.filter((c) => c.status === 'active');
      setCustomers(activeCustomers);
      setProducts(prdList);
      setOrders(ordList);
      setSettings(stg);

      if (activeCustomers.length > 0 && (!selectedCustomerId || !activeCustomers.some((c) => c.id === selectedCustomerId))) {
        setSelectedCustomerId(activeCustomers[0].id);
        setPriceCategory(activeCustomers[0].priceCategory);
      } else if (activeCustomers.length === 0) {
        setSelectedCustomerId('');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const isItemComplete = (item: DraftOrderItem): boolean => {
    if (!item.productId) return false;
    const product = products.find((p) => p.id === item.productId);
    if (!product) return false;

    const innerProduct = item.selectedInnerId ? products.find((p) => p.id === item.selectedInnerId) : null;
    const capProduct = item.selectedCapId ? products.find((p) => p.id === item.selectedCapId) : null;

    const autoRate = calculateEffectiveItemRate({
      product,
      category: priceCategory,
      innerProduct,
      capProduct
    });
    if (!isValidProductPrice(autoRate)) return false;

    const unitsPerPacket = getProductUnitsPerPacket(product);
    if (item.sellByPacket && unitsPerPacket) {
      return isPositiveInteger(item.packetCount);
    }
    return isPositiveInteger(item.quantity);
  };

  // Keep focus on newly created row's product search
  useEffect(() => {
    if (pendingFocusItemId && productSearchInputRefs.current[pendingFocusItemId]) {
      productSearchInputRefs.current[pendingFocusItemId]?.focus();
      setFocusedProductItemId(pendingFocusItemId);
      setPendingFocusItemId(null);
    }
  }, [pendingFocusItemId, items]);

  // Ensure exactly one trailing blank row ready for the next product
  useEffect(() => {
    setItems((currentItems) => {
      if (currentItems.length === 0) {
        return [createDraftItem('')];
      }

      const lastItem = currentItems[currentItems.length - 1];
      const isLastUserComplete = isItemComplete(lastItem);

      // If last item is complete and has a product, append one blank row
      if (isLastUserComplete && lastItem.productId) {
        return [...currentItems, createDraftItem('')];
      }

      // If there are multiple trailing blank rows, trim to exactly one
      if (currentItems.length >= 2) {
        const secondLast = currentItems[currentItems.length - 2];
        if (!lastItem.productId && !secondLast.productId) {
          return currentItems.slice(0, -1);
        }
      }

      return currentItems;
    });
  }, [items, products, priceCategory]);

  const handleCustomerChange = (cusId: string) => {
    setSelectedCustomerId(cusId);
    const cus = customers.find((c) => c.id === cusId);
    if (cus) {
      setPriceCategory(cus.priceCategory);
    }
  };

  const handleCustomerSelect = (cus: Customer) => {
    setSelectedCustomerId(cus.id);
    setPriceCategory(cus.priceCategory);
    setCustomerSearch('');
    setIsCustomerSearchFocused(false);
  };

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);

  const matchingCustomers = customers.filter((candidate) => {
    const searchText = customerSearch.trim().toLowerCase();
    if (!searchText) return true;
    return [
      candidate.name,
      candidate.company,
      candidate.phone,
      candidate.priceCategory,
      `tier ${candidate.priceCategory}`,
      `category ${candidate.priceCategory}`
    ]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(searchText));
  });

  const orderItems = items
    .map((item) => {
      const product = products.find((candidate) => candidate.id === item.productId);
      if (!product) return null;

      const innerProduct = item.selectedInnerId ? products.find((p) => p.id === item.selectedInnerId) : null;
      const capProduct = item.selectedCapId ? products.find((p) => p.id === item.selectedCapId) : null;

      const unitsPerPacket = getProductUnitsPerPacket(product);
      const sellByPacket = Boolean(item.sellByPacket && unitsPerPacket);
      const packetCount = item.packetCount === '' ? 0 : item.packetCount;
      const quantity = sellByPacket && unitsPerPacket
        ? calculatePacketUnits(packetCount, unitsPerPacket)
        : (item.quantity === '' ? 0 : Number(item.quantity));

      const unitPrice = calculateEffectiveItemRate({
        product,
        category: priceCategory,
        innerProduct,
        capProduct
      }) ?? 0;

      const isCombo = Boolean(product.type === 'bottle' && (innerProduct || capProduct));
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
        productId: product.id,
        productName: product.name,
        productType: product.type,
        priceCategory,
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
        weightPerPiece: product.weightPerPiece,
        weightUnit: product.weightUnit,
        totalWeightGrams: itemWeightGrams ?? undefined,
        totalWeightDisplay: itemWeightGrams ? formatWeight(itemWeightGrams) : undefined
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
  const totalOrderWeightGrams = calculateOrderTotalWeightGrams(orderItems, products);
  const totalOrderWeightDisplay = formatWeight(totalOrderWeightGrams);

  const updateItem = (id: string, updates: Partial<DraftOrderItem>) => {
    setItems((currentItems) => currentItems.map((item) => item.id === id ? { ...item, ...updates } : item));
  };

  const handleQuantityChange = (id: string, value: string) => {
    const newQuantity = parsePositiveInteger(value);
    updateItem(id, { quantity: newQuantity });
  };

  const handlePacketCountChange = (id: string, value: string) => {
    const newPacketCount = parsePositiveInteger(value);
    updateItem(id, { packetCount: newPacketCount });
  };

  const handleSellByPacketToggle = (id: string, enabled: boolean, product?: Product) => {
    const unitsPerPacket = getProductUnitsPerPacket(product);
    if (!enabled || !unitsPerPacket) {
      const current = items.find((item) => item.id === id);
      const packetCount = current?.packetCount === '' || current?.packetCount == null ? 0 : current.packetCount;
      const derivedQuantity = current?.sellByPacket && unitsPerPacket
        ? calculatePacketUnits(packetCount, unitsPerPacket)
        : (current?.quantity === '' || current?.quantity == null ? 1000 : current.quantity);
      const finalQty = derivedQuantity || 1000;
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

  const handleProductSearchChange = (id: string, value: string) => {
    setProductSearches((currentSearches) => ({ ...currentSearches, [id]: value }));
  };

  const handleProductSelect = (itemId: string, productId: string) => {
    const oldItem = items.find((i) => i.id === itemId);
    const product = products.find((p) => p.id === productId);

    let defaultInnerId = '';
    let defaultCapId = '';
    if (product && product.type === 'bottle') {
      defaultInnerId = product.compatibleInnerId || '';
      defaultCapId = product.compatibleCapId || '';
    }

    const updatedItem: DraftOrderItem = {
      ...(oldItem || createDraftItem()),
      id: itemId,
      productId,
      sellByPacket: false,
      packetCount: '',
      selectedInnerId: defaultInnerId,
      selectedCapId: defaultCapId
    };

    setItems((currentItems) => currentItems.map((item) => item.id === itemId ? updatedItem : item));
    setProductSearches((currentSearches) => ({ ...currentSearches, [itemId]: '' }));
    setFocusedProductItemId(null);
  };

  const handleRowEnter = (index: number) => {
    const currentItem = items[index];
    if (!currentItem) return;

    if (index < items.length - 1) {
      const nextItem = items[index + 1];
      if (nextItem) {
        productSearchInputRefs.current[nextItem.id]?.focus();
        setFocusedProductItemId(nextItem.id);
      }
      return;
    }

    if (isItemComplete(currentItem)) {
      const nextDraft = createDraftItem('');
      setItems((prev) => [...prev, nextDraft]);
      setPendingFocusItemId(nextDraft.id);
    }
  };

  const handleRemoveItem = (id: string) => {
    setItems((currentItems) => {
      if (currentItems.length <= 1) {
        return [createDraftItem('')];
      }
      const filtered = currentItems.filter((candidate) => candidate.id !== id);
      if (filtered.length === 0) {
        return [createDraftItem('')];
      }
      return filtered;
    });
  };

  const handleSave = async (andPrint: boolean) => {
    if (submittingMode !== null) return;
    setError('');

    const validItems = items.filter((item) => Boolean(item.productId));

    if (validItems.length === 0) {
      setError(t('Please select a product for at least one order item.'));
      return;
    }

    const invalidPriceItem = validItems.find((item) => {
      const product = products.find((candidate) => candidate.id === item.productId);
      if (!product) return true;
      const innerProduct = item.selectedInnerId ? products.find((p) => p.id === item.selectedInnerId) : null;
      const capProduct = item.selectedCapId ? products.find((p) => p.id === item.selectedCapId) : null;
      const rate = calculateEffectiveItemRate({
        product,
        category: priceCategory,
        innerProduct,
        capProduct
      });
      return !isValidProductPrice(rate);
    });

    if (invalidPriceItem) {
      const product = products.find((candidate) => candidate.id === invalidPriceItem.productId);
      setError(`Product "${product?.name || 'Selected product'}" does not have a valid price for Category ${priceCategory}. Please configure product prices in Product Directory before creating this order.`);
      return;
    }

    if (validItems.some((item) => {
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

    if (validItems.some((item) => {
      const product = products.find((candidate) => candidate.id === item.productId);
      return item.sellByPacket && !getProductUnitsPerPacket(product);
    })) {
      setError('Packet selling is only available when the product has a valid Units per Packet value.');
      return;
    }

    // If Save & Print is selected, open print tab immediately to avoid popup blockers
    let printWin: Window | null = null;
    if (andPrint) {
      try {
        printWin = window.open('', '_blank');
        if (printWin) {
          printWin.document.write('<!DOCTYPE html><html><head><title>Generating Invoice...</title></head><body style="font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;color:#475569;background:#f8fafc;"><h3>Preparing Sales Invoice...</h3></body></html>');
          printWin.document.close();
        }
      } catch (e) {
        printWin = null;
      }
    }

    setSubmittingMode(andPrint ? 'save_and_print' : 'save');

    try {
      let finalCustomerId = selectedCustomerId;
      let finalCustomerName = '';
      let finalCompanyName = '';
      let targetCustomer: Customer | undefined;

      if (isInlineCustomer) {
        if (!newCustomerName || !newCustomerCompany) {
          if (printWin && !printWin.closed) printWin.close();
          setError('Please enter inline customer details.');
          setSubmittingMode(null);
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
        targetCustomer = createdCustomer;
      } else {
        const cus = customers.find((c) => c.id === selectedCustomerId);
        if (cus) {
          finalCustomerName = cus.name;
          finalCompanyName = cus.company;
          targetCustomer = cus;
        }
      }

      const createdOrder = await addOrder({
        customerId: finalCustomerId,
        customerName: finalCustomerName,
        companyName: finalCompanyName,
        items: orderItems,
        subtotal,
        gstAmount,
        gstRate: includeGst ? 18 : 0,
        gstApplied: includeGst,
        billType: includeGst ? 'pakka' : 'kachha',
        paymentType,
        totalAmount: grandTotal,
        totalQuantity: orderItems.reduce((sum, item) => sum + item.quantity, 0),
        totalWeightGrams: totalOrderWeightGrams ?? undefined,
        totalWeightDisplay: totalOrderWeightDisplay || undefined,
        notes,
        orderType
      });

      if (andPrint) {
        const printed = printInvoice(createdOrder, printWin, settings, targetCustomer);
        if (!printed) {
          console.warn('Popup was blocked by browser for invoice print.');
          alert('Invoice PDF could not be opened automatically. Please allow pop-ups for this site.');
        }
      }

      if (onOrderCreated) onOrderCreated();
      onClose();
    } catch (err) {
      if (printWin && !printWin.closed) {
        try {
          printWin.close();
        } catch {
          // ignore
        }
      }
      console.error(err);
      setError('Failed to create order. Please try again.');
    } finally {
      setSubmittingMode(null);
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
      <form onSubmit={(e) => { e.preventDefault(); handleSave(false); }} className="space-y-5">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2 font-medium">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Order Type Selection */}
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2.5">
          <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
            {t('Order Type')}
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div
              onClick={() => setOrderType('REGULAR')}
              className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                orderType === 'REGULAR'
                  ? 'border-blue-600 bg-blue-50/70 ring-2 ring-blue-500/20'
                  : 'border-slate-200 bg-white hover:bg-slate-100/60'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-xs text-slate-900">{t('Regular Order')}</span>
                {orderType === 'REGULAR' && <Check className="w-4 h-4 text-blue-600" />}
              </div>
              <p className="text-[11px] text-slate-500">
                {t('Standard commercial order. Affects finance, customer ledger, collections, and finished-goods inventory upon dispatch.')}
              </p>
            </div>

            <div
              onClick={() => setOrderType('AS')}
              className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                orderType === 'AS'
                  ? 'border-purple-600 bg-purple-50/70 ring-2 ring-purple-500/20'
                  : 'border-slate-200 bg-white hover:bg-slate-100/60'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-xs text-slate-900">{t('AS Order')}</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 uppercase">
                    Non-Financial / Non-Stock
                  </span>
                </div>
                {orderType === 'AS' && <Check className="w-4 h-4 text-purple-600" />}
              </div>
              <p className="text-[11px] text-slate-500">
                {t('Order tracked separately. Excluded from finance, customer ledger, payments, revenue, and inventory deduction.')}
              </p>
            </div>
          </div>
        </div>

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
            <div className="relative">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 w-4 h-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  role="combobox"
                  aria-label={t('Search and select customer')}
                  aria-expanded={isCustomerSearchFocused}
                  aria-controls="customer-options-list"
                  value={isCustomerSearchFocused ? customerSearch : (selectedCustomer ? `${selectedCustomer.name} — ${selectedCustomer.company} — Tier ${selectedCustomer.priceCategory}` : '')}
                  placeholder={selectedCustomer ? `${selectedCustomer.name} — ${selectedCustomer.company} — Tier ${selectedCustomer.priceCategory}` : t('Search customer by name, company, phone, or tier...')}
                  onFocus={() => {
                    setIsCustomerSearchFocused(true);
                    setCustomerSearch('');
                  }}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  onBlur={() => {
                    window.setTimeout(() => setIsCustomerSearchFocused(false), 150);
                  }}
                  className="w-full h-11 pl-9 pr-4 bg-white text-xs font-semibold text-slate-900 rounded-xl border border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm"
                />
              </div>
              {isCustomerSearchFocused && (
                <div id="customer-options-list" role="listbox" className="absolute z-30 mt-1 w-full max-h-60 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl">
                  {matchingCustomers.length > 0 ? (
                    matchingCustomers.map((candidate) => {
                      const isSelected = candidate.id === selectedCustomerId;
                      return (
                        <button
                          key={candidate.id}
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => handleCustomerSelect(candidate)}
                          className={`w-full rounded-xl px-3.5 py-2.5 text-left text-xs transition-colors hover:bg-blue-50 ${isSelected ? 'bg-blue-50/80 text-blue-700 font-bold' : 'text-slate-800'}`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-slate-900">
                              {candidate.name} — {candidate.company} — Tier {candidate.priceCategory}
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase bg-blue-100 text-blue-700 shrink-0">
                              Tier {candidate.priceCategory}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-2 mt-1 text-[11px] text-slate-500">
                            <span>{candidate.company}</span>
                            <span>{candidate.phone}</span>
                          </div>
                        </button>
                      );
                    })
                  ) : (
                    <div className="px-3 py-3 text-xs text-slate-500 text-center font-medium">
                      {t('No customers found')}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="form-label">{t('Company Name')}</label>
                <input
                  type="text"
                  required
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
                  value={newCustomerName}
                  onChange={(e) => setNewCustomerName(e.target.value)}
                  className="form-input bg-white"
                />
              </div>
              <div>
                <label className="form-label">{t('Phone')}</label>
                <input
                  type="text"
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
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">{t('Order Items')}</h2>
          </div>

          {/* Desktop Table Header */}
          <div className="hidden md:grid grid-cols-[minmax(220px,1.2fr)_110px_minmax(180px,1.5fr)_130px_40px] gap-3 px-3.5 py-2 bg-slate-200/50 rounded-xl text-[11px] font-bold text-slate-600 uppercase tracking-wider">
            <div>{t('Product Name')}</div>
            <div>{t('Quantity')}</div>
            <div>{t('Rate (₹)')}</div>
            <div className="text-right">{t('Subtotal (₹)')}</div>
            <div className="text-center">{t('Action')}</div>
          </div>

          <div className="space-y-2.5">
            {items.map((item, index) => {
              const product = products.find((candidate) => candidate.id === item.productId);
              const innerProduct = item.selectedInnerId ? products.find((p) => p.id === item.selectedInnerId) : null;
              const capProduct = item.selectedCapId ? products.find((p) => p.id === item.selectedCapId) : null;

              const effectiveRate = calculateEffectiveItemRate({
                product: product!,
                category: priceCategory,
                innerProduct,
                capProduct
              });
              const hasValidPrice = isValidProductPrice(effectiveRate);
              const unitPrice = effectiveRate ?? 0;
              const prevRates = getPreviousRatesForProduct(orders, item.productId, selectedCustomerId, 3);
              const unitsPerPacket = getProductUnitsPerPacket(product);
              const canSellByPacket = Boolean(unitsPerPacket);
              const sellByPacket = Boolean(item.sellByPacket && unitsPerPacket);
              const packetCount = item.packetCount === '' ? 0 : item.packetCount;
              const itemQuantity = sellByPacket && unitsPerPacket
                ? calculatePacketUnits(packetCount, unitsPerPacket)
                : (item.quantity === '' ? 0 : Number(item.quantity));
              const productSearch = productSearches[item.id] || '';
              const isProductSearchFocused = focusedProductItemId === item.id;
              const matchingProducts = products.filter((candidate) => {
                const searchText = productSearch.trim().toLowerCase();
                if (!searchText) return true;
                return [candidate.name, candidate.type, candidate.sku, candidate.sizeOrType]
                  .filter(Boolean)
                  .some((value) => value.toLowerCase().includes(searchText));
              });

              const isBottle = product?.type === 'bottle';
              const hasComboConfigured = isBottle && (innerProduct || capProduct);
              const configuredComboPrice = isBottle && innerProduct && capProduct ? getBottleComboPrice(product, priceCategory) : null;

              return (
                <div
                  key={item.id}
                  className="p-3.5 rounded-2xl border bg-white border-slate-200/90 shadow-sm hover:border-slate-300 transition-all space-y-3"
                >
                  <div className="grid grid-cols-1 md:grid-cols-[minmax(220px,1.2fr)_110px_minmax(180px,1.5fr)_130px_40px] gap-3 items-start">
                    {/* Product Field */}
                    <div>
                      <label className="block md:hidden text-[11px] font-semibold text-slate-600 mb-1">
                        {t('Product')} {index + 1}
                      </label>
                      <div className="relative">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 w-4 h-4 -translate-y-1/2 text-slate-400" />
                          <input
                            ref={(el) => { productSearchInputRefs.current[item.id] = el; }}
                            type="text"
                            role="combobox"
                            aria-label={`Search product ${index + 1}`}
                            aria-expanded={isProductSearchFocused}
                            aria-controls={`product-options-${item.id}`}
                            value={isProductSearchFocused ? productSearch : product?.name || ''}
                            placeholder={product ? product.name : t('Search products...')}
                            onFocus={() => {
                              setFocusedProductItemId(item.id);
                              setProductSearches((currentSearches) => ({ ...currentSearches, [item.id]: '' }));
                            }}
                            onChange={(e) => handleProductSearchChange(item.id, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                if (matchingProducts.length > 0 && !product) {
                                  handleProductSelect(item.id, matchingProducts[0].id);
                                } else {
                                  handleRowEnter(index);
                                }
                              }
                            }}
                            onBlur={() => {
                              window.setTimeout(() => setFocusedProductItemId((currentId) => currentId === item.id ? null : currentId), 150);
                            }}
                            className="w-full h-10 pl-9 pr-3.5 text-xs font-semibold rounded-xl border bg-slate-50 border-slate-200 text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
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
                                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                                    candidate.type === 'bottle'
                                      ? 'bg-blue-100 text-blue-700'
                                      : candidate.type === 'inner'
                                      ? 'bg-purple-100 text-purple-700'
                                      : 'bg-amber-100 text-amber-700'
                                  }`}>
                                    {candidate.type === 'bottle' ? 'Bottle' : candidate.type === 'inner' ? 'Inner' : 'Cap'}
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
                          required={Boolean(item.productId)}
                          value={item.quantity === '' ? '' : String(item.quantity)}
                          onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleRowEnter(index);
                            }
                          }}
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
                      <div
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleRowEnter(index);
                          }
                        }}
                        className={`h-10 flex items-center justify-between px-3 text-xs font-bold rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
                          !product
                            ? 'bg-slate-100 text-slate-400 border-slate-200'
                            : hasValidPrice
                            ? 'bg-slate-100 text-slate-800 border-slate-200/80'
                            : 'bg-rose-50 text-rose-600 border-rose-200'
                        }`}
                      >
                        <span>{hasValidPrice ? `₹${unitPrice.toFixed(2)}` : (product ? t('No Price') : '-')}</span>
                        {hasComboConfigured && hasValidPrice && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-bold uppercase tracking-tight">
                            Combo
                          </span>
                        )}
                      </div>
                      <div className={`text-[10px] font-semibold mt-1 truncate ${hasValidPrice ? 'text-blue-600' : 'text-rose-600'}`}>
                        {hasValidPrice
                          ? (isBottle && innerProduct && capProduct && configuredComboPrice
                              ? `Configured Combo (Cat ${priceCategory})`
                              : `Auto: Category ${priceCategory}`)
                          : (product ? `Missing Cat ${priceCategory} price` : '')}
                      </div>
                      {product && (
                        <div
                          className={`text-[10px] font-semibold mt-0.5 truncate ${
                            prevRates.length > 0 ? 'text-amber-600' : 'text-slate-400'
                          }`}
                          title={
                            prevRates.length > 0
                              ? `Previous ${prevRates.length} order rate${prevRates.length > 1 ? 's' : ''}: ${prevRates.map((r) => `₹${r.toFixed(2)}`).join(' • ')}`
                              : t('No previous rate')
                          }
                        >
                          {formatPreviousRates(prevRates)}
                        </div>
                      )}
                    </div>

                    {/* Line Subtotal */}
                    <div>
                      <label className="block md:hidden text-[11px] font-semibold text-slate-600 mb-1">{t('Subtotal (₹)')}</label>
                      <div className="h-10 flex items-center justify-end px-3 font-bold text-xs rounded-xl border bg-slate-50 text-slate-900 border-slate-200/80">
                        ₹{(unitPrice * itemQuantity).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>

                    {/* Remove Button */}
                    <div>
                      <label className="block md:hidden text-[11px] font-semibold text-slate-600 mb-1">&nbsp;</label>
                      <button
                        type="button"
                        aria-label={`Remove product ${index + 1}`}
                        disabled={items.length === 1 && !items[0].productId}
                        onClick={() => handleRemoveItem(item.id)}
                        className="h-10 w-10 flex items-center justify-center text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl border border-rose-200/80 transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                        title={t('Remove item')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Bottle Component Selections (Inner & Cap) */}
                  {isBottle && (
                    <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5 text-blue-600" />
                          <span>Bottle Packaging Components (Qty auto-matched to {itemQuantity.toLocaleString()})</span>
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

                      {/* Informative component breakdown note */}
                      {hasComboConfigured && (
                        <div className="text-[11px] text-blue-800 font-medium pt-1 flex items-center flex-wrap gap-2">
                          <span className="font-bold text-blue-900">
                            Included:
                          </span>
                          {innerProduct && (
                            <span className="bg-white/80 px-2 py-0.5 rounded border border-blue-200/60">
                              Inner: {innerProduct.name} × {itemQuantity.toLocaleString()}
                            </span>
                          )}
                          {capProduct && (
                            <span className="bg-white/80 px-2 py-0.5 rounded border border-blue-200/60">
                              Cap: {capProduct.name} × {itemQuantity.toLocaleString()}
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
                    <div className="pt-2 border-t border-slate-100 grid grid-cols-1 md:grid-cols-[auto_110px_110px_minmax(0,1fr)] gap-3 items-end">
                      <label className="flex items-center gap-2 h-10 text-xs font-semibold text-slate-700 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={sellByPacket}
                          onChange={(e) => handleSellByPacketToggle(item.id, e.target.checked, product)}
                          className="rounded text-blue-600 focus:ring-0"
                        />
                        <span>{t('Sell by Packet')}</span>
                      </label>
                      {sellByPacket && (
                        <>
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">{t('Number of Packets')}</label>
                            <input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              value={item.packetCount === '' ? '' : String(item.packetCount)}
                              onChange={(e) => handlePacketCountChange(item.id, e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleRowEnter(index);
                                }
                              }}
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
                      )}
                    </div>
                  )}
                  {/* Informative Weight Breakdown */}
                  {(() => {
                    const rowWeightGrams = calculateItemWeightGrams({
                      product,
                      quantity: itemQuantity,
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

        {/* Payment Document Type (Cash Memo vs Debit Memo) - Only for Regular Orders */}
        {orderType === 'REGULAR' ? (
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
              {t('Payment Document Type')}
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label
                className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                  paymentType === 'cash_memo'
                    ? 'bg-emerald-50/70 border-emerald-500 ring-2 ring-emerald-500/20'
                    : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="paymentType"
                  value="cash_memo"
                  checked={paymentType === 'cash_memo'}
                  onChange={() => setPaymentType('cash_memo')}
                  className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                />
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-xs text-slate-900">{t('Cash Memo')}</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 uppercase">
                      {t('Paid at sale')}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {t('Full invoice amount paid at sale. Automatically records payment in Finance.')}
                  </p>
                </div>
              </label>

              <label
                className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                  paymentType === 'debit_memo'
                    ? 'bg-blue-50/70 border-blue-500 ring-2 ring-blue-500/20'
                    : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="paymentType"
                  value="debit_memo"
                  checked={paymentType === 'debit_memo'}
                  onChange={() => setPaymentType('debit_memo')}
                  className="mt-0.5 text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-xs text-slate-900">{t('Debit Memo')}</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 uppercase">
                      {t('Credit / Due Later')}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {t('Payment due later. Outstanding balance recorded; record payment when received.')}
                  </p>
                </div>
              </label>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-purple-50/70 rounded-2xl border border-purple-200/80 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-purple-900 uppercase tracking-wider">
              <Package className="w-4 h-4 text-purple-600" />
              <span>{t('AS Order — Non-Commercial Tracking')}</span>
            </div>
            <p className="text-xs text-purple-800 leading-relaxed">
              {t('Payment recording and customer balance do not apply to AS Orders. No finance transactions or inventory deductions will be created.')}
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <span className="text-[11px] font-semibold bg-purple-100 text-purple-700 px-2.5 py-0.5 rounded-full">
                Financial Impact: None
              </span>
              <span className="text-[11px] font-semibold bg-purple-100 text-purple-700 px-2.5 py-0.5 rounded-full">
                Inventory Impact: None
              </span>
            </div>
          </div>
        )}

        {/* Order Summary Calculation */}
        <div className="p-4 bg-slate-900 text-white rounded-2xl space-y-2">
          {orderType === 'AS' && (
            <div className="flex items-center justify-between pb-2 mb-1 border-b border-slate-800">
              <span className="text-[11px] font-bold uppercase tracking-wider text-purple-300">Order Type</span>
              <span className="text-xs font-bold px-2 py-0.5 rounded bg-purple-900/80 text-purple-200 border border-purple-700">
                AS Order (Non-Commercial)
              </span>
            </div>
          )}
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
            <span>{orderType === 'AS' ? t('Total Reference Value:') : t('Grand Total:')}</span>
            <span className={orderType === 'AS' ? 'text-purple-300' : 'text-blue-400'}>
              ₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>

          {orderType === 'AS' && (
            <div className="flex justify-between text-[11px] text-purple-300/80 pt-1 border-t border-slate-800">
              <span>Financial / Ledger Impact:</span>
              <span className="font-semibold text-purple-300">None (Excluded)</span>
            </div>
          )}

          {totalOrderWeightGrams !== null && totalOrderWeightGrams > 0 && (
            <div className="flex justify-between text-xs text-slate-300 font-medium pt-2 border-t border-slate-800">
              <span>{t('Total Order Weight:')}</span>
              <span className="text-emerald-400 font-bold">{totalOrderWeightDisplay}</span>
            </div>
          )}
        </div>

        {/* Notes */}
        <div>
          <label className="form-label">{t('Order Notes (Optional)')}</label>
          <input
            type="text"
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
            disabled={loading}
            className="btn-secondary"
          >
            {t('Cancel')}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => handleSave(false)}
            className="px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-semibold hover:bg-slate-900 disabled:opacity-50 transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <Check className="w-4 h-4" />
            <span>{submittingMode === 'save' ? t('Saving...') : t('Save')}</span>
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => handleSave(true)}
            className="btn-primary"
          >
            <Printer className="w-4 h-4" />
            <span>{submittingMode === 'save_and_print' ? t('Saving & Generating PDF...') : t('Save & Print')}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
