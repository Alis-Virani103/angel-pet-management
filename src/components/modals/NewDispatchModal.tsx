import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Order, Dispatch, DispatchStatus } from '../../types';
import { getOrders, getDispatches, addDispatch } from '../../services/db';
import { getOrderDeliveryProgress, generateNextChallanNumber } from '../../utils/dispatchUtils';
import { Truck, AlertCircle, CheckCircle2, PackageCheck } from 'lucide-react';

interface NewDispatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDispatchCreated?: () => void;
  defaultOrderId?: string;
}

export const NewDispatchModal: React.FC<NewDispatchModalProps> = ({
  isOpen,
  onClose,
  onDispatchCreated,
  defaultOrderId
}) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [itemQuantities, setItemQuantities] = useState<Record<string, number>>({});
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [dispatchDate, setDispatchDate] = useState(new Date().toISOString().split('T')[0]);
  const [status, setStatus] = useState<DispatchStatus>('dispatched');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, defaultOrderId]);

  const loadData = async () => {
    try {
      const [orderList, dispatchList] = await Promise.all([getOrders(), getDispatches()]);
      setOrders(orderList);
      setDispatches(dispatchList);

      // Find orders that still have remaining items to deliver
      const eligibleOrders = orderList.filter((o) => {
        if (o.orderStatus === 'cancelled') return false;
        const progress = getOrderDeliveryProgress(o, dispatchList);
        return progress.totalRemainingQuantity > 0;
      });

      const matchedDefault = eligibleOrders.find((o) => o.id === defaultOrderId);
      const chosenOrderId = matchedDefault?.id || defaultOrderId || eligibleOrders[0]?.id || '';
      setSelectedOrderId(chosenOrderId);

      // Initialize quantities for selected order
      const target = orderList.find((o) => o.id === chosenOrderId);
      if (target) {
        initQuantities(target, dispatchList);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const initQuantities = (order: Order, dispatchList: Dispatch[]) => {
    const progress = getOrderDeliveryProgress(order, dispatchList);
    const initialQtyMap: Record<string, number> = {};
    progress.items.forEach((item) => {
      initialQtyMap[item.productId] = item.remainingQuantity;
    });
    setItemQuantities(initialQtyMap);
  };

  const handleOrderChange = (orderId: string) => {
    setSelectedOrderId(orderId);
    const target = orders.find((o) => o.id === orderId);
    if (target) {
      initQuantities(target, dispatches);
    }
    setError('');
  };

  const selectedOrder = orders.find((o) => o.id === selectedOrderId);
  const orderProgress = selectedOrder ? getOrderDeliveryProgress(selectedOrder, dispatches) : null;
  const nextChallanNumber = generateNextChallanNumber(dispatches);

  const handleQuantityChange = (productId: string, valStr: string, maxLimit: number) => {
    const val = parseInt(valStr, 10);
    const safeVal = isNaN(val) ? 0 : Math.max(0, val);
    setItemQuantities((prev) => ({
      ...prev,
      [productId]: safeVal
    }));
    if (safeVal > maxLimit) {
      setError(`Only ${maxLimit.toLocaleString()} units remain for delivery.`);
    } else {
      setError('');
    }
  };

  const handleFillRemaining = (productId: string, remaining: number) => {
    setItemQuantities((prev) => ({
      ...prev,
      [productId]: remaining
    }));
    setError('');
  };

  const totalDeliveringUnits = Object.values(itemQuantities).reduce((sum, q) => sum + (q || 0), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) {
      setError('Please select an order to dispatch.');
      return;
    }
    if (selectedOrder.orderStatus === 'cancelled') {
      setError('Cancelled orders cannot be dispatched.');
      return;
    }
    if (!orderProgress) {
      setError('Unable to calculate order progress.');
      return;
    }

    // Build items to dispatch
    const itemsToDispatch: { productId: string; productName: string; quantity: number }[] = [];
    for (const item of orderProgress.items) {
      const enteredQty = itemQuantities[item.productId] || 0;
      if (enteredQty > item.remainingQuantity) {
        setError(
          orderProgress.items.length === 1
            ? `Only ${item.remainingQuantity.toLocaleString()} units remain for delivery.`
            : `Only ${item.remainingQuantity.toLocaleString()} units remain for delivery of ${item.productName}.`
        );
        return;
      }
      if (enteredQty > 0) {
        itemsToDispatch.push({
          productId: item.productId,
          productName: item.productName,
          quantity: enteredQty
        });
      }
    }

    if (itemsToDispatch.length === 0) {
      setError('Please specify a delivery quantity greater than 0 for at least one item.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await addDispatch({
        orderId: selectedOrder.id,
        orderNumber: selectedOrder.orderNumber,
        customerName: selectedOrder.companyName || selectedOrder.customerName,
        items: itemsToDispatch,
        dispatchDate,
        vehicleNumber: vehicleNumber.trim() || 'GJ-06-AX-4890',
        driverName: driverName.trim() || 'Ramesh Patel',
        driverPhone: driverPhone.trim() || '+91 98987 11223',
        status,
        notes: notes.trim()
      });

      if (onDispatchCreated) onDispatchCreated();
      onClose();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to create sub-delivery challan.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Sub-Delivery / Sub-Challan"
      subtitle={`Generate Sub-Challan (${nextChallanNumber}) for sales order fulfillment`}
      maxWidth="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2 font-medium">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Order Selector */}
        <div>
          <label className="form-label">Select Sales Order for Delivery</label>
          <select
            value={selectedOrderId}
            onChange={(e) => handleOrderChange(e.target.value)}
            className="form-select"
          >
            {orders
              .filter((o) => o.orderStatus !== 'cancelled')
              .map((o) => {
                const prog = getOrderDeliveryProgress(o, dispatches);
                return (
                  <option key={o.id} value={o.id}>
                    {o.orderNumber} — {o.companyName || o.customerName} (Remaining: {prog.totalRemainingQuantity.toLocaleString()} / {prog.totalOrderedQuantity.toLocaleString()} units)
                  </option>
                );
              })}
          </select>
        </div>

        {/* Delivery Progress & Product Quantities per Item */}
        {orderProgress && (
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <PackageCheck className="w-4 h-4 text-sky-600" />
                Products & Sub-Delivery Quantities
              </span>
              <span className="text-[11px] font-semibold text-slate-500">
                Challan ID: <span className="font-mono font-bold text-sky-600">{nextChallanNumber}</span>
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="py-2 px-2">Product Name</th>
                    <th className="py-2 px-2 text-center">Ordered</th>
                    <th className="py-2 px-2 text-center">Delivered</th>
                    <th className="py-2 px-2 text-center">Remaining</th>
                    <th className="py-2 px-2 text-right">This Delivery Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70 text-slate-700">
                  {orderProgress.items.map((item) => {
                    const currentEntered = itemQuantities[item.productId] ?? item.remainingQuantity;
                    const isOver = currentEntered > item.remainingQuantity;

                    return (
                      <tr key={item.productId} className="hover:bg-white/60">
                        <td className="py-2.5 px-2 font-medium">
                          <div className="font-bold text-slate-900">{item.productName}</div>
                          {item.isFullyDelivered && (
                            <span className="text-[10px] font-semibold text-emerald-600">✓ Fully Delivered</span>
                          )}
                        </td>
                        <td className="py-2.5 px-2 text-center font-semibold">
                          {item.orderedQuantity.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-2 text-center text-slate-500 font-semibold">
                          {item.deliveredQuantity.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-2 text-center font-bold text-amber-600">
                          {item.remainingQuantity.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-2 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <input
                              type="number"
                              min="0"
                              max={item.remainingQuantity}
                              value={currentEntered}
                              disabled={item.remainingQuantity === 0}
                              onChange={(e) =>
                                handleQuantityChange(item.productId, e.target.value, item.remainingQuantity)
                              }
                              className={`w-28 px-2.5 py-1 text-right text-xs font-bold rounded-lg border focus:ring-1 ${
                                isOver
                                  ? 'border-rose-400 bg-rose-50 text-rose-700 focus:ring-rose-400'
                                  : 'border-slate-300 bg-white text-slate-900 focus:ring-sky-500'
                              } disabled:bg-slate-100 disabled:text-slate-400`}
                            />
                            <button
                              type="button"
                              onClick={() => handleFillRemaining(item.productId, item.remainingQuantity)}
                              disabled={item.remainingQuantity === 0}
                              className="px-2 py-1 text-[10px] font-bold text-sky-700 bg-sky-100 hover:bg-sky-200 rounded-md transition-colors disabled:opacity-40"
                              title="Fill remaining available balance"
                            >
                              Max
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Summary footer */}
            <div className="pt-2 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-600 gap-2">
              <div>
                Order Status: <span className="font-bold text-slate-800 capitalize">{selectedOrder?.orderStatus}</span>
                {orderProgress.subDeliveries.length > 0 && (
                  <span className="ml-2 text-slate-500">
                    ({orderProgress.subDeliveries.length} previous sub-challan{orderProgress.subDeliveries.length > 1 ? 's' : ''})
                  </span>
                )}
              </div>
              <div className="font-bold text-slate-900 bg-white px-3 py-1.5 rounded-xl border border-slate-200 inline-block">
                Total in this Sub-Delivery:{' '}
                <span className="text-sky-600 font-extrabold">{totalDeliveringUnits.toLocaleString()}</span> units
              </div>
            </div>
          </div>
        )}

        {/* Logistics & Vehicle Information */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="form-label">Vehicle Number</label>
            <input
              type="text"
              placeholder="e.g. GJ-06-AX-4890"
              value={vehicleNumber}
              onChange={(e) => setVehicleNumber(e.target.value)}
              className="form-input"
            />
          </div>

          <div>
            <label className="form-label">Driver Name</label>
            <input
              type="text"
              placeholder="e.g. Ramesh Patel"
              value={driverName}
              onChange={(e) => setDriverName(e.target.value)}
              className="form-input"
            />
          </div>

          <div>
            <label className="form-label">Driver Phone</label>
            <input
              type="text"
              placeholder="e.g. +91 98987 11223"
              value={driverPhone}
              onChange={(e) => setDriverPhone(e.target.value)}
              className="form-input"
            />
          </div>
        </div>

        {/* Date & Shipment Status */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="form-label">Delivery Date</label>
            <input
              type="date"
              required
              value={dispatchDate}
              onChange={(e) => setDispatchDate(e.target.value)}
              className="form-input"
            />
          </div>

          <div>
            <label className="form-label">Delivery Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as DispatchStatus)}
              className="form-select"
            >
              <option value="pending">Pending Preparation</option>
              <option value="ready">Ready for Pickup</option>
              <option value="dispatched">Dispatched (In Transit)</option>
              <option value="delivered">Delivered / Completed</option>
            </select>
          </div>
        </div>

        <div>
          <label className="form-label">Delivery Notes / LR Number / Comments</label>
          <input
            type="text"
            placeholder="e.g. LR No. 492021, Sent via Express Logistics"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="form-input"
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || totalDeliveringUnits <= 0}
            className="btn-primary !bg-sky-600 hover:!bg-sky-700 disabled:opacity-50"
          >
            <Truck className="w-4 h-4" />
            <span>{loading ? 'Creating...' : `Issue Sub-Challan (${nextChallanNumber})`}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
