import React, { useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { PurchasedMaterial } from '../types';
import {
  addPurchasedMaterial,
  deletePurchasedMaterial,
  getPurchasedMaterials,
  getRawMaterials,
  updatePurchasedMaterial
} from '../services/db';
import {
  cleanDecimalInput,
  formatNumberDisplay
} from '../utils/packetUtils';
import { calculatePurchasedMaterialTotals, PurchasedMaterialConversionMode } from '../utils/purchasedMaterialUtils';
import { useTranslation } from '../i18n';
import { useAuth } from '../auth/AuthContext';

type MaterialForm = {
  materialName: string;
  supplier: string;
  conversionMode: PurchasedMaterialConversionMode;
  quantity: string;
  unitWeight: string;
};

const emptyForm: MaterialForm = {
  materialName: '',
  supplier: '',
  conversionMode: 'bags',
  quantity: '',
  unitWeight: ''
};

export const PurchasedMaterials: React.FC = () => {
  const { confirm } = useTranslation();
  const { can } = useAuth();
  const [materials, setMaterials] = useState<PurchasedMaterial[]>([]);
  const [savedMaterialNames, setSavedMaterialNames] = useState<string[]>([]);
  const [savedSuppliers, setSavedSuppliers] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [form, setForm] = useState<MaterialForm>(emptyForm);
  const [editingMaterial, setEditingMaterial] = useState<PurchasedMaterial | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadMaterials = async () => {
    setLoading(true);
    try {
      const [purchasedMaterials, rawMaterials] = await Promise.all([
        getPurchasedMaterials(),
        can('rawMaterials', 'view') ? getRawMaterials() : Promise.resolve([])
      ]);
      setMaterials(purchasedMaterials);
      setSavedMaterialNames(Array.from(new Set([
        ...rawMaterials.map((material) => material.name.trim()),
        ...purchasedMaterials.map((material) => material.materialName.trim())
      ].filter(Boolean))).sort());
      setSavedSuppliers(Array.from(new Set([
        ...rawMaterials.map((material) => material.supplier.trim()),
        ...purchasedMaterials.map((material) => material.supplier.trim())
      ].filter(Boolean))).sort());
    } catch (loadError) {
      console.error(loadError);
      setError('Could not load purchased materials.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMaterials();
  }, [can]);

  const filteredMaterials = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return materials;
    return materials.filter((material) =>
      [material.materialName, material.supplier].some((value) => value.toLowerCase().includes(query))
    );
  }, [materials, searchQuery]);

  const totals = calculatePurchasedMaterialTotals(
    form.conversionMode,
    Number(form.quantity),
    Number(form.unitWeight)
  );

  const openForm = (material?: PurchasedMaterial) => {
    setEditingMaterial(material || null);
    setForm(material ? {
      materialName: material.materialName,
      supplier: material.supplier,
      conversionMode: material.conversionMode === 'piece_count'
        ? 'piece_count'
        : material.conversionMode === 'packets' ? 'packets' : 'bags',
      quantity: String(material.conversionMode === 'packets'
        ? material.packetQuantity ?? ''
        : material.conversionMode === 'piece_count'
          ? material.totalPieces ?? ''
          : material.numberOfBags ?? ''),
      unitWeight: String(material.conversionMode === 'packets'
        ? material.packetWeightKg
          ?? ((material.unitsPerPacket || 0) * (material.weightPerPieceGrams || 0) / 1000 || '')
        : material.conversionMode === 'piece_count'
          ? material.weightPerPieceGrams ?? ''
          : material.weightPerBagKg ?? '')
    } : emptyForm);
    setError('');
    setIsFormOpen(true);
  };

  const closeForm = () => {
    if (!saving) setIsFormOpen(false);
  };

  const updateForm = (field: keyof MaterialForm, value: string) => {
    setForm((current) => ({ ...current, [field]: field === 'materialName' || field === 'supplier' ? value : cleanDecimalInput(value) }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const quantity = Number(form.quantity);
    const unitWeight = Number(form.unitWeight);

    if (!form.materialName.trim() || !form.supplier.trim()) {
      setError('Material name and supplier are required.');
      return;
    }
    if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitWeight) || unitWeight <= 0) {
      setError('Quantity and unit weight must be positive numbers.');
      return;
    }
    if (form.conversionMode === 'piece_count' && !Number.isInteger(quantity)) {
      setError('Piece quantity must be a positive whole number.');
      return;
    }

    const payload = {
      materialName: form.materialName.trim(),
      supplier: form.supplier.trim(),
      conversionMode: form.conversionMode,
      totalWeightKg: totals.totalWeightKg,
      ...(form.conversionMode === 'bags' ? {
        numberOfBags: quantity,
        weightPerBagKg: unitWeight
      } : form.conversionMode === 'piece_count' ? {
        totalPieces: quantity,
        weightPerPieceGrams: unitWeight,
        equivalentPieces: quantity
      } : {
        packetQuantity: quantity,
        packetWeightKg: unitWeight
      })
    };

    setSaving(true);
    setError('');
    try {
      if (editingMaterial) await updatePurchasedMaterial(editingMaterial.id, payload);
      else await addPurchasedMaterial(payload);
      setIsFormOpen(false);
      await loadMaterials();
    } catch (saveError) {
      console.error(saveError);
      setError('Could not save purchased material.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (material: PurchasedMaterial) => {
    if (!confirm(`Delete purchased material "${material.materialName}"?`)) return;
    try {
      await deletePurchasedMaterial(material.id);
      await loadMaterials();
    } catch (deleteError) {
      console.error(deleteError);
      setError('Could not delete purchased material.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Purchased Materials</h1>
          <p className="mt-0.5 text-xs font-medium text-slate-500">Track raw material purchases, stock weight, and equivalent pieces.</p>
        </div>
        {can('purchasedMaterials', 'create') && <button onClick={() => openForm()} className="btn-primary">
          <Plus className="h-4 w-4" /> Add Purchased Material
        </button>}
      </div>

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-700">{error}</div>}

      <div className="space-y-4 rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-base font-bold text-slate-900">Material Stock</h2>
            <p className="text-xs text-slate-500">Calculated values update when a record is saved.</p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input className="form-input pl-9" placeholder="Search material or supplier..." value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-left">
            <thead><tr className="border-b border-slate-100 bg-slate-50/50 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              <th className="px-4 py-3.5">Material</th><th className="px-4 py-3.5">Supplier</th><th className="px-4 py-3.5">Quantity</th>
              <th className="px-4 py-3.5">Weight per Unit</th><th className="px-4 py-3.5">Total Weight</th>
              <th className="px-4 py-3.5">Pieces</th><th className="px-4 py-3.5 text-right">Actions</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
              {loading ? <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">Loading purchased materials...</td></tr> :
                filteredMaterials.length === 0 ? <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">No purchased materials found.</td></tr> :
                filteredMaterials.map((material) => <tr key={material.id} className="transition-colors hover:bg-slate-50/80">
                  <td className="px-4 py-3.5 font-bold text-slate-900">{material.materialName}</td>
                  <td className="px-4 py-3.5">{material.supplier}</td>
                  <td className="px-4 py-3.5">{material.conversionMode === 'piece_count'
                    ? `${formatNumberDisplay(material.totalPieces)} pieces`
                    : material.conversionMode === 'packets'
                      ? `${formatNumberDisplay(material.packetQuantity)} packets`
                      : `${formatNumberDisplay(material.numberOfBags)} bags`}</td>
                  <td className="px-4 py-3.5">{material.conversionMode === 'piece_count'
                    ? `${formatNumberDisplay(material.weightPerPieceGrams)} g / piece`
                    : material.conversionMode === 'packets'
                      ? `${formatNumberDisplay(material.packetWeightKg ?? (material.unitsPerPacket && material.weightPerPieceGrams ? material.unitsPerPacket * material.weightPerPieceGrams / 1000 : undefined))} kg / packet`
                      : `${formatNumberDisplay(material.weightPerBagKg)} kg / bag`}</td>
                  <td className="px-4 py-3.5 font-bold text-blue-700">{formatNumberDisplay(material.totalWeightKg)} kg</td>
                  <td className="px-4 py-3.5 font-bold text-emerald-700">{material.totalPieces !== undefined || material.equivalentPieces !== undefined
                    ? `${formatNumberDisplay(material.totalPieces ?? material.equivalentPieces)} pcs`
                    : '—'}</td>
                  <td className="px-4 py-3.5"><div className="flex justify-end gap-1">
                    {can('purchasedMaterials', 'edit') && <button title="Edit purchased material" onClick={() => openForm(material)} className="rounded-lg p-2 text-slate-400 hover:bg-blue-50 hover:text-blue-600"><Pencil className="h-4 w-4" /></button>}
                    {can('purchasedMaterials', 'delete') && <button title="Delete purchased material" onClick={() => handleDelete(material)} className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>}
                  </div></td>
                </tr>)}
            </tbody>
          </table>
        </div>
      </div>

      {isFormOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
        <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl">
          <div className="mb-5 flex items-start justify-between"><div><h2 className="text-lg font-bold text-slate-900">{editingMaterial ? 'Edit' : 'Add'} Purchased Material</h2><p className="text-xs text-slate-500">Enter positive decimal quantities and weights.</p></div><button onClick={closeForm} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button></div>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{error}</div>}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div><label className="form-label">Material Name</label><input required list="purchased-material-names" className="form-input" placeholder="Select or enter material name" value={form.materialName} onChange={(e) => updateForm('materialName', e.target.value)} /><datalist id="purchased-material-names">{savedMaterialNames.map((name) => <option key={name} value={name} />)}</datalist></div>
              <div><label className="form-label">Supplier</label><input required list="purchased-material-suppliers" className="form-input" placeholder="Select or enter supplier" value={form.supplier} onChange={(e) => updateForm('supplier', e.target.value)} /><datalist id="purchased-material-suppliers">{savedSuppliers.map((supplier) => <option key={supplier} value={supplier} />)}</datalist></div>
              <div><label className="form-label">Conversion</label><select className="form-select" value={form.conversionMode} onChange={(e) => setForm((current) => ({ ...current, conversionMode: e.target.value as MaterialForm['conversionMode'] }))}><option value="bags">Bags</option><option value="piece_count">Pieces</option><option value="packets">Packets</option></select></div>
              <div><label className="form-label">{form.conversionMode === 'bags' ? 'Bag Quantity' : form.conversionMode === 'piece_count' ? 'Piece Quantity' : 'Packet Quantity'}</label><input required min={form.conversionMode === 'piece_count' ? '1' : '0.0001'} step={form.conversionMode === 'piece_count' ? '1' : 'any'} type="number" className="form-input" value={form.quantity} onChange={(e) => updateForm('quantity', e.target.value)} /></div>
              <div><label className="form-label">{form.conversionMode === 'bags' ? 'Weight per Bag (kg)' : form.conversionMode === 'piece_count' ? 'Weight per Piece (g)' : 'Weight per Packet (kg)'}</label><input required min="0.0001" step="any" type="number" className="form-input" value={form.unitWeight} onChange={(e) => updateForm('unitWeight', e.target.value)} /></div>
              <div className="rounded-xl bg-slate-50 p-3"><div className="text-[11px] font-bold uppercase text-slate-400">Calculated Total Weight</div><div className="mt-1 text-lg font-bold text-blue-700">{formatNumberDisplay(totals.totalWeightKg)} kg</div>{totals.totalPieces !== undefined && <div className="text-[11px] text-slate-500">Total pieces: {formatNumberDisplay(totals.totalPieces)}</div>}</div>
            </div>
            <div className="flex justify-end gap-2 pt-2"><button type="button" onClick={closeForm} className="btn-secondary">Cancel</button><button disabled={saving} type="submit" className="btn-primary">{saving ? 'Saving...' : 'Save Material'}</button></div>
          </form>
        </div>
      </div>}
    </div>
  );
};
