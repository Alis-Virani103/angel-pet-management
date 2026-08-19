import React, { useState, useEffect } from 'react';
import { Product, ProductType } from '../types';
import { getProducts, updateProduct, deleteProduct } from '../services/db';
import { Badge } from '../components/common/Badge';
import {
  Package,
  Plus,
  Search,
  Edit,
  Trash2,
  AlertTriangle,
  Boxes
} from 'lucide-react';

interface ProductDirectoryProps {
  onOpenAddProductModal: (defaultType?: ProductType, product?: Product) => void;
}

export const ProductDirectory: React.FC<ProductDirectoryProps> = ({ onOpenAddProductModal }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [activeTab, setActiveTab] = useState<ProductType>('bottle');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    setLoading(true);
    try {
      const list = await getProducts();
      setProducts(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (product: Product) => {
    const newStatus = product.status === 'active' ? 'inactive' : 'active';
    try {
      await updateProduct(product.id, { status: newStatus });
      loadProducts();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Delete/deactivate this product spec?')) {
      try {
        await deleteProduct(id);
        loadProducts();
      } catch (e) {
        console.error(e);
      }
    }
  };

  const filteredProducts = products.filter((p) => {
    const matchesTab = p.type === activeTab;
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      p.sizeOrType.toLowerCase().includes(q);
    return matchesTab && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Title & Action Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Product Directory</h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Manage bottles, caps and their A/B/C tier pricing models
          </p>
        </div>

        <button
          onClick={() => onOpenAddProductModal(activeTab)}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-md shadow-blue-500/20 transition-colors flex items-center space-x-2 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>{activeTab === 'bottle' ? 'Add Bottle' : 'Add Cap'}</span>
        </button>
      </div>

      {/* Tabs & Search Bar */}
      <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Tab Switcher */}
        <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-2xl">
          <button
            onClick={() => setActiveTab('bottle')}
            className={`px-5 py-2 text-xs font-semibold rounded-xl transition-all ${
              activeTab === 'bottle'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Bottles Catalog ({products.filter((p) => p.type === 'bottle').length})
          </button>
          <button
            onClick={() => setActiveTab('cap')}
            className={`px-5 py-2 text-xs font-semibold rounded-xl transition-all ${
              activeTab === 'cap'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Caps Catalog ({products.filter((p) => p.type === 'cap').length})
          </button>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={`Search ${activeTab === 'bottle' ? 'bottles' : 'caps'} or SKU...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 text-xs font-medium text-slate-800 rounded-xl border border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
      </div>

      {/* Product Table */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="py-3.5 px-4">Product Name</th>
                <th className="py-3.5 px-4">SKU</th>
                <th className="py-3.5 px-4">{activeTab === 'bottle' ? 'Size' : 'Type / Thread'}</th>
                <th className="py-3.5 px-4">Price A (Standard)</th>
                <th className="py-3.5 px-4">Price B (Wholesale)</th>
                <th className="py-3.5 px-4">Price C (Special)</th>
                <th className="py-3.5 px-4">Current Stock</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400 font-medium">
                    No products found in this category.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  const isLowStock = p.currentStock <= p.minimumStock;
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{p.name}</div>
                        {p.description && <div className="text-[11px] text-slate-400">{p.description}</div>}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[11px] text-slate-600">{p.sku}</td>
                      <td className="py-3.5 px-4 text-slate-600">{p.sizeOrType}</td>
                      <td className="py-3.5 px-4 font-bold text-slate-900">₹{p.priceA.toFixed(2)}</td>
                      <td className="py-3.5 px-4 font-semibold text-blue-600">₹{p.priceB.toFixed(2)}</td>
                      <td className="py-3.5 px-4 font-semibold text-purple-600">₹{p.priceC.toFixed(2)}</td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{p.currentStock.toLocaleString()} {p.unit}</div>
                        {isLowStock && (
                          <div className="text-[10px] text-rose-600 font-bold flex items-center gap-0.5">
                            <AlertTriangle className="w-3 h-3" /> Below Min ({p.minimumStock.toLocaleString()})
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <Badge status={isLowStock ? 'low_stock' : p.status} />
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => onOpenAddProductModal(p.type, p)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                            title="Edit Product Spec"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(p.id)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            title="Delete Product"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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
    </div>
  );
};
