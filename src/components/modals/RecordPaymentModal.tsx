import React, { useState, useEffect, useRef } from 'react';
import { Modal } from '../common/Modal';
import { Order, PaymentMethod } from '../../types';
import { getOrders, addPayment, checkPaymentStatus } from '../../services/db';
import { cleanDecimalInput } from '../../utils/packetUtils';
import { IndianRupee, AlertCircle, RefreshCw, CheckCircle2, Loader2 } from 'lucide-react';

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
  const [amount, setAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('bank_transfer');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const [isTimedOut, setIsTimedOut] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const submissionInProgress = useRef(false);
  const activeReceiptIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setError('');
      setIsTimedOut(false);
      setSuccessMessage('');
      activeReceiptIdRef.current = null;
      loadOrders();
    }
  }, [isOpen]);

  const loadOrders = async () => {
    try {
      const orderList = await getOrders();
      // Filter out Cash Memo and AS orders
      const eligibleOrders = orderList.filter((o) => o.paymentType !== 'cash_memo' && o.orderType !== 'AS');
      setOrders(eligibleOrders);

      if (defaultOrderId) {
        const fullOrder = orderList.find((o) => o.id === defaultOrderId);
        if (fullOrder && fullOrder.orderType === 'AS') {
          setError('Payment not applicable for AS Order.');
          setSelectedOrderId('');
          setAmount('');
          return;
        }
      }

      const target = defaultOrderId
        ? eligibleOrders.find((o) => o.id === defaultOrderId)
        : eligibleOrders.find((o) => o.paymentStatus !== 'paid');

      if (target) {
        setSelectedOrderId(target.id);
        const pendingAmount = Math.max(0, target.totalAmount - target.paidAmount);
        setAmount(pendingAmount > 0 ? String(pendingAmount) : '');
      } else if (eligibleOrders.length > 0) {
        setSelectedOrderId(eligibleOrders[0].id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const selectedOrder = orders.find((o) => o.id === selectedOrderId);
  const pendingBalance = selectedOrder ? Math.max(0, selectedOrder.totalAmount - selectedOrder.paidAmount) : 0;

  const handleOrderChange = (orderId: string) => {
    setSelectedOrderId(orderId);
    activeReceiptIdRef.current = null;
    setIsTimedOut(false);
    setError('');
    setSuccessMessage('');
    const ord = orders.find((o) => o.id === orderId);
    if (ord) {
      const pending = Math.max(0, ord.totalAmount - ord.paidAmount);
      setAmount(pending > 0 ? String(pending) : '');
    }
  };

  const handleVerifyAndRetry = async () => {
    if (verifying || loading || !selectedOrder || !activeReceiptIdRef.current) return;

    setVerifying(true);
    setError('');
    const receiptId = activeReceiptIdRef.current;

    try {
      // 1. Check whether original operation actually succeeded on server
      const check = await checkPaymentStatus(receiptId, selectedOrder.id);
      if (check.recorded) {
        setIsTimedOut(false);
        setSuccessMessage(
          `Payment of ₹${check.payment?.amount || amount} was already confirmed on the server (Receipt: ${receiptId}). Balance is up to date.`
        );
        activeReceiptIdRef.current = null;
        setTimeout(() => {
          if (onPaymentRecorded) onPaymentRecorded();
          onClose();
        }, 1200);
        return;
      }

      // 2. Not recorded: safe to retry with the same receipt ID
      const parsedAmount = Number(amount);
      await addPayment({
        id: receiptId,
        receiptNumber: receiptId,
        orderId: selectedOrder.id,
        orderNumber: selectedOrder.orderNumber,
        customerId: selectedOrder.customerId,
        customerName: selectedOrder.companyName || selectedOrder.customerName,
        amount: parsedAmount,
        paymentMethod,
        paymentDate,
        notes: notes.trim()
      });

      activeReceiptIdRef.current = null;
      setIsTimedOut(false);
      if (onPaymentRecorded) onPaymentRecorded();
      onClose();
    } catch (err) {
      console.error('Verify & retry error:', err);
      const isTimeoutError = err instanceof Error && (
        err.message.includes('timed out') ||
        err.message.includes('Firestore operation timed out') ||
        err.message.includes('timeout')
      );
      if (isTimeoutError) {
        setIsTimedOut(true);
        setError('Operation timed out again. Click "Verify & Retry" to check if the server processed it.');
      } else {
        setIsTimedOut(false);
        setError(err instanceof Error ? err.message : 'Failed to record payment.');
      }
    } finally {
      setVerifying(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submissionInProgress.current || loading || verifying) return;
    if (!selectedOrder) {
      setError('Please select an eligible order.');
      return;
    }
    if (selectedOrder.orderType === 'AS') {
      setError('Payment not applicable for AS Order.');
      return;
    }
    const parsedAmount = Number(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      setError('Please enter a payment amount greater than 0.');
      return;
    }

    if (isTimedOut && activeReceiptIdRef.current) {
      await handleVerifyAndRetry();
      return;
    }

    const receiptNumber = `REC-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    activeReceiptIdRef.current = receiptNumber;

    submissionInProgress.current = true;
    setLoading(true);
    setError('');
    setIsTimedOut(false);
    setSuccessMessage('');

    try {
      await addPayment({
        id: receiptNumber,
        receiptNumber,
        orderId: selectedOrder.id,
        orderNumber: selectedOrder.orderNumber,
        customerId: selectedOrder.customerId,
        customerName: selectedOrder.companyName || selectedOrder.customerName,
        amount: parsedAmount,
        paymentMethod,
        paymentDate,
        notes: notes.trim()
      });

      activeReceiptIdRef.current = null;
      if (onPaymentRecorded) onPaymentRecorded();
      onClose();
    } catch (err) {
      console.error('Payment submission failed:', err);
      const isTimeoutError = err instanceof Error && (
        err.message.includes('timed out') ||
        err.message.includes('Firestore operation timed out') ||
        err.message.includes('timeout')
      );

      if (isTimeoutError) {
        setIsTimedOut(true);
        setError('Firestore operation timed out while waiting for server confirmation. The payment might have already succeeded. Click "Verify & Retry" to check server status before retrying.');
      } else {
        activeReceiptIdRef.current = null;
        setIsTimedOut(false);
        setError(err instanceof Error ? err.message : 'Failed to record payment.');
      }
    } finally {
      submissionInProgress.current = false;
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
        {successMessage && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2 font-medium">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{successMessage}</span>
          </div>
        )}

        {error && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl space-y-2.5">
            <div className="flex items-start gap-2 font-medium">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
              <span className="leading-relaxed">{error}</span>
            </div>
            {isTimedOut && (
              <div className="pt-1 flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleVerifyAndRetry}
                  disabled={verifying}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs rounded-lg transition-colors flex items-center gap-1.5 shadow-xs"
                >
                  {verifying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  <span>{verifying ? 'Checking Server Status...' : 'Verify Server & Safe Retry'}</span>
                </button>
              </div>
            )}
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
              onChange={(e) => {
                setAmount(cleanDecimalInput(e.target.value));
                activeReceiptIdRef.current = null;
                setIsTimedOut(false);
                setError('');
              }}
              className="form-input font-semibold"
            />
          </div>

          <div>
            <label className="form-label">Payment Method</label>
            <select
              value={paymentMethod}
              onChange={(e) => {
                setPaymentMethod(e.target.value as PaymentMethod);
                activeReceiptIdRef.current = null;
                setIsTimedOut(false);
                setError('');
              }}
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
              onChange={(e) => {
                setPaymentDate(e.target.value);
                activeReceiptIdRef.current = null;
                setIsTimedOut(false);
                setError('');
              }}
              className="form-input"
            />
          </div>

          <div>
            <label className="form-label">Reference / UTR / Cheque Notes</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                activeReceiptIdRef.current = null;
                setIsTimedOut(false);
                setError('');
              }}
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
            disabled={loading || verifying}
            className="btn-primary !bg-emerald-600 hover:!bg-emerald-700"
          >
            {verifying ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Checking Server...</span>
              </>
            ) : loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Recording...</span>
              </>
            ) : isTimedOut ? (
              <>
                <RefreshCw className="w-4 h-4" />
                <span>Verify & Retry</span>
              </>
            ) : (
              <>
                <IndianRupee className="w-4 h-4" />
                <span>Record Payment</span>
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
};
