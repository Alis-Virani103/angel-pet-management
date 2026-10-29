  import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Supplier, SupplierStatus } from '../types';
import { getSuppliers, updateSupplier } from '../services/db';
import { Badge } from '../components/common/Badge';
import { Building2, Edit, Eye, Phone, Plus, Search, Truck, Wallet } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';

interface SuppliersProps { onOpenAddSupplierModal: (supplier?: Supplier) => void; }

export const Suppliers: React.FC<SuppliersProps> = ({ onOpenAddSupplierModal }) => {
  const { can } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try { setSuppliers(await getSuppliers()); } catch (error) { console.error('Error loading suppliers:', error); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const toggleStatus = async (supplier: Supplier) => {
    const next: SupplierStatus = supplier.status === 'active' ? 'inactive' : 'active';
    if (!window.confirm(`Are you sure you want to ${next} ${supplier.company || supplier.name}?`)) return;
    try { await updateSupplier(supplier.id, { status: next }); await load(); } catch (error) { console.error('Error updating supplier status:', error); }
  };

  const filtered = suppliers.filter((supplier) => {
    const query = search.toLowerCase();
    return (supplier.name.toLowerCase().includes(query) || (supplier.company || '').toLowerCase().includes(query) || (supplier.phone || '').includes(query))
      && (status === 'all' || supplier.status === status);
  });
  const totalOutstanding = suppliers.reduce((sum, supplier) => sum + supplier.totalOutstanding, 0);

  return <div className="space-y-6">
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div><h1 className="text-2xl font-bold text-slate-900 tracking-tight">Supplier Management</h1><p className="text-xs text-slate-500 mt-0.5">Supplier contacts, purchase history, and outstanding balances</p></div>
      {can('suppliers', 'create') && <button onClick={() => onOpenAddSupplierModal()} className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl flex items-center gap-2"><Plus className="w-4 h-4" />Add Supplier</button>}
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm"><div className="text-xs text-slate-400 uppercase font-semibold">Total Suppliers</div><div className="text-2xl font-bold mt-2">{suppliers.length}</div></div>
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm"><div className="text-xs text-slate-400 uppercase font-semibold">Active Suppliers</div><div className="text-2xl font-bold mt-2 text-emerald-600">{suppliers.filter((s) => s.status === 'active').length}</div></div>
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm"><div className="text-xs text-slate-400 uppercase font-semibold">Outstanding Payables</div><div className="text-2xl font-bold mt-2 text-rose-600">₹{totalOutstanding.toLocaleString('en-IN')}</div></div>
    </div>
    <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm flex flex-col md:flex-row gap-3">
      <div className="relative flex-1"><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input placeholder="Search supplier, company, or phone..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-9 pr-4 py-2 bg-slate-50 text-xs rounded-xl border border-slate-200" /></div>
      <select value={status} onChange={(e) => setStatus(e.target.value)} className="form-select md:w-40"><option value="all">All Statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select>
    </div>
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-left"><thead><tr className="bg-slate-50/70 text-[11px] uppercase text-slate-400"><th className="py-3 px-4">Supplier / Company</th><th className="py-3 px-4">Phone</th><th className="py-3 px-4">Purchases</th><th className="py-3 px-4">Paid</th><th className="py-3 px-4">Outstanding</th><th className="py-3 px-4">Status</th><th className="py-3 px-4 text-right">Actions</th></tr></thead><tbody className="divide-y divide-slate-100 text-xs">
      {loading ? <tr><td colSpan={7} className="py-12 text-center text-slate-400">Loading suppliers...</td></tr> : filtered.length === 0 ? <tr><td colSpan={7} className="py-12 text-center text-slate-400">No suppliers found.</td></tr> : filtered.map((supplier) => <tr key={supplier.id} className="hover:bg-slate-50/60"><td className="py-3.5 px-4"><div className="font-bold text-slate-900">{supplier.name}</div><div className="text-[11px] text-slate-500 flex items-center gap-1"><Building2 className="w-3 h-3" />{supplier.company || '—'}</div></td><td className="py-3.5 px-4 text-slate-600"><Phone className="w-3 h-3 inline mr-1" />{supplier.phone || '—'}</td><td className="py-3.5 px-4 font-semibold">₹{supplier.totalPurchases.toLocaleString('en-IN')}</td><td className="py-3.5 px-4 text-emerald-700">₹{supplier.totalPaid.toLocaleString('en-IN')}</td><td className="py-3.5 px-4 text-rose-700 font-semibold">₹{supplier.totalOutstanding.toLocaleString('en-IN')}</td><td className="py-3.5 px-4"><Badge status={supplier.status} /></td><td className="py-3.5 px-4 text-right"><div className="flex justify-end gap-1"><Link to={`/suppliers/${supplier.id}`} className="p-2 text-slate-500 hover:text-blue-600" title="View supplier"><Eye className="w-4 h-4" /></Link>{can('suppliers', 'edit') && <><button onClick={() => onOpenAddSupplierModal(supplier)} className="p-2 text-slate-500 hover:text-blue-600" title="Edit supplier"><Edit className="w-4 h-4" /></button><button onClick={() => toggleStatus(supplier)} className="p-2 text-slate-500 hover:text-amber-600" title="Toggle status"><Wallet className="w-4 h-4" /></button></>}</div></td></tr>)}
    </tbody></table></div></div>
  </div>;
};
