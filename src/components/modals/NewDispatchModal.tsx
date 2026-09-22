import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Order, DispatchStatus } from '../../types';
import { getOrders, addDispatch } from '../../services/db';
import { Truck, AlertCircle } from 'lucide-react';

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
  const [selectedOrderId, setSelectedOrderId] = useState('');
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
      loadOrders();
    }
  }, [isOpen]);

  const loadOrders = async () => {
    try {
      const orderList = await getOrders();
      setOrders(orderList);
      const dispatchableOrders = orderList.filter((o) => o.orderStatus !== 'completed' && o.orderStatus !== 'cancelled');
      const defaultOrder = dispatchableOrders.find((order) => order.id === defaultOrderId);
      setSelectedOrderId(defaultOrder?.id || dispatchableOrders[0]?.id || '');
    } catch (e) {
      console.error(e);
    }
  };

  const selectedOrder = orders.find((o) => o.id === selectedOrderId);

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

    setLoading(true);
    setError('');
    try {
      await addDispatch({
        orderId: selectedOrder.id,
        orderNumber: selectedOrder.orderNumber,
        customerName: selectedOrder.companyName || selectedOrder.customerName,
        items: selectedOrder.items.map((i) => ({
          productId: i.productId,
          productName: i.productName,
          quantity: i.quantity
        })),
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
      setError(err instanceof Error ? err.message : 'Failed to create dispatch record.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create New Dispatch Shipment"
      subtitle="Log delivery vehicle, driver details, and auto-update inventory"
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2 font-medium">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div>
          <label className="form-label">Select Order for Shipment</label>
          <select
            value={selectedOrderId}
            onChange={(e) => setSelectedOrderId(e.target.value)}
            className="form-select"
          >
            {orders.map((o) => (
              <option key={o.id} value={o.id}>
                {o.orderNumber} — {o.companyName} ({o.items.map((i) => `${i.quantity}x ${i.productName}`).join(', ')})
              </option>
            ))}
          </select>
        </div>

        {selectedOrder && (
          <div className="p-3 bg-slate-100 rounded-xl border border-slate-200 space-y-1 text-xs text-slate-700">
            <div className="font-semibold text-slate-800">Items to Dispatch:</div>
            <ul className="list-disc list-inside space-y-0.5 text-[11px] text-slate-600">
              {selectedOrder.items.map((item, idx) => (
                <li key={idx}>
                  {item.quantity.toLocaleString()} units of {item.productName}
                </li>
              ))}
            </ul>
          </div>
        )}

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
              placeholder="+91 98987 11223"
              value={driverPhone}
              onChange={(e) => setDriverPhone(e.target.value)}
              className="form-input"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="form-label">Dispatch Date</label>
            <input
              type="date"
              required
              value={dispatchDate}
              onChange={(e) => setDispatchDate(e.target.value)}
              className="form-input"
            />
          </div>

          <div>
            <label className="form-label">Shipment Status</label>
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
          <label className="form-label">Delivery Notes / LR Number</label>
          <input
            type="text"
            placeholder="e.g. Lorry Receipt LR-99120 or Gate Pass No."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="form-input"
          />
        </div>

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
            className="btn-primary !bg-sky-600 hover:!bg-sky-700"
          >
            <Truck className="w-4 h-4" />
            <span>{loading ? 'Creating...' : 'Log Shipment Entry'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
