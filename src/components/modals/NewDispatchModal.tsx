import React, { useState, useEffect, useRef } from 'react';
import { Modal } from '../common/Modal';
import { Order, Dispatch, DispatchStatus, Product } from '../../types';
import { getOrders, getDispatches, addDispatch, getProducts } from '../../services/db';
import { getOrderDeliveryProgress, generateNextChallanNumber, getDispatchUnitsPerPacket, calculateDispatchPieces } from '../../utils/dispatchUtils';
import { canProductUseFractionalPackets, cleanDecimalInput } from '../../utils/packetUtils';
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
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [itemQuantities, setItemQuantities] = useState<Record<string, number | string>>({});
  const [itemLoosePieces, setItemLoosePieces] = useState<Record<string, number | string>>({});
  const [itemUnits, setItemUnits] = useState<Record<string, 'pieces' | 'packets'>>({});
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [dispatchDate, setDispatchDate] = useState(new Date().toISOString().split('T')[0]);
  const [status, setStatus] = useState<DispatchStatus>('dispatched');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const submissionInProgress = useRef(false);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, defaultOrderId]);

  const loadData = async () => {
    try {
      const [orderList, dispatchList, productList] = await Promise.all([getOrders(), getDispatches(), getProducts()]);
      setOrders(orderList);
      setDispatches(dispatchList);
      setProducts(productList);

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
    const initialUnitMap: Record<string, 'pieces' | 'packets'> = {};
    progress.items.forEach((item) => {
      initialQtyMap[item.productId] = item.remainingQuantity;
      initialUnitMap[item.productId] = 'pieces';
    });
    setItemQuantities(initialQtyMap);
    setItemLoosePieces({});
    setItemUnits(initialUnitMap);
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

  const handleQuantityChange = (productId: string, valStr: string, maxLimit: number, unit: 'pieces' | 'packets', unitsPerPacket?: number) => {
    const cleaned = unit === 'packets' ? cleanDecimalInput(valStr) : valStr.replace(/\D/g, '');
    const entered = cleaned === '' ? 0 : Number(cleaned);
    const safeVal = Number.isFinite(entered) ? Math.max(0, entered) : 0;
    setItemQuantities((prev) => ({
      ...prev,
      [productId]: cleaned === '' ? '' : safeVal
    }));
    const loosePieces = Number(itemLoosePieces[productId] || 0);
    const pieces = calculateDispatchPieces(safeVal, unit, unitsPerPacket, loosePieces);
    if (pieces > maxLimit) {
      setError(`Only ${maxLimit.toLocaleString()} pieces remain for delivery.`);
    } else {
      setError('');
    }
  };

  const handleLoosePiecesChange = (productId: string, value: string, maxLimit: number, unitsPerPacket: number) => {
    const cleaned = value.replace(/\D/g, '');
    const loosePieces = cleaned === '' ? '' : Math.min(unitsPerPacket - 1, Number(cleaned));
    setItemLoosePieces((prev) => ({ ...prev, [productId]: loosePieces }));
    const packets = Number(itemQuantities[productId] || 0);
    const pieces = calculateDispatchPieces(packets, 'packets', unitsPerPacket, Number(loosePieces || 0));
    setError(pieces > maxLimit ? `Only ${maxLimit.toLocaleString()} pieces remain for delivery.` : '');
  };

  const handleFillRemaining = (productId: string, remaining: number) => {
    setItemUnits((prev) => ({ ...prev, [productId]: 'pieces' }));
    setItemQuantities((prev) => ({
      ...prev,
      [productId]: remaining
    }));
    setError('');
  };

  const totalDeliveringUnits = orderProgress?.items.reduce((sum, item) => {
    const orderItem = selectedOrder?.items.find((candidate) => candidate.productId === item.productId);
    const product = products.find((candidate) => candidate.id === item.productId);
    const value = Number(itemQuantities[item.productId] || 0);
    const unit = itemUnits[item.productId] || 'pieces';
    const loosePieces = Number(itemLoosePieces[item.productId] || 0);
    const unitsPerPacket = getDispatchUnitsPerPacket(orderItem, product);
    return sum + calculateDispatchPieces(value, unit, unitsPerPacket, loosePieces);
  }, 0) || 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submissionInProgress.current) return;
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
    const itemsToDispatch: Dispatch['items'] = [];
    for (const item of orderProgress.items) {
      const orderItem = selectedOrder.items.find((candidate) => candidate.productId === item.productId);
      const product = products.find((candidate) => candidate.id === item.productId);
      const unit = itemUnits[item.productId] || 'pieces';
      const enteredValue = Number(itemQuantities[item.productId] || 0);
      const loosePieces = Number(itemLoosePieces[item.productId] || 0);
      const unitsPerPacket = getDispatchUnitsPerPacket(orderItem, product);
      const enteredPieces = calculateDispatchPieces(enteredValue, unit, unitsPerPacket, loosePieces);
      if (unit === 'packets' && !unitsPerPacket && enteredValue > 0) {
        setError(`Packet size is not configured for ${item.productName}; use Pieces mode.`);
        return;
      }
      if (unit === 'packets' && (!Number.isInteger(loosePieces) || loosePieces < 0 || loosePieces >= (unitsPerPacket || 1))) {
        setError(`Loose pieces for ${item.productName} must be a whole number from 0 to ${(unitsPerPacket || 1) - 1}.`);
        return;
      }
      if (unit === 'packets' && !canProductUseFractionalPackets(product) && !Number.isInteger(enteredValue)) {
        setError(`${item.productName} does not allow fractional packets.`);
        return;
      }
      if (enteredPieces > item.remainingQuantity) {
        setError(
          orderProgress.items.length === 1
            ? `Only ${item.remainingQuantity.toLocaleString()} pieces remain for delivery.`
            : `Only ${item.remainingQuantity.toLocaleString()} pieces remain for delivery of ${item.productName}.`
        );
        return;
      }
      if (enteredPieces > 0) {
        itemsToDispatch.push({
          productId: item.productId,
          productName: item.productName,
          quantity: enteredPieces,
          deliveryUnit: unit,
          packetQuantity: unit === 'packets' ? enteredValue : undefined,
          loosePieces: unit === 'packets' ? loosePieces : undefined,
          unitsPerPacket: unit === 'packets' ? unitsPerPacket : undefined
        });
      }
    }

    if (itemsToDispatch.length === 0) {
      setError('Please specify a delivery quantity greater than 0 for at least one item.');
      return;
    }

    submissionInProgress.current = true;
    setLoading(true);
    setError('');
    try {
      await addDispatch({
        orderId: selectedOrder.id,
        orderNumber: selectedOrder.orderNumber,
        customerName: selectedOrder.companyName || selectedOrder.customerName,
        items: itemsToDispatch,
        dispatchDate,
        vehicleNumber: vehicleNumber.trim(),
        driverName: driverName.trim(),
        driverPhone: driverPhone.trim(),
        status,
        notes: notes.trim()
      });

      if (onDispatchCreated) onDispatchCreated();
      onClose();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to create sub-delivery challan.');
    } finally {
      submissionInProgress.current = false;
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
                    const orderItem = selectedOrder?.items.find((candidate) => candidate.productId === item.productId);
                    const product = products.find((candidate) => candidate.id === item.productId);
                    const unitsPerPacket = getDispatchUnitsPerPacket(orderItem, product);
                    const canUsePackets = Boolean(unitsPerPacket);
                    const unit = itemUnits[item.productId] || 'pieces';
                    const currentEntered = itemQuantities[item.productId] ?? (unit === 'pieces' ? item.remainingQuantity : '');
                    const enteredPieces = calculateDispatchPieces(
                      Number(currentEntered || 0),
                      unit,
                      unitsPerPacket,
                      Number(itemLoosePieces[item.productId] || 0)
                    );
                    const isOver = enteredPieces > item.remainingQuantity;

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
                            <div className="flex items-center justify-end gap-1 mb-1.5">
                              <button type="button" onClick={() => { setItemUnits((prev) => ({ ...prev, [item.productId]: 'pieces' })); setItemQuantities((prev) => ({ ...prev, [item.productId]: item.remainingQuantity })); }} className={`px-2 py-1 text-[10px] font-bold rounded-md ${unit === 'pieces' ? 'bg-sky-600 text-white' : 'bg-slate-200 text-slate-600'}`}>Pieces</button>
                              <button type="button" disabled={!canUsePackets} onClick={() => { setItemUnits((prev) => ({ ...prev, [item.productId]: 'packets' })); setItemQuantities((prev) => ({ ...prev, [item.productId]: '' })); }} className={`px-2 py-1 text-[10px] font-bold rounded-md ${unit === 'packets' ? 'bg-sky-600 text-white' : 'bg-slate-200 text-slate-600'} disabled:opacity-40`} title={canUsePackets ? 'Enter packets' : 'Packet size is not configured'}>Packets</button>
                            </div>
                            <input
                              type="number"
                              min="0"
                              step={unit === 'packets' && canProductUseFractionalPackets(product) ? 'any' : '1'}
                              value={currentEntered}
                              disabled={item.remainingQuantity === 0}
                              onChange={(e) =>
                                handleQuantityChange(item.productId, e.target.value, item.remainingQuantity, unit, unitsPerPacket)
                              }
                              className={`w-28 px-2.5 py-1 text-right text-xs font-bold rounded-lg border focus:ring-1 ${
                                isOver
                                  ? 'border-rose-400 bg-rose-50 text-rose-700 focus:ring-rose-400'
                                  : 'border-slate-300 bg-white text-slate-900 focus:ring-sky-500'
                              } disabled:bg-slate-100 disabled:text-slate-400`}
                            />
                            {unit === 'packets' && unitsPerPacket && (
                            <div className="mt-1">
                              <input
                                type="number"
                                min="0"
                                max={Math.max(0, unitsPerPacket - 1)}
                                step="1"
                                value={itemLoosePieces[item.productId] ?? ''}
                                onChange={(e) => handleLoosePiecesChange(item.productId, e.target.value, item.remainingQuantity, unitsPerPacket)}
                                className="w-28 px-2.5 py-1 text-right text-xs font-bold rounded-lg border border-amber-200 bg-amber-50/40"
                                placeholder="Loose pcs"
                              />
                            </div>
                            )}
                            <div className="text-[10px] text-slate-500 mt-1">
                            {unit === 'packets' && unitsPerPacket ? `${currentEntered || 0} packets × ${unitsPerPacket} + ${itemLoosePieces[item.productId] || 0} loose = ${enteredPieces.toLocaleString()} pcs` : `${enteredPieces.toLocaleString()} pcs`}
                            </div>
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
              placeholder="Enter vehicle number"
              value={vehicleNumber}
              onChange={(e) => setVehicleNumber(e.target.value)}
              className="form-input"
            />
          </div>

          <div>
            <label className="form-label">Driver Name</label>
            <input
              type="text"
              placeholder="Enter driver name"
              value={driverName}
              onChange={(e) => setDriverName(e.target.value)}
              className="form-input"
            />
          </div>

          <div>
            <label className="form-label">Driver Phone</label>
            <input
              type="text"
              placeholder="Enter driver phone"
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
