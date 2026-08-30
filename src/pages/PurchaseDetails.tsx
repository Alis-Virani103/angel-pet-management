import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { PurchaseOrder } from '../types';
import { getPurchases, updatePurchaseStatus } from '../services/db';
import { Badge } from '../components/common/Badge';
import {
  ArrowLeft,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  IndianRupee,
  Package,
  Printer,
  ShieldCheck,
  FileText
} from 'lucide-react';

interface PurchaseDetailsProps {
  onOpenRecordPurchasePaymentModal?: (purchaseId?: string) => void;
}

export const PurchaseDetails: React.FC<PurchaseDetailsProps> = ({
  onOpenRecordPurchasePaymentModal
}) => {
  const { purchaseId } = useParams<{ purchaseId: string }>();
  const navigate = useNavigate();
  const [purchase, setPurchase] = useState<PurchaseOrder | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (purchaseId) {
      loadPurchaseDetails();
    }
  }, [purchaseId]);

  const loadPurchaseDetails = async () => {
    setLoading(true);
    try {
      const list = await getPurchases();
      const target = list.find((p) => p.id === purchaseId || p.purchaseNumber === purchaseId);
      setPurchase(target || null);
    } catch (e) {
      console.error('Error loading purchase details:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkReceived = async () => {
    if (!purchase) return;
    try {
      const updated = await updatePurchaseStatus(purchase.id, 'received');
      setPurchase(updated);
    } catch (e) {
      console.error('Error updating purchase status:', e);
    }
  };

  if (loading) {
    return (
      <div className="py-12 text-center text-slate-400 font-medium">
        Loading purchase order details...
      </div>
    );
  }

  if (!purchase) {
    return (
      <div className="p-8 text-center bg-white rounded-3xl border border-slate-100 shadow-sm space-y-4">
        <h2 className="text-xl font-bold text-slate-800">Purchase Order Not Found</h2>
        <p className="text-xs text-slate-500">The requested purchase order record could not be found.</p>
        <Link
          to="/purchases"
          className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-semibold text-xs"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Purchases</span>
        </Link>
      </div>
    );
  }

  const remainingBalance = Math.max(0, purchase.totalAmount - purchase.paidAmount);

  return (
    <div className="space-y-6">
      {/* Top Bar with Navigation & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center space-x-3">
          <Link
            to="/purchases"
            className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
            title="Back to Purchase Orders"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{purchase.purchaseNumber}</h1>
              <Badge status={purchase.status} />
              <Badge status={purchase.paymentStatus} />
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Purchased on {purchase.purchaseDate}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => window.print()}
            className="px-3.5 py-2 bg-white border border-slate-200 text-slate-700 font-semibold text-xs rounded-xl hover:bg-slate-50 transition-colors flex items-center space-x-1.5"
          >
            <Printer className="w-4 h-4" />
            <span>Print PO</span>
          </button>

          {!purchase.stockAdded && (
            <button
              onClick={handleMarkReceived}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-md shadow-emerald-500/20 transition-colors flex items-center space-x-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Mark Received & Add Stock</span>
            </button>
          )}

          {purchase.paymentStatus !== 'paid' && onOpenRecordPurchasePaymentModal && (
            <button
              onClick={() => onOpenRecordPurchasePaymentModal(purchase.id)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-md shadow-blue-500/20 transition-colors flex items-center space-x-1.5"
            >
              <IndianRupee className="w-4 h-4" />
              <span>Record Supplier Payment</span>
            </button>
          )}
        </div>
      </div>

      {/* Stock Integration Status Alert */}
      <div
        className={`p-4 rounded-2xl border flex items-center justify-between text-xs font-medium ${
          purchase.stockAdded
            ? 'bg-emerald-50/80 border-emerald-200 text-emerald-800'
            : 'bg-amber-50/80 border-amber-200 text-amber-800'
        }`}
      >
        <div className="flex items-center space-x-3">
          {purchase.stockAdded ? (
            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <Clock className="w-5 h-5 text-amber-600 shrink-0" />
          )}
          <div>
            <div className="font-bold text-sm">
              {purchase.stockAdded ? 'Raw Materials Inventory Updated' : 'Stock Addition Pending'}
            </div>
            <div>
              {purchase.stockAdded
                ? 'The material quantities from this purchase order have been credited to the Raw Materials inventory.'
                : 'Stock will be credited to Raw Materials as soon as this purchase is marked as received.'}
            </div>
          </div>
        </div>

        {purchase.stockAdded && (
          <span className="px-3 py-1 bg-emerald-600 text-white font-bold rounded-lg text-[10px] uppercase tracking-wider shrink-0">
            Stock Idempotent (1x Added)
          </span>
        )}
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Supplier & Items */}
        <div className="lg:col-span-2 space-y-6">
          {/* Supplier Info Card */}
          <div className="p-6 bg-white rounded-3xl border border-slate-100 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-600" />
              <span>Supplier & Invoice Details</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <div className="text-slate-400 font-medium">Supplier Company</div>
                <div className="font-bold text-slate-900 text-sm mt-0.5">{purchase.supplierName}</div>
                {purchase.supplierPhone && (
                  <div className="text-slate-500 mt-0.5">{purchase.supplierPhone}</div>
                )}
              </div>

              <div>
                <div className="text-slate-400 font-medium">Order Reference & Date</div>
                <div className="font-semibold text-slate-800 mt-0.5">{purchase.purchaseNumber}</div>
                <div className="text-slate-500 flex items-center gap-1 mt-0.5">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{purchase.purchaseDate}</span>
                </div>
              </div>
            </div>

            {purchase.notes && (
              <div className="pt-3 border-t border-slate-100 text-xs">
                <div className="text-slate-400 font-medium mb-1">Order Notes</div>
                <div className="p-3 bg-slate-50 rounded-xl text-slate-700">{purchase.notes}</div>
              </div>
            )}
          </div>

          {/* Line Items Table */}
          <div className="p-6 bg-white rounded-3xl border border-slate-100 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Package className="w-4 h-4 text-blue-600" />
              <span>Purchased Raw Materials</span>
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/60 border-b border-slate-100 font-bold text-slate-400 uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Material Name</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Quantity</th>
                    <th className="py-3 px-4">Unit Cost</th>
                    <th className="py-3 px-4 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {purchase.items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="py-3.5 px-4 font-bold text-slate-900">{item.rawMaterialName}</td>
                      <td className="py-3.5 px-4 capitalize text-slate-600">{item.category}</td>
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        {item.quantity.toLocaleString()} {item.unit}
                      </td>
                      <td className="py-3.5 px-4 text-slate-800">₹{item.unitCost.toFixed(2)}</td>
                      <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                        ₹{item.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column: Cost & Payment Breakdown */}
        <div className="space-y-6">
          <div className="p-6 bg-slate-900 text-white rounded-3xl space-y-4">
            <h2 className="text-base font-bold flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-400" />
              <span>Purchase Payment Summary</span>
            </h2>

            <div className="space-y-3 text-xs border-b border-slate-800 pb-4">
              <div className="flex justify-between text-slate-400">
                <span>Material Subtotal:</span>
                <span className="font-semibold text-slate-200">
                  ₹{purchase.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="flex justify-between text-slate-400">
                <span>Input GST ({purchase.gstRate}%):</span>
                <span className="font-semibold text-slate-200">
                  ₹{purchase.gstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="flex justify-between text-sm font-bold text-white pt-2 border-t border-slate-800">
                <span>Grand Total:</span>
                <span className="text-blue-400">
                  ₹{purchase.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div className="space-y-2 text-xs pt-1">
              <div className="flex justify-between text-slate-400">
                <span>Paid Amount:</span>
                <span className="font-bold text-emerald-400">
                  ₹{purchase.paidAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="flex justify-between text-slate-400">
                <span>Remaining Balance:</span>
                <span className="font-bold text-rose-400">
                  ₹{remainingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {purchase.paymentStatus !== 'paid' && onOpenRecordPurchasePaymentModal && (
              <button
                onClick={() => onOpenRecordPurchasePaymentModal(purchase.id)}
                className="w-full mt-2 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-md shadow-blue-500/20 transition-colors flex items-center justify-center space-x-2"
              >
                <IndianRupee className="w-4 h-4" />
                <span>Record Payment</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
