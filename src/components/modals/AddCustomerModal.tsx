import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Customer, CustomerType, PriceCategory, CustomerStatus } from '../../types';
import { addCustomer, updateCustomer } from '../../services/db';
import { User, AlertCircle } from 'lucide-react';

interface AddCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCustomer?: Customer | null;
  onCustomerAdded?: () => void;
}

export const AddCustomerModal: React.FC<AddCustomerModalProps> = ({
  isOpen,
  onClose,
  initialCustomer,
  onCustomerAdded
}) => {
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [customerType, setCustomerType] = useState<CustomerType>('Manufacturer');
  const [priceCategory, setPriceCategory] = useState<PriceCategory>('A');
  const [status, setStatus] = useState<CustomerStatus>('active');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (initialCustomer) {
        setName(initialCustomer.name || '');
        setCompany(initialCustomer.company || '');
        setPhone(initialCustomer.phone || '');
        setAddress(initialCustomer.address || '');
        setCustomerType(initialCustomer.customerType || 'Manufacturer');
        setPriceCategory(initialCustomer.priceCategory || 'A');
        setStatus(initialCustomer.status || 'active');
      } else {
        setName('');
        setCompany('');
        setPhone('');
        setAddress('');
        setCustomerType('Manufacturer');
        setPriceCategory('A');
        setStatus('active');
      }
      setError('');
    }
  }, [isOpen, initialCustomer]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim() || !company.trim()) {
      setError('Name, company name, and phone number are required.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      if (initialCustomer) {
        await updateCustomer(initialCustomer.id, {
          name: name.trim(),
          company: company.trim(),
          phone: phone.trim(),
          address: address.trim(),
          customerType,
          priceCategory,
          status
        });
      } else {
        await addCustomer({
          name: name.trim(),
          company: company.trim(),
          phone: phone.trim(),
          address: address.trim(),
          customerType,
          priceCategory,
          status
        });
      }

      if (onCustomerAdded) onCustomerAdded();
      onClose();
    } catch (e) {
      console.error(e);
      setError(initialCustomer ? 'Failed to update customer.' : 'Failed to add customer.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialCustomer ? 'Edit Customer Account' : 'Add New Customer'}
      subtitle={initialCustomer ? 'Update customer details and pricing tier' : 'Enter client contact, company details and pricing tier'}
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2 font-medium">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Customer / Contact Person</label>
            <input
              type="text"
              required
              placeholder="e.g. Dr. Rajesh Patel"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 text-xs font-medium text-slate-800 rounded-xl border border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Company Name</label>
            <input
              type="text"
              required
              placeholder="e.g. MediCare Labs"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 text-xs font-medium text-slate-800 rounded-xl border border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number</label>
            <input
              type="text"
              required
              placeholder="+91 98250 12345"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 text-xs font-medium text-slate-800 rounded-xl border border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Customer Business Type</label>
            <select
              value={customerType}
              onChange={(e) => setCustomerType(e.target.value as CustomerType)}
              className="w-full px-3 py-2 bg-slate-50 text-xs font-medium text-slate-800 rounded-xl border border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="Manufacturer">Manufacturer</option>
              <option value="Distributor">Distributor</option>
              <option value="Wholesaler">Wholesaler</option>
              <option value="Retailer">Retailer</option>
              <option value="Direct Customer">Direct Customer</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Default Price Category</label>
            <select
              value={priceCategory}
              onChange={(e) => setPriceCategory(e.target.value as PriceCategory)}
              className="w-full px-3 py-2 bg-slate-50 text-xs font-medium text-slate-800 rounded-xl border border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="A">Category A (Standard Rate)</option>
              <option value="B">Category B (Wholesale Rate)</option>
              <option value="C">Category C (Special Rate)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Account Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as CustomerStatus)}
              className="w-full px-3 py-2 bg-slate-50 text-xs font-medium text-slate-800 rounded-xl border border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Billing / Factory Address</label>
          <textarea
            rows={2}
            placeholder="Plot number, GIDC Industrial Estate, City..."
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 text-xs font-medium text-slate-800 rounded-xl border border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-md shadow-blue-500/20 disabled:opacity-50 flex items-center space-x-2"
          >
            <User className="w-4 h-4" />
            <span>{loading ? 'Saving...' : initialCustomer ? 'Update Customer' : 'Add Customer'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
