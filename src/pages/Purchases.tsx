import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PurchaseOrder, PurchaseStatus, PurchasePaymentStatus, RawMaterialCategory } from '../types';
import { getPurchases, updatePurchaseStatus, deletePurchase } from '../services/db';
import { Badge } from '../components/common/Badge';
import {
  Search,
  Plus,
  Eye,
  IndianRupee,
  CheckCircle2,
  PackageCheck,
  TrendingDown,
  Layers,
  Trash2,
  Clock,
  Building2
} from 'lucide-react';

interface PurchasesProps {
  onOpenNewPurchaseModal: () => void;
  onOpenRecordPurchasePaymentModal: (purchaseId?: string) => void;
}

export const Purchases: React.FC<PurchasesProps> = ({
  onOpenNewPurchaseModal,
  onOpenRecordPurchasePaymentModal
}) => {
  const [searchParams] = useSearchParams();
  const [purchases, setPurchases] = useState<PurchaseOrder[]>([]);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPurchasesData();
  }, []);

  const loadPurchasesData = async () => {
    setLoading(true);
    try {
      const list = await getPurchases();
      setPurchases(list);
    } catch (e) {
      console.error('Error loading purchases:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleReceiveStock = async (purchaseId: string) => {
    try {
      await updatePurchaseStatus(purchaseId, 'received');
      loadPurchasesData();
    } catch (e) {
      console.error('Error receiving stock:', e);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this purchase entry?')) {
      try {
        await deletePurchase(id);
        loadPurchasesData();
      } catch (e) {
        console.error('Error deleting purchase:', e);
      }
    }
  };

  const supplierNames = Array.from(new Set(purchases.map((p) => p.supplierName)));

  // Filtering
  const filteredPurchases = purchases.filter((p) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      p.purchaseNumber.toLowerCase().includes(q) ||
      p.supplierName.toLowerCase().includes(q) ||
      p.items.some((i) => i.rawMaterialName.toLowerCase().includes(q) || i.category.toLowerCase().includes(q));

    const matchesSupplier = supplierFilter === 'all' || p.supplierName === supplierFilter;
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    const matchesPayment = paymentFilter === 'all' || p.paymentStatus === paymentFilter;
    const matchesCategory = categoryFilter === 'all' || p.items.some((i) => i.category === categoryFilter);

    return matchesSearch && matchesSupplier && matchesStatus && matchesPayment && matchesCategory;
  });

  // Metrics
  const totalSpend = purchases.reduce((sum, p) => sum + p.totalAmount, 0);
  const totalQtyPurchased = purchases.reduce((sum, p) => sum + p.totalQuantity, 0);
  const receivedCount = purchases.filter((p) => p.status === 'received' || p.status === 'completed').length;
  const totalUnpaidBalance = purchases.reduce((sum, p) => sum + Math.max(0, p.totalAmount - p.paidAmount), 0);

  return (
    <div className="space-y-6">
      {/* Header & Main Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Purchases</h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Raw material purchase entries, supplier orders, and automatic inventory stock updates
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => onOpenRecordPurchasePaymentModal()}
            className="px-3.5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl transition-colors flex items-center space-x-1.5"
          >
            <IndianRupee className="w-4 h-4 text-emerald-400" />
            <span>Record Payment</span>
          </button>
          <button
            onClick={onOpenNewPurchaseModal}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-md shadow-blue-500/20 transition-colors flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>New Purchase Entry</span>
          </button>
        </div>
      </div>

      {/* Overview Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded-3xl border border-slate-100 shadow-sm flex items-center space-x-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <PackageCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total Purchase Spend</div>
            <div className="text-xl font-bold text-slate-900">₹{totalSpend.toLocaleString('en-IN')}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">{purchases.length} total purchase orders</div>
          </div>
        </div>

        <div className="p-4 bg-white rounded-3xl border border-slate-100 shadow-sm flex items-center space-x-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Received & In Stock</div>
            <div className="text-xl font-bold text-slate-900">{receivedCount} Orders</div>
            <div className="text-[11px] text-emerald-600 font-medium mt-0.5">Stock maintained in Raw Materials</div>
          </div>
        </div>

        <div className="p-4 bg-white rounded-3xl border border-slate-100 shadow-sm flex items-center space-x-4">
          <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Volume Purchased</div>
            <div className="text-xl font-bold text-slate-900">{totalQtyPurchased.toLocaleString()} Units/Kg</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Granules, polymers & packaging</div>
          </div>
        </div>

        <div className="p-4 bg-white rounded-3xl border border-slate-100 shadow-sm flex items-center space-x-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
            <TrendingDown className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Unpaid Supplier Balance</div>
            <div className="text-xl font-bold text-rose-600">₹{totalUnpaidBalance.toLocaleString('en-IN')}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Pending supplier disbursements</div>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search Box */}
          <div className="lg:col-span-2 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search PO number, supplier, or material..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 text-xs font-medium text-slate-800 rounded-xl border border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          {/* Supplier Filter */}
          <div>
            <select
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 text-xs font-medium text-slate-700 rounded-xl border border-slate-200 focus:bg-white"
            >
              <option value="all">All Suppliers</option>
              {supplierNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          {/* Purchase Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 text-xs font-medium text-slate-700 rounded-xl border border-slate-200 focus:bg-white"
            >
              <option value="all">Delivery Status</option>
              <option value="received">Received</option>
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {/* Payment Status Filter */}
          <div>
            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 text-xs font-medium text-slate-700 rounded-xl border border-slate-200 focus:bg-white"
            >
              <option value="all">Payment Status</option>
              <option value="pending">Unpaid</option>
              <option value="partially_paid">Partially Paid</option>
              <option value="paid">Fully Paid</option>
            </select>
          </div>
        </div>
      </div>

      {/* Purchases Data Table */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="py-3.5 px-4">PO Number</th>
                <th className="py-3.5 px-4">Date</th>
                <th className="py-3.5 px-4">Supplier</th>
                <th className="py-3.5 px-4">Raw Material Details</th>
                <th className="py-3.5 px-4">Quantity</th>
                <th className="py-3.5 px-4">Total Amount</th>
                <th className="py-3.5 px-4">Payment</th>
                <th className="py-3.5 px-4">Stock Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
              {filteredPurchases.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400 font-medium">
                    No purchase entries match your criteria.
                  </td>
                </tr>
              ) : (
                filteredPurchases.map((po) => {
                  const mainItem = po.items[0];
                  return (
                    <tr key={po.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-bold">
                        <Link to={`/purchases/${po.id}`} className="text-blue-600 hover:underline">
                          {po.purchaseNumber}
                        </Link>
                      </td>
                      <td className="py-3.5 px-4 text-slate-500">{po.purchaseDate}</td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          <span>{po.supplierName}</span>
                        </div>
                        {po.supplierPhone && <div className="text-[11px] text-slate-400">{po.supplierPhone}</div>}
                      </td>
                      <td className="py-3.5 px-4">
                        {mainItem ? (
                          <div>
                            <div className="font-semibold text-slate-800">{mainItem.rawMaterialName}</div>
                            <div className="text-[11px] text-slate-400 capitalize">
                              Cat: {mainItem.category} | Rate: ₹{mainItem.unitCost.toFixed(2)}/{mainItem.unit}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400">Multiple Items</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        {po.totalQuantity.toLocaleString()} {mainItem ? mainItem.unit : ''}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        ₹{po.totalAmount.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3.5 px-4">
                        <Badge status={po.paymentStatus} />
                      </td>
                      <td className="py-3.5 px-4">
                        {po.stockAdded ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 mr-1" /> Stock Updated
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock className="w-3 h-3 mr-1" /> Pending Stock
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          <Link
                            to={`/purchases/${po.id}`}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                            title="View Purchase Details"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>

                          {!po.stockAdded && (po.status === 'pending' || po.status === 'ordered' as any) && (
                            <button
                              onClick={() => handleReceiveStock(po.id)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                              title="Mark as Received & Add Stock"
                            >
                              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            </button>
                          )}

                          {po.paymentStatus !== 'paid' && (
                            <button
                              onClick={() => onOpenRecordPurchasePaymentModal(po.id)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-purple-600 hover:bg-purple-50 transition-colors"
                              title="Record Supplier Payment"
                            >
                              <IndianRupee className="w-4 h-4" />
                            </button>
                          )}

                          <button
                            onClick={() => handleDelete(po.id)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            title="Delete Purchase Entry"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
