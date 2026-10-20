import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Customer, CustomerType, PriceCategory, CustomerStatus, PaymentReminderFrequency } from '../../types';
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
  const [paymentReminderEnabled, setPaymentReminderEnabled] = useState(false);
  const [paymentReminderDate, setPaymentReminderDate] = useState('');
  const [paymentReminderFrequency, setPaymentReminderFrequency] = useState<PaymentReminderFrequency>('one_time');
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
        setPaymentReminderEnabled(Boolean(initialCustomer.paymentReminder));
        setPaymentReminderDate(initialCustomer.paymentReminder?.dueDate || '');
        setPaymentReminderFrequency(initialCustomer.paymentReminder?.frequency || 'one_time');
      } else {
        setName('');
        setCompany('');
        setPhone('');
        setAddress('');
        setCustomerType('Manufacturer');
        setPriceCategory('A');
        setStatus('active');
        setPaymentReminderEnabled(false);
        setPaymentReminderDate('');
        setPaymentReminderFrequency('one_time');
      }
      setError('');
    }
  }, [isOpen, initialCustomer]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Customer / contact person name is required.');
      return;
    }
    if (paymentReminderEnabled && !paymentReminderDate) {
      setError('Select a due date for the payment reminder.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const reminderDateChanged = paymentReminderDate !== (initialCustomer?.paymentReminder?.dueDate || '');
      const reminderFrequencyChanged = paymentReminderFrequency !== (initialCustomer?.paymentReminder?.frequency || 'one_time');
      const paymentReminder = paymentReminderEnabled
        ? {
            dueDate: paymentReminderDate,
            frequency: paymentReminderFrequency,
            dayOfMonth: initialCustomer?.paymentReminder && !reminderDateChanged
              ? initialCustomer.paymentReminder.dayOfMonth ?? Number(paymentReminderDate.slice(-2))
              : Number(paymentReminderDate.slice(-2)),
            status: initialCustomer?.paymentReminder && !reminderDateChanged && !reminderFrequencyChanged
              ? initialCustomer.paymentReminder.status
              : 'active' as const,
            lastCompletedAt: initialCustomer?.paymentReminder && !reminderDateChanged && !reminderFrequencyChanged
              ? initialCustomer.paymentReminder.lastCompletedAt
              : undefined
          }
        : undefined;
      if (initialCustomer) {
        await updateCustomer(initialCustomer.id, {
          name: name.trim(),
          company: company.trim(),
          phone: phone.trim(),
          address: address.trim(),
          customerType,
          priceCategory,
          status,
          paymentReminder
        });
      } else {
        await addCustomer({
          name: name.trim(),
          company: company.trim() || undefined,
          phone: phone.trim() || undefined,
          address: address.trim(),
          customerType,
          priceCategory,
          status,
          paymentReminder
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
            <label className="form-label">Customer / Contact Person</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="form-input"
            />
          </div>

          <div>
            <label className="form-label">Company Name (Optional)</label>
            <input
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              className="form-input"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="form-label">Phone Number (Optional)</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="form-input"
            />
          </div>

          <div>
            <label className="form-label">Customer Business Type</label>
            <select
              value={customerType}
              onChange={(e) => setCustomerType(e.target.value as CustomerType)}
              className="form-select"
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
            <label className="form-label">Default Price Category</label>
            <select
              value={priceCategory}
              onChange={(e) => setPriceCategory(e.target.value as PriceCategory)}
              className="form-select"
            >
              <option value="A">Category A (Standard Rate)</option>
              <option value="B">Category B (Wholesale Rate)</option>
              <option value="C">Category C (Special Rate)</option>
            </select>
          </div>

          <div>
            <label className="form-label">Account Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as CustomerStatus)}
              className="form-select"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        <div>
          <label className="form-label">Billing / Factory Address</label>
          <textarea
            rows={2}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="form-textarea"
          />
        </div>

        <section className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <label className="flex min-h-10 cursor-pointer items-center gap-2 text-sm font-semibold text-slate-800">
            <input
              type="checkbox"
              checked={paymentReminderEnabled}
              onChange={(event) => setPaymentReminderEnabled(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            Set a payment reminder
          </label>
          {paymentReminderEnabled && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="customer-payment-reminder-date" className="form-label">Reminder due date</label>
                <input
                  id="customer-payment-reminder-date"
                  type="date"
                  required
                  value={paymentReminderDate}
                  onChange={(event) => setPaymentReminderDate(event.target.value)}
                  className="form-input"
                />
              </div>
              <div>
                <label htmlFor="customer-payment-reminder-frequency" className="form-label">Reminder frequency</label>
                <select
                  id="customer-payment-reminder-frequency"
                  value={paymentReminderFrequency}
                  onChange={(event) => setPaymentReminderFrequency(event.target.value as PaymentReminderFrequency)}
                  className="form-select"
                >
                  <option value="one_time">One-time</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
            </div>
          )}
        </section>

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
            disabled={loading}
            className="btn-primary"
          >
            <User className="w-4 h-4" />
            <span>{loading ? 'Saving...' : initialCustomer ? 'Update Customer' : 'Add Customer'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
