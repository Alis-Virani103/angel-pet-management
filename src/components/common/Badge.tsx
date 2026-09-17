import React from 'react';
import { OrderStatus, PaymentStatus, DispatchStatus } from '../../types';
import { useTranslation } from '../../i18n';

interface BadgeProps {
  status: OrderStatus | PaymentStatus | DispatchStatus | 'active' | 'inactive' | 'healthy' | 'low_stock' | string;
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({ status, size = 'sm' }) => {
  const { t } = useTranslation();
  const sizeClasses = size === 'sm' ? 'px-2.5 py-0.5 text-[11px]' : 'px-3 py-1 text-xs';

  let colorClasses = 'bg-slate-100 text-slate-700 border-slate-200';
  let label = status;

  switch (status) {
    // Order Statuses
    case 'completed':
    case 'delivered':
      colorClasses = 'bg-emerald-50 text-emerald-700 border-emerald-200/60';
      label = 'Completed';
      break;
    case 'dispatched':
      colorClasses = 'bg-sky-50 text-sky-700 border-sky-200/60';
      label = 'Dispatched';
      break;
    case 'confirmed':
    case 'ready':
      colorClasses = 'bg-blue-50 text-blue-700 border-blue-200/60';
      label = 'Confirmed';
      break;
    case 'pending':
      colorClasses = 'bg-amber-50 text-amber-700 border-amber-200/60';
      label = 'Pending';
      break;
    case 'cancelled':
      colorClasses = 'bg-rose-50 text-rose-700 border-rose-200/60';
      label = 'Cancelled';
      break;

    // Payment Statuses
    case 'paid':
      colorClasses = 'bg-emerald-50 text-emerald-700 border-emerald-200/60';
      label = 'Paid';
      break;
    case 'partially_paid':
      colorClasses = 'bg-amber-50 text-amber-700 border-amber-200/60';
      label = 'Partially Paid';
      break;

    // Stock & Active Statuses
    case 'healthy':
    case 'active':
      colorClasses = 'bg-emerald-50 text-emerald-700 border-emerald-200/60';
      label = status === 'healthy' ? 'Healthy Stock' : 'Active';
      break;
    case 'low_stock':
      colorClasses = 'bg-rose-50 text-rose-700 border-rose-200/60 font-semibold';
      label = 'Low Stock';
      break;
    case 'inactive':
      colorClasses = 'bg-slate-100 text-slate-500 border-slate-200';
      label = 'Inactive';
      break;
    default:
      label = String(status).replace('_', ' ');
      break;
  }

  return (
    <span className={`inline-flex items-center font-medium rounded-full border ${sizeClasses} ${colorClasses}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5 opacity-80" />
      <span className="capitalize">{t(label)}</span>
    </span>
  );
};
