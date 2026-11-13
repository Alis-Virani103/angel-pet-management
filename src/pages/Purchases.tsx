import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PurchaseOrder, PurchaseStatus, PurchasePaymentStatus, RawMaterialCategory } from '../types';
import { getPurchases, updatePurchaseStatus, deletePurchase } from '../services/db';
import { Badge } from '../components/common/Badge';
import { formatDate } from '../utils/dateUtils';
import {
  Search,
  Plus,
  Eye,
  Edit,
  IndianRupee,
  CheckCircle2,
  PackageCheck,
  TrendingDown,
  Layers,
  Trash2,
  Clock,
  Building2,
  Camera,
  X
} from 'lucide-react';
import { useTranslation } from '../i18n';
import { EditPurchaseItemsModal } from '../components/modals/EditPurchaseItemsModal';
import { BulkEditPurchasesModal } from '../components/modals/BulkEditPurchasesModal';
import { PurchasePhotosModal } from '../components/modals/PurchasePhotosModal';
import { canBulkReceivePurchase } from '../utils/purchaseBulkUtils';
import { useAuth } from '../auth/AuthContext';

interface PurchasesProps {
  onOpenNewPurchaseModal: () => void;
  onOpenRecordPurchasePaymentModal: (purchaseId?: string) => void;
}

