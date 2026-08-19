import React, { useState, useEffect } from 'react';
import { Dispatch, DispatchStatus } from '../types';
import { getDispatches, updateDispatchStatus } from '../services/db';
import { Badge } from '../components/common/Badge';
import {
  Truck,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  User,
  MapPin,
  Calendar
} from 'lucide-react';

interface DispatchProps {
  onOpenNewDispatchModal: () => void;
}

export const DispatchPage: React.FC<DispatchProps> = ({ onOpenNewDispatchModal }) => {
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDispatches();
  }, []);

  const loadDispatches = async () => {
    setLoading(true);
    try {
      const list = await getDispatches();
      setDispatches(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (id: string, newStatus: DispatchStatus) => {
    try {
      await updateDispatchStatus(id, newStatus);
      loadDispatches();
    } catch (e) {
      console.error(e);
    }
  };

  const filteredDispatches = dispatches.filter((d) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      d.dispatchNumber.toLowerCase().includes(q) ||
      d.orderNumber.toLowerCase().includes(q) ||
      d.customerName.toLowerCase().includes(q) ||
      (d.vehicleNumber && d.vehicleNumber.toLowerCase().includes(q)) ||
      (d.driverName && d.driverName.toLowerCase().includes(q));

    const matchesStatus = statusFilter === 'all' || d.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Title & Action Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Dispatch & Logistics</h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Log lorry shipments, driver contacts, and update inventory upon completion
          </p>
        </div>

        <button
          onClick={onOpenNewDispatchModal}
          className="px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs rounded-xl shadow-md shadow-sky-500/20 transition-colors flex items-center space-x-2 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>New Dispatch</span>
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search dispatch ID, vehicle or driver..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 text-xs font-medium text-slate-800 rounded-xl border border-slate-200 focus:bg-white"
          />
        </div>

        <div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 text-xs font-medium text-slate-700 rounded-xl border border-slate-200 focus:bg-white"
          >
            <option value="all">All Dispatch Statuses</option>
            <option value="pending">Pending Preparation</option>
            <option value="ready">Ready for Pickup</option>
            <option value="dispatched">Dispatched (In Transit)</option>
            <option value="delivered">Delivered / Completed</option>
          </select>
        </div>
      </div>

      {/* Dispatch Table */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="py-3.5 px-4">Dispatch ID</th>
                <th className="py-3.5 px-4">Order ID</th>
                <th className="py-3.5 px-4">Customer Name</th>
                <th className="py-3.5 px-4">Items Shipped</th>
                <th className="py-3.5 px-4">Vehicle & Driver</th>
                <th className="py-3.5 px-4">Dispatch Date</th>
                <th className="py-3.5 px-4">Shipment Status</th>
                <th className="py-3.5 px-4 text-right">Update Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
              {filteredDispatches.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 font-medium">
                    No dispatch shipments found matching criteria.
                  </td>
                </tr>
              ) : (
                filteredDispatches.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-sky-600">{d.dispatchNumber}</td>
                    <td className="py-3.5 px-4 font-bold text-blue-600">{d.orderNumber}</td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">{d.customerName}</td>
                    <td className="py-3.5 px-4">
                      <div className="truncate max-w-[200px]">
                        {d.items.map((i) => `${i.quantity.toLocaleString()}x ${i.productName}`).join(', ')}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900">{d.vehicleNumber || 'Pending Vehicle'}</div>
                      <div className="text-[11px] text-slate-400">{d.driverName || 'No Driver'}</div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-500">{d.dispatchDate}</td>
                    <td className="py-3.5 px-4">
                      <Badge status={d.status} />
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <select
                        value={d.status}
                        onChange={(e) => handleStatusChange(d.id, e.target.value as DispatchStatus)}
                        className="px-2 py-1 bg-slate-100 text-[11px] font-semibold text-slate-800 rounded-lg border border-slate-200 focus:bg-white"
                      >
                        <option value="pending">Pending</option>
                        <option value="ready">Ready</option>
                        <option value="dispatched">Dispatched</option>
                        <option value="delivered">Delivered</option>
                      </select>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
