import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Customer, Product, PriceCategory } from '../../types';
import { getCustomers, getProducts, addOrder, addCustomer } from '../../services/db';
import { ShoppingCart, Check, Plus, AlertCircle } from 'lucide-react';

interface NewOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOrderCreated?: () => void;
}

export const NewOrderModal: React.FC<NewOrderModalProps> = ({
  isOpen,
  onClose,
  onOrderCreated
}) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form states
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedBottleId, setSelectedBottleId] = useState('');
  const [selectedCapId, setSelectedCapId] = useState('');
  const [quantity, setQuantity] = useState<number>(1000);
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
      const [cusList, prdList] = await Promise.all([getCustomers(), getProducts()]);
      setCustomers(cusList);
      setProducts(prdList);

      if (cusList.length > 0 && !selectedCustomerId) {
        setSelectedCustomerId(cusList[0].id);
        setPriceCategory(cusList[0].priceCategory);
      }

      const bottles = prdList.filter((p) => p.type === 'bottle');
      const caps = prdList.filter((p) => p.type === 'cap');
      if (bottles.length > 0 && !selectedBottleId) setSelectedBottleId(bottles[0].id);
      if (caps.length > 0 && !selectedCapId) setSelectedCapId(caps[0].id);
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

  const bottle = products.find((p) => p.id === selectedBottleId);
  const cap = products.find((p) => p.id === selectedCapId);

  const getPriceForTier = (product: Product | undefined, tier: PriceCategory): number => {
    if (!product) return 0;
    if (tier === 'A') return product.priceA;
    if (tier === 'B') return product.priceB;
    return product.priceC;
  };

  const bottlePrice = getPriceForTier(bottle, priceCategory);
  const capPrice = getPriceForTier(cap, priceCategory);
  const itemUnitPrice = bottlePrice + capPrice;
  const subtotal = itemUnitPrice * (quantity || 0);
  const gstAmount = includeGst ? subtotal * 0.18 : 0;
  const grandTotal = subtotal + gstAmount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (quantity <= 0) {
      setError('Please enter a valid order quantity greater than 0.');
      return;
    }

    if (!selectedBottleId && !selectedCapId) {
      setError('Please select at least one bottle or cap product.');
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

      const items = [];
      if (bottle) {
        items.push({
          productId: bottle.id,
          productName: bottle.name,
          productType: 'bottle' as const,
          priceCategory,
          unitPrice: bottlePrice,
          quantity,
          subtotal: bottlePrice * quantity
        });
      }
      if (cap) {
        items.push({
          productId: cap.id,
          productName: cap.name,
          productType: 'cap' as const,
          priceCategory,
          unitPrice: capPrice,
          quantity,
          subtotal: capPrice * quantity
        });
      }

      await addOrder({
        customerId: finalCustomerId,
        customerName: finalCustomerName,
        companyName: finalCompanyName,
        items,
        subtotal,
        gstAmount,
        gstRate: includeGst ? 18 : 0,
        totalAmount: grandTotal,
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

  const bottles = products.filter((p) => p.type === 'bottle');
  const caps = products.filter((p) => p.type === 'cap');

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create New Sales Order"
      subtitle="Select customer, bottle & cap specs, and pricing tier"
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
                    {c.company} ({c.name}) — Tier {c.priceCategory}
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

        {/* Product Spec Selection */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Bottle Type</label>
            <select
              value={selectedBottleId}
              onChange={(e) => setSelectedBottleId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 text-xs font-medium text-slate-800 rounded-xl border border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="">None</option>
              {bottles.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} (Stock: {b.currentStock.toLocaleString()})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Cap Type</label>
            <select
              value={selectedCapId}
              onChange={(e) => setSelectedCapId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 text-xs font-medium text-slate-800 rounded-xl border border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="">None</option>
              {caps.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} (Stock: {c.currentStock.toLocaleString()})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Order Quantity (Units)</label>
            <input
              type="number"
              min={1}
              required
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 bg-slate-50 text-xs font-medium text-slate-800 rounded-xl border border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
        </div>

        {/* Pricing Category Selection Cards */}
        <div>
          <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
            Select Customer Price Category
          </label>
          <div className="grid grid-cols-3 gap-3">
            {[
              { key: 'A' as PriceCategory, label: 'Category A (Standard)', desc: 'Standard retail customer pricing' },
              { key: 'B' as PriceCategory, label: 'Category B (Wholesale)', desc: 'Discounted wholesale rate' },
              { key: 'C' as PriceCategory, label: 'Category C (Special)', desc: 'Special volume contract rate' }
            ].map((tier) => {
              const bP = getPriceForTier(bottle, tier.key);
              const cP = getPriceForTier(cap, tier.key);
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
                    Bottle: ₹{bP.toFixed(2)} | Cap: ₹{cP.toFixed(2)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Order Summary Calculation */}
        <div className="p-4 bg-slate-900 text-white rounded-2xl space-y-2">
          <div className="flex justify-between text-xs text-slate-400">
            <span>Bottle Subtotal:</span>
            <span>₹{(bottlePrice * quantity).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between text-xs text-slate-400">
            <span>Cap Subtotal:</span>
            <span>₹{(capPrice * quantity).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
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
