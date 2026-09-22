import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Order, PaymentMethod } from '../../types';
import { getOrders, addPayment } from '../../services/db';
import { IndianRupee, AlertCircle } from 'lucide-react';

interface RecordPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultOrderId?: string;
  onPaymentRecorded?: () => void;
}

export const RecordPaymentModal: React.FC<RecordPaymentModalProps> = ({
  isOpen,
  onClose,
  defaultOrderId,
  onPaymentRecorded
}) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState(defaultOrderId || '');
  const [amount, setAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('bank_transfer');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
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

      const target = defaultOrderId
        ? orderList.find((o) => o.id === defaultOrderId)
        : orderList.find((o) => o.paymentStatus !== 'paid');

      if (target) {
        setSelectedOrderId(target.id);
        const pendingAmount = Math.max(0, target.totalAmount - target.paidAmount);
        setAmount(pendingAmount);
      } else if (orderList.length > 0) {
        setSelectedOrderId(orderList[0].id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const selectedOrder = orders.find((o) => o.id === selectedOrderId);
  const pendingBalance = selectedOrder ? Math.max(0, selectedOrder.totalAmount - selectedOrder.paidAmount) : 0;

  const handleOrderChange = (orderId: string) => {
    setSelectedOrderId(orderId);
    const ord = orders.find((o) => o.id === orderId);
    if (ord) {
      setAmount(Math.max(0, ord.totalAmount - ord.paidAmount));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) {
      setError('Please select an order.');
      return;
    }
    if (amount <= 0) {
      setError('Please enter a payment amount greater than 0.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await addPayment({
        orderId: selectedOrder.id,
        orderNumber: selectedOrder.orderNumber,
        customerId: selectedOrder.customerId,
        customerName: selectedOrder.companyName || selectedOrder.customerName,
        amount: Number(amount),
        paymentMethod,
        paymentDate,
        notes: notes.trim()
      });

      if (onPaymentRecorded) onPaymentRecorded();
      onClose();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to record payment.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Record Customer Payment"
      subtitle="Log collections against outstanding customer sales orders"
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2 font-medium">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div>
          <label className="form-label">Select Sales Order</label>
          <select
            value={selectedOrderId}
            onChange={(e) => handleOrderChange(e.target.value)}
            className="form-select"
          >
            {orders.map((o) => {
              const pending = Math.max(0, o.totalAmount - o.paidAmount);
              return (
                <option key={o.id} value={o.id}>
                  {o.orderNumber} — {o.companyName} (Pending: ₹{pending.toLocaleString()})
                </option>
              );
            })}
          </select>
        </div>

        {selectedOrder && (
          <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 space-y-1 text-xs text-slate-700">
            <div className="flex justify-between">
              <span>Customer:</span>
              <span className="font-semibold">{selectedOrder.companyName}</span>
            </div>
            <div className="flex justify-between">
              <span>Order Total Amount:</span>
              <span className="font-semibold">₹{selectedOrder.totalAmount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-blue-700 font-bold">
              <span>Outstanding Balance:</span>
              <span>₹{pendingBalance.toLocaleString()}</span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="form-label">Payment Amount (₹)</label>
            <input
              type="number"
              step="0.01"
              required
              max={pendingBalance > 0 ? pendingBalance : undefined}
              value={amount}
              onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
              className="form-input font-semibold"
            />
          </div>

          <div>
            <label className="form-label">Payment Method</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
              className="form-select"
            >
              <option value="bank_transfer">Bank Transfer (NEFT/RTGS)</option>
              <option value="upi">UPI / GPay / PhonePe</option>
              <option value="cheque">Cheque</option>
              <option value="cash">Cash</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="form-label">Payment Date</label>
            <input
              type="date"
              required
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="form-input"
            />
          </div>

          <div>
            <label className="form-label">Reference / UTR / Cheque Notes</label>
            <input
              type="text"
              placeholder="e.g. UTR129048109 or Bank Reference No."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="form-input"
            />
          </div>
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
            className="btn-primary !bg-emerald-600 hover:!bg-emerald-700"
          >
            <IndianRupee className="w-4 h-4" />
            <span>{loading ? 'Recording...' : 'Record Payment'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
