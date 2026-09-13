import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Order } from '../types';
import { getOrders, uploadOrderSignedCopy, removeOrderSignedCopy } from '../services/db';
import { Badge } from '../components/common/Badge';
import { EditOrderItemsModal } from '../components/modals/EditOrderItemsModal';
import {
  ArrowLeft,
  Printer,
  IndianRupee,
  Truck,
  Edit,
  Building,
  User,
  Calendar,
  CheckCircle,
  FileText
  , UploadCloud
  , Download
  , Trash2
  , Loader2
  , AlertCircle
} from 'lucide-react';

interface OrderDetailsProps {
  onOpenRecordPaymentModal: (orderId?: string) => void;
  onOpenNewDispatchModal: (orderId?: string) => void;
}

export const OrderDetails: React.FC<OrderDetailsProps> = ({
  onOpenRecordPaymentModal,
  onOpenNewDispatchModal
}) => {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [signedCopyFile, setSignedCopyFile] = useState<File | null>(null);
  const [signedCopyLoading, setSignedCopyLoading] = useState(false);
  const [signedCopyError, setSignedCopyError] = useState('');

  useEffect(() => {
    loadOrder();
  }, [orderId]);

  const loadOrder = async () => {
    setLoading(true);
    try {
      const list = await getOrders();
      const found = list.find((o) => o.id === orderId || o.orderNumber === orderId);
      if (found) {
        setOrder(found);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSignedCopySelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!orderId) return;
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const supportedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (!supportedTypes.includes(file.type)) {
      setSignedCopyError('Unsupported file type. Upload a PDF, JPG, JPEG, PNG, or WebP file.');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setSignedCopyError('The signed copy must be smaller than 20 MB.');
      return;
    }

    setSignedCopyFile(file);
    setSignedCopyError('');
    setSignedCopyLoading(true);
    try {
      const updated = await uploadOrderSignedCopy(orderId, file);
      setOrder(updated);
      setSignedCopyFile(null);
    } catch (error) {
      console.error('Signed copy upload failed:', error);
      setSignedCopyError(error instanceof Error ? error.message : 'Failed to upload the signed copy.');
    } finally {
      setSignedCopyLoading(false);
    }
  };

  const handleRemoveSignedCopy = async () => {
    if (!order || !order.signedCopy || !window.confirm('Remove the signed copy from this sales order?')) return;
    setSignedCopyLoading(true);
    setSignedCopyError('');
    try {
      const updated = await removeOrderSignedCopy(order.id);
      setOrder(updated);
    } catch (error) {
      console.error('Signed copy removal failed:', error);
      setSignedCopyError(error instanceof Error ? error.message : 'Failed to remove the signed copy.');
    } finally {
      setSignedCopyLoading(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-xs text-slate-400 font-medium">Loading order details...</div>;
  }

  if (!order) {
    return (
      <div className="p-8 text-center space-y-3">
        <p className="text-sm font-semibold text-slate-700">Order not found.</p>
        <Link to="/sales" className="text-xs text-blue-600 font-semibold hover:underline">
          Back to Sales & Orders
        </Link>
      </div>
    );
  }

  const pendingBalance = Math.max(0, order.totalAmount - order.paidAmount);

  return (
    <div className="space-y-6">
      {/* Top Header & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center space-x-3">
          <Link
            to="/sales"
            className="p-2 rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center space-x-3">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{order.orderNumber}</h1>
              <Badge status={order.orderStatus} size="md" />
              <Badge status={order.paymentStatus} size="md" />
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">Order Placed on {order.orderDate}</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => window.print()}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold text-xs rounded-xl shadow-sm transition-colors flex items-center space-x-1.5"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Invoice</span>
          </button>
          <button
            onClick={() => setIsEditModalOpen(true)}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl transition-colors flex items-center space-x-1.5"
          >
            <Edit className="w-3.5 h-3.5" />
            <span>Edit Order</span>
          </button>
          {order.paymentStatus !== 'paid' && (
            <button
              onClick={() => onOpenRecordPaymentModal(order.id)}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl transition-colors shadow-sm shadow-emerald-500/20 flex items-center space-x-1.5"
            >
              <IndianRupee className="w-3.5 h-3.5" />
              <span>Record Payment</span>
            </button>
          )}
          {order.orderStatus !== 'completed' && order.orderStatus !== 'cancelled' && (
            <button
              onClick={() => onOpenNewDispatchModal(order.id)}
              className="px-3.5 py-2 bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs rounded-xl transition-colors shadow-sm shadow-sky-500/20 flex items-center space-x-1.5"
            >
              <Truck className="w-3.5 h-3.5" />
              <span>New Dispatch</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Grid: Customer Card + Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Customer Information Card */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-3">
          <div className="flex items-center space-x-2 text-xs font-bold text-slate-800 uppercase tracking-wider">
            <Building className="w-4 h-4 text-blue-600" />
            <span>Customer Information</span>
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900">{order.companyName}</p>
            <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
              <User className="w-3.5 h-3.5 text-slate-400" />
              Contact: {order.customerName}
            </p>
          </div>
          {order.notes && (
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 text-xs text-amber-900">
              <span className="font-semibold block mb-0.5">Order Notes:</span>
              {order.notes}
            </div>
          )}
        </div>

        {/* Order Payment Status Card */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-3">
          <div className="flex items-center space-x-2 text-xs font-bold text-slate-800 uppercase tracking-wider">
            <IndianRupee className="w-4 h-4 text-emerald-600" />
            <span>Financial Summary</span>
          </div>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Total Invoice Amount:</span>
              <span className="font-bold text-slate-900">₹{order.totalAmount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Amount Paid:</span>
              <span className="font-bold text-emerald-600">₹{order.paidAmount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-slate-800 font-bold pt-2 border-t border-slate-100">
              <span>Balance Outstanding:</span>
              <span className="text-rose-600">₹{pendingBalance.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Dispatch & Delivery Log */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-3">
          <div className="flex items-center space-x-2 text-xs font-bold text-slate-800 uppercase tracking-wider">
            <Truck className="w-4 h-4 text-sky-600" />
            <span>Fulfillment Log</span>
          </div>
          <div className="text-xs text-slate-600 space-y-1">
            <p>Order Status: <span className="font-semibold text-slate-900 capitalize">{order.orderStatus}</span></p>
            <p className="text-[11px] text-slate-400">Inventory automatically deducted upon completed dispatch.</p>
          </div>
        </div>
      </div>

      {/* Party Signed Copy */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className={`p-2.5 rounded-xl ${order.signedCopy ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
              {order.signedCopy ? <FileText className="w-5 h-5" /> : <UploadCloud className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Party Signed Copy</h2>
              <p className={`text-xs font-medium mt-1 ${order.signedCopy ? 'text-emerald-700' : 'text-slate-500'}`}>
                {order.signedCopy ? 'Uploaded' : 'Not Uploaded'}
              </p>
              {order.signedCopy && <p className="text-[11px] text-slate-400 mt-1 truncate max-w-[280px]">{order.signedCopy.fileName}</p>}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {order.signedCopy && (
              <>
                <a href={order.signedCopy.downloadUrl} target="_blank" rel="noreferrer" className="px-3 py-2 bg-white border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-50 inline-flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" /> View
                </a>
                <a href={order.signedCopy.downloadUrl} download={order.signedCopy.fileName} className="px-3 py-2 bg-white border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-50 inline-flex items-center gap-1.5">
                  <Download className="w-3.5 h-3.5" /> Download
                </a>
                <button type="button" onClick={handleRemoveSignedCopy} disabled={signedCopyLoading} className="p-2 text-rose-600 border border-rose-100 rounded-xl hover:bg-rose-50 disabled:opacity-50" title="Remove signed copy" aria-label="Remove signed copy">
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
            <label className={`px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 cursor-pointer ${signedCopyLoading ? 'opacity-60 pointer-events-none' : ''}`}>
              {signedCopyLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UploadCloud className="w-3.5 h-3.5" />}
              {signedCopyLoading ? 'Uploading...' : order.signedCopy ? 'Replace Copy' : 'Upload Signed Copy'}
              <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={handleSignedCopySelected} disabled={signedCopyLoading} className="hidden" />
            </label>
          </div>
        </div>
        {signedCopyError && (
          <div className="mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2 font-medium">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{signedCopyError}</span>
          </div>
        )}
        <p className="text-[11px] text-slate-400 mt-3">Accepted: PDF, JPG, JPEG, PNG, or WebP up to 20 MB.</p>
      </div>

      {/* Items Breakdown Table */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden p-6 space-y-4">
        <h2 className="text-base font-bold text-slate-900">Order Items Specification</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-4">Item Name</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Price Category</th>
                <th className="py-3 px-4">Unit Price</th>
                <th className="py-3 px-4">Quantity</th>
                <th className="py-3 px-4 text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700 font-medium">
              {order.items.map((item, idx) => (
                <tr key={idx}>
                  <td className="py-3.5 px-4 font-bold text-slate-900">{item.productName}</td>
                  <td className="py-3.5 px-4 capitalize">{item.productType}</td>
                  <td className="py-3.5 px-4">
                    <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-[11px] font-semibold">
                      Category {item.priceCategory}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">₹{item.unitPrice.toFixed(2)}</td>
                  <td className="py-3.5 px-4 font-semibold">{item.quantity.toLocaleString()}</td>
                  <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                    ₹{item.subtotal.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Invoice Math Footer */}
        <div className="flex justify-end pt-4 border-t border-slate-100">
          <div className="w-72 space-y-2 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal:</span>
              <span className="font-semibold">₹{order.subtotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>GST ({order.gstRate}%):</span>
              <span className="font-semibold">₹{order.gstAmount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-base font-bold text-slate-900 pt-2 border-t border-slate-200">
              <span>Grand Total:</span>
              <span className="text-blue-600">₹{order.totalAmount.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      <EditOrderItemsModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        order={order}
        onSaved={setOrder}
      />
    </div>
  );
};
