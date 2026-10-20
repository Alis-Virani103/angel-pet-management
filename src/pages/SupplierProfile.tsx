import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PurchaseOrder, Supplier } from '../types';
import { getPurchases, getSuppliers } from '../services/db';
import { ArrowLeft, Building, Calendar, IndianRupee, Phone, Truck } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';

export const SupplierProfile: React.FC = () => {
  const { can } = useAuth();
  const { supplierId } = useParams<{ supplierId: string }>();
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [purchases, setPurchases] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const supplierList = await getSuppliers();
        const found = supplierList.find((item) => item.id === supplierId);
        setSupplier(found || null);
        if (found && can('purchases', 'view')) {
          const purchaseList = await getPurchases();
          const supplierIdentity = (found.company || found.name).toLowerCase();
          setPurchases(purchaseList.filter((item) => item.supplierName.toLowerCase() === supplierIdentity));
        }
      } catch (error) {
        console.error('Error loading supplier profile:', error);
      } finally {
        setLoading(false);
      }
    };
    void loadProfile();
  }, [supplierId, can]);
  if (loading) return <div className="p-8 text-center text-xs text-slate-400">Loading supplier profile...</div>;
  if (!supplier) return <div className="p-8 text-center space-y-3"><p className="text-sm font-semibold">Supplier not found.</p><Link to="/suppliers" className="text-xs text-blue-600">Back to Supplier Directory</Link></div>;
  return <div className="space-y-6">
    <div className="flex items-center gap-3"><Link to="/suppliers" className="p-2 rounded-xl bg-white border border-slate-200"><ArrowLeft className="w-4 h-4" /></Link><div><h1 className="text-2xl font-bold text-slate-900">{supplier.company || 'Supplier Account'}</h1><p className="text-xs text-slate-500">{supplier.name}{supplier.phone ? ` · ${supplier.phone}` : ''}</p></div></div>
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4"><div className="bg-white p-5 rounded-2xl border border-slate-100"><div className="text-xs text-slate-400 uppercase">Total Purchases</div><div className="text-2xl font-bold mt-2">₹{supplier.totalPurchases.toLocaleString('en-IN')}</div></div><div className="bg-white p-5 rounded-2xl border border-slate-100"><div className="text-xs text-slate-400 uppercase">Total Paid</div><div className="text-2xl font-bold mt-2 text-emerald-600">₹{supplier.totalPaid.toLocaleString('en-IN')}</div></div><div className="bg-white p-5 rounded-2xl border border-slate-100"><div className="text-xs text-slate-400 uppercase">Outstanding</div><div className="text-2xl font-bold mt-2 text-rose-600">₹{supplier.totalOutstanding.toLocaleString('en-IN')}</div></div></div>
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6"><div className="bg-white p-6 rounded-3xl border border-slate-100 space-y-4"><h2 className="font-bold">Account Details</h2><div className="text-xs space-y-3"><div><Building className="w-4 h-4 inline mr-2 text-slate-400" />{supplier.company || '—'}</div><div><Truck className="w-4 h-4 inline mr-2 text-slate-400" />Contact: {supplier.name}</div><div><Phone className="w-4 h-4 inline mr-2 text-slate-400" />{supplier.phone || '—'}</div><div><Calendar className="w-4 h-4 inline mr-2 text-slate-400" />Added: {supplier.createdAt}</div><div>{supplier.address || 'No address recorded.'}</div></div></div><div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-100"><h2 className="font-bold mb-4">Purchase History</h2><div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr className="border-b text-slate-400"><th className="py-2">Purchase</th><th>Date</th><th>Total</th><th>Paid</th><th>Balance</th></tr></thead><tbody className="divide-y">{purchases.map((purchase) => <tr key={purchase.id}><td className="py-3">{purchase.purchaseNumber}</td><td>{purchase.purchaseDate}</td><td>₹{purchase.totalAmount.toLocaleString('en-IN')}</td><td className="text-emerald-700">₹{purchase.paidAmount.toLocaleString('en-IN')}</td><td className="text-rose-700">₹{Math.max(0, purchase.totalAmount - purchase.paidAmount).toLocaleString('en-IN')}</td></tr>)}</tbody></table></div></div></div>
  </div>;
};
