import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { PurchaseOrder } from '../../types';
import { getPurchases, recordPurchasePayment } from '../../services/db';
import { IndianRupee, AlertCircle, CheckCircle2 } from 'lucide-react';

interface RecordPurchasePaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultPurchaseId?: string;
  onPaymentRecorded?: () => void;
}

export const RecordPurchasePaymentModal: React.FC<RecordPurchasePaymentModalProps> = ({
  isOpen,
  onClose,
  defaultPurchaseId,
  onPaymentRecorded
}) => {
  const [purchases, setPurchases] = useState<PurchaseOrder[]>([]);
  const [selectedPurchaseId, setSelectedPurchaseId] = useState<string>('');
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      setPaymentDate(new Date().toISOString().split('T')[0]);
      setNotes('');
      setError('');
      loadUnpaidPurchases();
    }
  }, [isOpen, defaultPurchaseId]);

  const loadUnpaidPurchases = async () => {
    try {
      const list = await getPurchases();
      const unpaid = list.filter((p) => p.paymentStatus !== 'paid');
      setPurchases(unpaid);

      const targetId = defaultPurchaseId || (unpaid.length > 0 ? unpaid[0].id : '');
      setSelectedPurchaseId(targetId);

      const targetPurchase = unpaid.find((p) => p.id === targetId);
      if (targetPurchase) {
        const remaining = targetPurchase.totalAmount - targetPurchase.paidAmount;
        setPaymentAmount(Math.max(0, remaining));
      } else {
        setPaymentAmount(0);
      }
    } catch (e) {
      console.error('Error loading purchases for payment:', e);
    }
  };

  const handlePurchaseSelect = (id: string) => {
    setSelectedPurchaseId(id);
    const target = purchases.find((p) => p.id === id);
    if (target) {
      const remaining = target.totalAmount - target.paidAmount;
      setPaymentAmount(Math.max(0, remaining));
    }
  };

  const selectedPurchase = purchases.find((p) => p.id === selectedPurchaseId);
  const remainingBalance = selectedPurchase
    ? Math.max(0, selectedPurchase.totalAmount - selectedPurchase.paidAmount)
    : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!selectedPurchaseId) {
      setError('Please select a purchase order.');
      return;
    }

    if (paymentAmount <= 0) {
      setError('Please enter a payment amount greater than 0.');
      return;
    }

    if (paymentAmount > remainingBalance) {
      setError(`Payment amount cannot exceed the remaining balance of ₹${remainingBalance.toLocaleString('en-IN')}`);
      return;
    }

    if (!paymentDate || Number.isNaN(Date.parse(`${paymentDate}T00:00:00`))) {
      setError('Please select a valid payment date.');
      return;
    }

    setLoading(true);
    try {
      await recordPurchasePayment(selectedPurchaseId, paymentAmount, paymentDate, notes.trim());
      if (onPaymentRecorded) onPaymentRecorded();
      onClose();
    } catch (err) {
      console.error('Failed to record purchase payment:', err);
      setError(err instanceof Error ? err.message : 'Failed to record supplier payment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Record Supplier Payment"
      subtitle="Log payment disbursed for raw material purchase invoices"
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
          <label className="form-label">Select Purchase Order</label>
          <select
            value={selectedPurchaseId}
            onChange={(e) => handlePurchaseSelect(e.target.value)}
            className="form-select"
          >
            {purchases.length === 0 ? (
              <option value="">No pending supplier invoices</option>
            ) : (
              purchases.map((p) => {
                const rem = p.totalAmount - p.paidAmount;
                return (
                  <option key={p.id} value={p.id}>
                    {p.purchaseNumber} — {p.supplierName} (Balance: ₹{rem.toLocaleString('en-IN')})
                  </option>
                );
              })
            )}
          </select>
        </div>

        {selectedPurchase && (
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Supplier:</span>
              <span className="font-semibold text-slate-900">{selectedPurchase.supplierName}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Invoice Total:</span>
              <span className="font-semibold text-slate-900">₹{selectedPurchase.totalAmount.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Paid So Far:</span>
              <span className="font-semibold text-emerald-600">₹{selectedPurchase.paidAmount.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between text-slate-900 font-bold pt-2 border-t border-slate-200">
              <span>Outstanding Balance:</span>
              <span className="text-rose-600">₹{remainingBalance.toLocaleString('en-IN')}</span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="form-label">Payment Amount (₹)</label>
            <input
              type="number"
              min={1}
              max={remainingBalance}
              step={1}
              required
              value={paymentAmount || ''}
              onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
              className="form-input font-bold"
            />
          </div>

          <div>
            <label className="form-label">Payment Date</label>
            <input type="date" required value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} className="form-input" />
          </div>
        </div>

        <div>
          <label className="form-label">Reference / Notes</label>
          <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. UTR / Bank Transfer Ref" className="form-input" />
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
            disabled={loading || !selectedPurchaseId}
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
