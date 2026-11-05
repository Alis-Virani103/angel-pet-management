import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Dispatch, Order, Product, Customer, PriceCategory } from '../../types';
import { getDispatches, getOrders, getProducts, getCustomers, addOrder } from '../../services/db';
import { IndianRupee, Check, AlertCircle, Loader2 } from 'lucide-react';

interface CreateConsolidatedInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInvoiceCreated?: () => void;
}

export const CreateConsolidatedInvoiceModal: React.FC<CreateConsolidatedInvoiceModalProps> = ({
  isOpen,
  onClose,
  onInvoiceCreated
}) => {
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedDispatchIds, setSelectedDispatchIds] = useState<Set<string>>(new Set());
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [priceCategory, setPriceCategory] = useState<PriceCategory>('A');
  const [includeGst, setIncludeGst] = useState(true);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [dispatchList, orderList, productList, customerList] = await Promise.all([
        getDispatches(),
        getOrders(),
        getProducts(),
        getCustomers()
      ]);
      setDispatches(dispatchList);
      setOrders(orderList);
      setProducts(productList);
      setCustomers(customerList);
    } catch (e) {
      console.error('Error loading data:', e);
      setError('Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Filter dispatches that are eligible for billing
  const eligibleDispatches = selectedCustomerId
    ? dispatches.filter((d) => {
        const order = orders.find((o) => o.id === d.orderId);
        if (!order) return false;
        if (order.customerId !== selectedCustomerId) return false;
        // Only dispatches that have unbilled quantity
        const totalQuantity = d.items.reduce((sum, item) => sum + item.quantity, 0);
        const billedQuantity = d.billedQuantity || 0;
        return billedQuantity < totalQuantity;
      })
    : [];

  const handleDispatchToggle = (dispatchId: string) => {
    setSelectedDispatchIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(dispatchId)) {
        newSet.delete(dispatchId);
      } else {
        newSet.add(dispatchId);
      }
      return newSet;
    });
  };

  const handleSubmit = async () => {
    if (selectedDispatchIds.size === 0) {
      setError('Please select at least one delivery challan.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const selectedDispatches = dispatches.filter((d) => selectedDispatchIds.has(d.id));
      
      // Get the customer from the first dispatch
      const firstDispatch = selectedDispatches[0];
      const order = orders.find((o) => o.id === firstDispatch.orderId);
      if (!order) {
        throw new Error('Order not found for selected dispatch.');
      }

      const customer = customers.find((c) => c.id === order.customerId);
      if (!customer) {
        throw new Error('Customer not found.');
      }

      // Consolidate items from all selected dispatches
      const consolidatedItems = new Map<string, {
        productId: string;
        productName: string;
        productType: string;
        quantity: number;
        unitPrice: number;
        subtotal: number;
      }>();

      selectedDispatches.forEach((dispatch) => {
        dispatch.items.forEach((item) => {
          const existing = consolidatedItems.get(item.productId);
          if (existing) {
            existing.quantity += item.quantity;
            existing.subtotal = Number((existing.unitPrice * existing.quantity).toFixed(2));
          } else {
            const product = products.find((p) => p.id === item.productId);
            const unitPrice = product ? (product.priceA || 0) : 0;
            consolidatedItems.set(item.productId, {
              productId: item.productId,
              productName: item.productName,
              productType: product?.type || 'bottle',
              quantity: item.quantity,
              unitPrice,
              subtotal: Number((unitPrice * item.quantity).toFixed(2))
            });
          }
        });
      });

      const orderItems = Array.from(consolidatedItems.values()).map((item) => ({
        productId: item.productId,
        productName: item.productName,
        productType: item.productType as any,
        priceCategory,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        subtotal: item.subtotal
      }));

      const subtotal = orderItems.reduce((sum, item) => sum + item.subtotal, 0);
      const gstRate = includeGst ? 18 : 0;
      const gstAmount = includeGst ? Number((subtotal * gstRate / 100).toFixed(2)) : 0;
      const totalAmount = includeGst ? Number((subtotal + gstAmount).toFixed(2)) : subtotal;

      // Create the consolidated invoice
      const newOrder = await addOrder({
        customerId: customer.id,
        customerName: customer.name,
        companyName: customer.company || '',
        items: orderItems,
        subtotal,
        gstAmount,
        gstRate,
        gstApplied: includeGst,
        billType: includeGst ? 'pakka' : 'kachha',
        paymentType: 'debit_memo',
        totalAmount,
        dispatchIds: Array.from(selectedDispatchIds),
        isConsolidatedInvoice: true
      });

      // Update dispatches to mark them as billed
      // Note: This would require updating the dispatch update function
      // For now, we'll just track it in the order

      if (onInvoiceCreated) onInvoiceCreated();
      onClose();
      setSelectedDispatchIds(new Set());
      setSelectedCustomerId('');
    } catch (err) {
      console.error('Failed to create consolidated invoice:', err);
      setError(err instanceof Error ? err.message : 'Failed to create invoice. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Consolidated Sales Invoice"
      subtitle="Select multiple delivery challans to generate one consolidated invoice"
      maxWidth="2xl"
    >
      <div className="space-y-4">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center gap-2 font-medium">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div>
          <label className="form-label">Select Customer</label>
          <select
            value={selectedCustomerId}
            onChange={(e) => {
              setSelectedCustomerId(e.target.value);
              setSelectedDispatchIds(new Set());
            }}
            className="form-select"
          >
            <option value="">Select a customer...</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.company || c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="form-label">Price Category</label>
          <select
            value={priceCategory}
            onChange={(e) => setPriceCategory(e.target.value as PriceCategory)}
            className="form-select"
          >
            <option value="A">Category A</option>
            <option value="B">Category B</option>
            <option value="C">Category C</option>
            <option value="D">Category D</option>
          </select>
        </div>

        <div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={includeGst}
              onChange={(e) => setIncludeGst(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300"
            />
            <span className="text-sm text-slate-700">Include GST</span>
          </label>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : selectedCustomerId ? (
          <div>
            <label className="form-label">Select Delivery Challans</label>
            <div className="border border-slate-200 rounded-xl max-h-64 overflow-y-auto">
              {eligibleDispatches.length === 0 ? (
                <div className="p-4 text-center text-slate-500 text-sm">
                  No eligible delivery challans found for this customer.
                </div>
              ) : (
                eligibleDispatches.map((dispatch) => {
                  const totalQuantity = dispatch.items.reduce((sum, item) => sum + item.quantity, 0);
                  const billedQuantity = dispatch.billedQuantity || 0;
                  const remainingQuantity = totalQuantity - billedQuantity;
                  const isSelected = selectedDispatchIds.has(dispatch.id);

                  return (
                    <div
                      key={dispatch.id}
                      className={`p-3 border-b border-slate-100 flex items-center gap-3 cursor-pointer hover:bg-slate-50 ${
                        isSelected ? 'bg-blue-50' : ''
                      }`}
                      onClick={() => handleDispatchToggle(dispatch.id)}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleDispatchToggle(dispatch.id)}
                        className="w-4 h-4 rounded border-slate-300"
                      />
                      <div className="flex-1">
                        <div className="font-semibold text-slate-900 text-sm">
                          {dispatch.dispatchNumber}
                        </div>
                        <div className="text-xs text-slate-500">
                          {dispatch.dispatchDate} • {dispatch.items.length} items
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium text-slate-900 text-sm">
                          {remainingQuantity.toLocaleString()} pcs
                        </div>
                        <div className="text-xs text-slate-500">
                          {billedQuantity > 0 ? `${billedQuantity.toLocaleString()} billed` : 'Unbilled'}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        ) : (
          <div className="p-4 text-center text-slate-500 text-sm">
            Please select a customer to view eligible delivery challans.
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || selectedDispatchIds.size === 0}
            className="btn-primary"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Creating...</span>
              </>
            ) : (
              <>
                <IndianRupee className="w-4 h-4" />
                <span>Create Invoice</span>
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
};
