import React, { useState, useEffect } from 'react';
import { Product, FinishedGoodsLog } from '../types';
import { getProducts, getFinishedGoodsLogs } from '../services/db';
import { Badge } from '../components/common/Badge';
import { StatCard } from '../components/common/StatCard';
import {
  Boxes,
  Plus,
  Search,
  AlertTriangle,
  CheckCircle2,
  Clock,
  TrendingUp
} from 'lucide-react';

interface FinishedGoodsProps {
  onOpenAddFinishedGoodsModal: () => void;
}

export const FinishedGoods: React.FC<FinishedGoodsProps> = ({ onOpenAddFinishedGoodsModal }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [logs, setLogs] = useState<FinishedGoodsLog[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadGoods();
  }, []);

  const loadGoods = async () => {
    setLoading(true);
    try {
      const [prdList, logList] = await Promise.all([getProducts(), getFinishedGoodsLogs()]);
      setProducts(prdList);
      setLogs(logList);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const totalFinishedGoodsCount = products.reduce((sum, p) => sum + p.currentStock, 0);
  const lowStockCount = products.filter((p) => p.currentStock <= p.minimumStock).length;
  const todayStr = new Date().toISOString().split('T')[0];
  const todaysProductionCount = logs
    .filter((l) => l.date === todayStr)
    .reduce((sum, l) => sum + l.quantityProduced, 0);

  const filteredProducts = products.filter((p) => {
    const q = searchQuery.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      p.type.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header & Add Stock Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Finished Goods</h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Track manufactured finished bottles and caps available for customer dispatch
          </p>
        </div>

        <button
          onClick={onOpenAddFinishedGoodsModal}
          className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs rounded-xl shadow-md shadow-purple-500/20 transition-colors flex items-center space-x-2 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Add Finished Goods</span>
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Finished Goods"
          value={`${totalFinishedGoodsCount.toLocaleString()} units`}
          icon={Boxes}
          change="Available"
          changeType="positive"
          subtitle="Warehouse inventory"
          iconBgColor="bg-purple-50"
          iconTextColor="text-purple-600"
        />
        <StatCard
          title="Low Stock Items"
          value={lowStockCount}
          icon={AlertTriangle}
          change={lowStockCount > 0 ? 'Needs Production' : 'Healthy'}
          changeType={lowStockCount > 0 ? 'negative' : 'positive'}
          subtitle="Below safety threshold"
          iconBgColor="bg-rose-50"
          iconTextColor="text-rose-600"
        />
        <StatCard
          title="Total Products"
          value={products.length}
          icon={Boxes}
          change="Active SKUs"
          changeType="neutral"
          subtitle="Bottles & Caps specifications"
          iconBgColor="bg-blue-50"
          iconTextColor="text-blue-600"
        />
        <StatCard
          title="Today's Production"
          value={`${todaysProductionCount.toLocaleString()} units`}
          icon={TrendingUp}
          change="Added Today"
          changeType="positive"
          subtitle="Machine output recorded"
          iconBgColor="bg-emerald-50"
          iconTextColor="text-emerald-600"
        />
      </div>

      {/* Stock Levels Table & Activity Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Stock Levels Table (2 Columns) */}
        <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">Current Stock Levels</h2>
              <p className="text-xs text-slate-500">Live availability and automated low-stock detection</p>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search inventory..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 text-xs font-medium text-slate-800 rounded-xl border border-slate-200 focus:bg-white"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Product Name</th>
                  <th className="py-3.5 px-4">Type</th>
                  <th className="py-3.5 px-4">Current Stock</th>
                  <th className="py-3.5 px-4">Minimum Stock</th>
                  <th className="py-3.5 px-4">Unit</th>
                  <th className="py-3.5 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                {filteredProducts.map((p) => {
                  const isLowStock = p.currentStock <= p.minimumStock;
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{p.name}</div>
                        <div className="text-[11px] text-slate-400">{p.sku}</div>
                      </td>
                      <td className="py-3.5 px-4 capitalize text-slate-600">{p.type}</td>
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        {p.currentStock.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-slate-500">{p.minimumStock.toLocaleString()}</td>
                      <td className="py-3.5 px-4 text-slate-500">{p.unit}</td>
                      <td className="py-3.5 px-4">
                        <Badge status={isLowStock ? 'low_stock' : 'healthy'} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Inventory Activity Section (1 Column) */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">Inventory Production Logs</h2>
            <p className="text-xs text-slate-500">Recent daily machine outputs added</p>
          </div>

          <div className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto">
            {logs.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">No production logs recorded yet.</div>
            ) : (
              logs.map((log) => (
                <div key={log.id} className="py-3 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-900">{log.productName}</span>
                    <span className="font-bold text-purple-600">+{log.quantityProduced.toLocaleString()} {log.unit}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>{log.date}</span>
                    <span>{log.notes || 'Production Output'}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