export const Purchases: React.FC<PurchasesProps> = ({
  onOpenNewPurchaseModal,
  onOpenRecordPurchasePaymentModal
}) => {
  const { t } = useTranslation();
  const { can } = useAuth();
  const [searchParams] = useSearchParams();
  const [purchases, setPurchases] = useState<PurchaseOrder[]>([]);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [purchaseToEdit, setPurchaseToEdit] = useState<PurchaseOrder | null>(null);
  const [purchaseForPhotos, setPurchaseForPhotos] = useState<PurchaseOrder | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedPurchaseIds, setSelectedPurchaseIds] = useState<Set<string>>(new Set());
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [bulkMessage, setBulkMessage] = useState('');

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
    const items = p.items || [];
    const matchesSearch =
      (p.purchaseNumber || '').toLowerCase().includes(q) ||
      (p.supplierName || '').toLowerCase().includes(q) ||
      items.some((i) => (i.rawMaterialName || '').toLowerCase().includes(q) || (i.category || '').toLowerCase().includes(q));

    const matchesSupplier = supplierFilter === 'all' || p.supplierName === supplierFilter;
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    const matchesPayment = paymentFilter === 'all' || p.paymentStatus === paymentFilter;
    const matchesCategory = categoryFilter === 'all' || items.some((i) => i.category === categoryFilter);

    return matchesSearch && matchesSupplier && matchesStatus && matchesPayment && matchesCategory;
  });

  const visiblePurchaseIds = filteredPurchases.map((purchase) => purchase.id).join('|');
  const selectedPurchases = filteredPurchases.filter((purchase) => selectedPurchaseIds.has(purchase.id));
  const allFilteredSelected = filteredPurchases.length > 0 && filteredPurchases.every((purchase) => selectedPurchaseIds.has(purchase.id));

  useEffect(() => {
    if (!selectionMode) return;
    setSelectedPurchaseIds((current) => {
      const visible = new Set(visiblePurchaseIds.split('|').filter(Boolean));
      const next = new Set([...current].filter((id) => visible.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [visiblePurchaseIds, selectionMode]);

  const toggleSelectionMode = () => {
    if (selectionMode) {
      setSelectionMode(false);
      setSelectedPurchaseIds(new Set());
      setBulkMessage('');
    } else {
      setSelectionMode(true);
      setSelectedPurchaseIds(new Set());
      setBulkMessage('');
    }
  };

  const toggleSelectAll = () => {
    setSelectedPurchaseIds(allFilteredSelected ? new Set() : new Set(filteredPurchases.map((purchase) => purchase.id)));
  };

  const togglePurchaseSelection = (id: string) => {
    setSelectedPurchaseIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedPurchaseIds(new Set());
    setBulkMessage('');
  };

  const handleBulkReceive = async () => {
    const targets = selectedPurchases.filter(canBulkReceivePurchase);
    if (targets.length === 0) {
      setBulkMessage('No selected purchases are eligible to receive.');
      return;
    }

    setBulkActionLoading(true);
    setBulkMessage('');
    const updatedPurchases: PurchaseOrder[] = [];
    const failedNumbers: string[] = [];

    for (const target of targets) {
      try {
        updatedPurchases.push(await updatePurchaseStatus(target.id, 'received'));
      } catch (error) {
        console.error(`Failed to receive purchase ${target.purchaseNumber}:`, error);
        failedNumbers.push(target.purchaseNumber);
      }
    }

    if (updatedPurchases.length > 0) {
      setPurchases((current) =>
        current.map((purchase) => updatedPurchases.find((updated) => updated.id === purchase.id) || purchase)
      );
    }
    setSelectedPurchaseIds(new Set());
    setBulkMessage(
      failedNumbers.length > 0
        ? `Received ${updatedPurchases.length} purchase(s). Failed: ${failedNumbers.join(', ')}`
        : `Received ${updatedPurchases.length} purchase(s). Stock was added once per purchase.`
    );
    setBulkActionLoading(false);
  };

  // Metrics
  const totalSpend = purchases.reduce((sum, p) => sum + (p.totalAmount || 0), 0);
  const totalQtyPurchased = purchases.reduce((sum, p) => sum + (p.totalQuantity || 0), 0);
  const receivedCount = purchases.filter((p) => p.status === 'received' || p.status === 'completed').length;
  const totalUnpaidBalance = purchases.reduce((sum, p) => sum + Math.max(0, (p.totalAmount || 0) - (p.paidAmount || 0)), 0);

  return (
    <div className="space-y-6">
      {/* Header & Main Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{t('Purchases')}</h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Raw material purchase entries, supplier orders, and automatic inventory stock updates
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={toggleSelectionMode}
            className={`px-3.5 py-2.5 font-semibold text-xs rounded-xl transition-colors flex items-center space-x-1.5 ${
              selectionMode ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <span>{selectionMode ? 'Done' : 'Select'}</span>
          </button>
          {can('finance', 'create') && can('purchases', 'edit') && <button
            onClick={() => onOpenRecordPurchasePaymentModal()}
            className="px-3.5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl transition-colors flex items-center space-x-1.5"
          >
            <IndianRupee className="w-4 h-4 text-emerald-400" />
            <span>{t('Record Payment')}</span>
          </button>}
          {can('purchases', 'create') && <button
            onClick={onOpenNewPurchaseModal}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-md shadow-blue-500/20 transition-colors flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>{t('New Purchase Entry')}</span>
          </button>}
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
              placeholder={t('Search PO number, supplier, or material...')}
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
              <option value="all">{t('All Suppliers')}</option>
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
              <option value="all">{t('Delivery Status')}</option>
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
              <option value="all">{t('Payment Status')}</option>
              <option value="pending">Unpaid</option>
              <option value="partially_paid">Partially Paid</option>
              <option value="paid">Fully Paid</option>
            </select>
          </div>
        </div>
      </div>

      {selectionMode && (
        <div className="bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3 flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-blue-900">{selectedPurchases.length} selected</span>
          <button
            onClick={toggleSelectAll}
            className="px-3 py-1.5 rounded-lg bg-white border border-blue-200 text-blue-700 text-xs font-semibold hover:bg-blue-100"
          >
            {allFilteredSelected ? 'Deselect All' : 'Select All'}
          </button>
          <button
            onClick={() => setBulkEditOpen(true)}
            disabled={selectedPurchases.length === 0 || !can('purchases', 'edit')}
            className="px-3 py-1.5 rounded-lg bg-white border border-blue-200 text-blue-700 text-xs font-semibold hover:bg-blue-100 disabled:opacity-50"
          >
            Edit Selected
          </button>
          <button
            onClick={handleBulkReceive}
            disabled={bulkActionLoading || selectedPurchases.length === 0 || !selectedPurchases.some(canBulkReceivePurchase) || (!can('purchases', 'edit') && !can('purchases', 'approve'))}
            className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50"
          >
            {bulkActionLoading ? 'Receiving...' : 'Receive Stock'}
          </button>
          {bulkMessage && <span className="text-[11px] font-medium text-slate-600">{bulkMessage}</span>}
          <button
            onClick={exitSelectionMode}
            className="ml-auto inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-100"
          >
            <X className="w-3.5 h-3.5" />
            Cancel
          </button>
        </div>
      )}

      {/* Purchases Data Table */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                {selectionMode && (
                  <th className="py-3.5 px-4 w-10">
                    <input
                      type="checkbox"
                      checked={allFilteredSelected}
                      onChange={toggleSelectAll}
                      aria-label="Select all filtered purchases"
                      className="w-4 h-4 rounded border-slate-300"
                    />
                  </th>
                )}
                <th className="py-3.5 px-4">PO Number</th>
                <th className="py-3.5 px-4">Date</th>
                <th className="py-3.5 px-4">Supplier</th>
                <th className="py-3.5 px-4">Raw Material Details</th>
                <th className="py-3.5 px-4">Quantity</th>
                <th className="py-3.5 px-4">Total Amount</th>
                <th className="py-3.5 px-4">Payment</th>
                <th className="py-3.5 px-4">Stock Status</th>
                <th className="sticky right-0 z-20 w-56 bg-slate-50 py-3.5 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
              {filteredPurchases.length === 0 ? (
                <tr>
                  <td colSpan={selectionMode ? 10 : 9} className="py-12 text-center text-slate-400 font-medium">
                    No purchase entries match your criteria.
                  </td>
                </tr>
              ) : (
                filteredPurchases.map((po) => {
                  const purchaseItems = po.items || [];
                  const mainItem = purchaseItems[0];
                  return (
                    <tr key={po.id} className="hover:bg-slate-50/80 transition-colors">
                      {selectionMode && (
                        <td className="py-3.5 px-4">
                          <input
                            type="checkbox"
                            checked={selectedPurchaseIds.has(po.id)}
                            onChange={() => togglePurchaseSelection(po.id)}
                            aria-label={`Select purchase ${po.purchaseNumber}`}
                            className="w-4 h-4 rounded border-slate-300"
                          />
                        </td>
                      )}
                      <td className="py-3.5 px-4 font-bold">
                        <Link to={`/purchases/${po.id}`} className="text-blue-600 hover:underline">
                          {po.purchaseNumber}
                        </Link>
                      </td>
                      <td className="py-3.5 px-4 text-slate-500">{formatDate(po.purchaseDate)}</td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          <span>{po.supplierName || 'Unknown Supplier'}</span>
                        </div>
                        {po.supplierPhone && <div className="text-[11px] text-slate-400">{po.supplierPhone}</div>}
                      </td>
                      <td className="py-3.5 px-4">
                        {mainItem ? (
                          <div>
                            <div className="font-semibold text-slate-800">{purchaseItems.length > 1 ? `${purchaseItems.length} line items` : mainItem?.rawMaterialName || 'No item details'}</div>
                            <div className="text-[11px] text-slate-400 capitalize">
                              {purchaseItems.length > 1 ? purchaseItems.map((item) => item.rawMaterialName).join(', ') : mainItem ? `Cat: ${mainItem.category} | Rate: ₹${mainItem.unitCost.toFixed(2)}/${mainItem.unit}` : 'No item details'}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400">Multiple Items</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        {(po.totalQuantity || 0).toLocaleString()} {purchaseItems.length === 1 && mainItem ? mainItem.unit : 'total'}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        ₹{(po.totalAmount || 0).toLocaleString('en-IN')}
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
                      <td className="sticky right-0 z-10 w-56 bg-white py-3.5 px-4 group-hover:bg-slate-50">
                        <div className="grid grid-cols-2 gap-1.5">
                          <Link
                            to={`/purchases/${po.id}`}
                            className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg bg-slate-50 px-2 text-[10px] font-semibold text-slate-600 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                            title="View Purchase Details"
                            aria-label={`View purchase ${po.purchaseNumber}`}
                          >
                            <Eye className="w-4 h-4 shrink-0" />
                            <span>View</span>
                          </Link>

                          <button
                            onClick={() => setPurchaseForPhotos(po)}
                            className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg bg-slate-50 px-2 text-[10px] font-semibold text-slate-600 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                            title="Manage Photos"
                            aria-label={`Manage photos for purchase ${po.purchaseNumber}`}
                          >
                            <Camera className="w-4 h-4 shrink-0" />
                            <span>Photos</span>
                          </button>

                          {can('purchases', 'edit') && <button
                            onClick={() => setPurchaseToEdit(po)}
                            className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg bg-slate-50 px-2 text-[10px] font-semibold text-slate-600 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                            title="Edit Purchase"
                            aria-label={`Edit purchase ${po.purchaseNumber}`}
                          >
                            <Edit className="w-4 h-4 shrink-0" />
                            <span>Edit</span>
                          </button>}

                          {!po.stockAdded && (po.status === 'pending' || po.status === 'ordered' as any) && (can('purchases', 'edit') || can('purchases', 'approve')) && (
                            <button
                              onClick={() => handleReceiveStock(po.id)}
                              className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg bg-slate-50 px-2 text-[10px] font-semibold text-emerald-700 hover:bg-emerald-50 transition-colors"
                              title="Mark as Received & Add Stock"
                              aria-label={`Mark purchase ${po.purchaseNumber} as received and add stock`}
                            >
                              <CheckCircle2 className="w-4 h-4 shrink-0" />
                              <span>Receive</span>
                            </button>
                          )}

                          {po.paymentStatus !== 'paid' && can('finance', 'create') && can('purchases', 'edit') && (
                            <button
                              onClick={() => onOpenRecordPurchasePaymentModal(po.id)}
                              className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg bg-slate-50 px-2 text-[10px] font-semibold text-purple-700 hover:bg-purple-50 transition-colors"
                              title="Record Supplier Payment"
                              aria-label={`Record payment for purchase ${po.purchaseNumber}`}
                            >
                              <IndianRupee className="w-4 h-4 shrink-0" />
                              <span>Payment</span>
                            </button>
                          )}

                          {can('purchases', 'delete') && <button
                            onClick={() => handleDelete(po.id)}
                            className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg bg-slate-50 px-2 text-[10px] font-semibold text-rose-700 hover:bg-rose-50 transition-colors"
                            title="Delete Purchase Entry"
                            aria-label={`Delete purchase ${po.purchaseNumber}`}
                          >
                            <Trash2 className="w-4 h-4 shrink-0" />
                            <span>Delete</span>
                          </button>}
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

      {purchaseToEdit && (
        <EditPurchaseItemsModal
          isOpen
          purchase={purchaseToEdit}
          onClose={() => setPurchaseToEdit(null)}
          onSaved={(updatedPurchase) => {
            setPurchases((current) =>
              current.map((purchase) => purchase.id === updatedPurchase.id ? updatedPurchase : purchase)
            );
          }}
        />
      )}

      {purchaseForPhotos && (
        <PurchasePhotosModal
          isOpen
          purchase={purchaseForPhotos}
          onClose={() => setPurchaseForPhotos(null)}
          onPhotosUpdated={loadPurchasesData}
        />
      )}

      {bulkEditOpen && selectedPurchases.length > 0 && (
        <BulkEditPurchasesModal
          isOpen
          purchases={selectedPurchases}
          onClose={() => setBulkEditOpen(false)}
          onSaved={(updatedPurchases) => {
            setPurchases((current) =>
              current.map((purchase) => updatedPurchases.find((updated) => updated.id === purchase.id) || purchase)
            );
            setSelectedPurchaseIds(new Set());
            setBulkEditOpen(false);
            setBulkMessage(`Updated ${updatedPurchases.length} purchase(s).`);
          }}
        />
      )}
    </div>
  );
};
