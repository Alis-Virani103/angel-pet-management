import React, { useEffect, useState } from 'react';
import { Modal } from '../common/Modal';
import { Supplier, SupplierStatus } from '../../types';
import { addSupplier, updateSupplier } from '../../services/db';
import { AlertCircle, Truck } from 'lucide-react';

interface AddSupplierModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialSupplier?: Supplier | null;
  onSupplierSaved?: () => void;
}

export const AddSupplierModal: React.FC<AddSupplierModalProps> = ({ isOpen, onClose, initialSupplier, onSupplierSaved }) => {
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [status, setStatus] = useState<SupplierStatus>('active');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setName(initialSupplier?.name || '');
    setCompany(initialSupplier?.company || '');
    setPhone(initialSupplier?.phone || '');
    setAddress(initialSupplier?.address || '');
    setStatus(initialSupplier?.status || 'active');
    setError('');
  }, [isOpen, initialSupplier]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      setError('Supplier / contact person name is required.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = { name: name.trim(), company: company.trim() || undefined, phone: phone.trim(), address: address.trim(), status };
      if (initialSupplier) await updateSupplier(initialSupplier.id, { ...data, company: company.trim() });
      else await addSupplier(data);
      onSupplierSaved?.();
      onClose();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to save supplier.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={initialSupplier ? 'Edit Supplier Account' : 'Add New Supplier'} subtitle="Maintain supplier contact details and purchasing relationships" maxWidth="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2"><AlertCircle className="w-4 h-4" /><span>{error}</span></div>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><label className="form-label">Supplier / Contact Person</label><input required value={name} onChange={(e) => setName(e.target.value)} className="form-input" /></div>
          <div><label className="form-label">Company Name (Optional)</label><input value={company} onChange={(e) => setCompany(e.target.value)} className="form-input" /></div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><label className="form-label">Phone Number (Optional)</label><input value={phone} onChange={(e) => setPhone(e.target.value)} className="form-input" /></div>
          <div><label className="form-label">Account Status</label><select value={status} onChange={(e) => setStatus(e.target.value as SupplierStatus)} className="form-select"><option value="active">Active</option><option value="inactive">Inactive</option></select></div>
        </div>
        <div><label className="form-label">Address</label><textarea rows={2} value={address} onChange={(e) => setAddress(e.target.value)} className="form-textarea" /></div>
        <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={loading} className="btn-primary"><Truck className="w-4 h-4" /><span>{loading ? 'Saving...' : initialSupplier ? 'Update Supplier' : 'Add Supplier'}</span></button>
        </div>
      </form>
    </Modal>
  );
};
