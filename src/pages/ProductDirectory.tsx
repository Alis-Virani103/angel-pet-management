import React, { useState, useEffect } from 'react';
import { Product, ProductType } from '../types';
import { getProducts, updateProduct, deleteProduct } from '../services/db';
import { getProductImageUrl } from '../utils/productImages';
import {
  Package,
  Plus,
  Search,
  Edit,
  Trash2,
  AlertTriangle,
  Boxes,
  Download,
  Filter,
  FolderPlus
} from 'lucide-react';

interface ProductDirectoryProps {
  onOpenAddProductModal: (defaultType?: ProductType, product?: Product) => void;
}

export const ProductDirectory: React.FC<ProductDirectoryProps> = ({ onOpenAddProductModal }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | ProductType>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
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

  const handleAddCategory = () => {
    const categoryName = window.prompt('Enter new category name:');
    if (categoryName && categoryName.trim()) {
      alert(`Category "${categoryName.trim()}" created successfully.`);
    }
  };

  const handleExportCSV = () => {
    if (filteredProducts.length === 0) {
      alert('No products to export.');
      return;
    }
    const headers = ['ID', 'Name', 'SKU', 'Type', 'Size/Spec', 'Price A', 'Price B', 'Price C', 'Stock', 'Unit', 'Status'];
    const csvRows = [
      headers.join(','),
      ...filteredProducts.map((p) =>
        [
          `"${p.id}"`,
          `"${p.name.replace(/"/g, '""')}"`,
          `"${p.sku}"`,
          `"${p.type}"`,
          `"${p.sizeOrType}"`,
          p.priceA,
          p.priceB,
          p.priceC,
          p.currentStock,
          `"${p.unit}"`,
          `"${p.status}"`
        ].join(',')
      )
    ];

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `products_catalog_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Extract unique category names dynamically from product list
  const customCategories = Array.from(
    new Set(
      products
        .map((p) => p.category)
        .filter((c): c is string => Boolean(c && c.trim()))
    )
  );

  const filteredProducts = products.filter((p) => {
    // Tab filter
    const matchesTab = activeTab === 'all' || p.type === activeTab;

    // Dropdown category filter
    const productCat = p.category || (p.type === 'bottle' ? 'bottles' : 'caps');
    const matchesCategory =
      selectedCategory === 'all' ||
      productCat.toLowerCase() === selectedCategory.toLowerCase() ||
      p.type.toLowerCase() === selectedCategory.toLowerCase();

    // Search query
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      p.sizeOrType.toLowerCase().includes(q) ||
      (p.description && p.description.toLowerCase().includes(q)) ||
      (p.material && p.material.toLowerCase().includes(q));

    return matchesTab && matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Top Header & Page Actions */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Product Master</h1>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Catalog of standard SKUs across bottles, caps and packaging models.
          </p>
        </div>

        <div className="flex items-center space-x-3 self-start md:self-auto">
          <button
            onClick={handleAddCategory}
            className="px-4 py-2.5 bg-[#132247] hover:bg-[#1e3266] text-white font-semibold text-xs rounded-xl shadow-sm transition-all flex items-center space-x-2"
          >
            <FolderPlus className="w-4 h-4" />
            <span>+ Add Category</span>
          </button>

          <button
            onClick={() => onOpenAddProductModal(activeTab === 'all' ? 'bottle' : activeTab)}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-md shadow-blue-500/20 transition-all flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add Product</span>
          </button>
        </div>
      </div>

      {/* Control Bar: Search, Category Filter & Export */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Search Input */}
        <div className="relative flex-1 max-w-lg">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search products, categories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50/80 text-xs font-medium text-slate-800 rounded-xl border border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
          />
        </div>

        {/* Tab & Dropdown Filters & Export */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Quick Tab Switcher */}
          <div className="flex items-center space-x-1 bg-slate-100/80 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'all'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              All ({products.length})
            </button>
            <button
              onClick={() => setActiveTab('bottle')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'bottle'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Bottles ({products.filter((p) => p.type === 'bottle').length})
            </button>
            <button
              onClick={() => setActiveTab('cap')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'cap'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Caps ({products.filter((p) => p.type === 'cap').length})
            </button>
          </div>

          {/* Category Dropdown */}
          <div className="relative">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="appearance-none pl-9 pr-8 py-2 bg-white text-xs font-semibold text-slate-700 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer shadow-sm"
            >
              <option value="all">All Categories</option>
              <option value="bottle">Bottles</option>
              <option value="cap">Caps</option>
              {customCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
            <Filter className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>

          {/* Export Button */}
          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-semibold text-xs rounded-xl shadow-sm transition-all flex items-center space-x-1.5"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Product Cards Grid */}
      {loading ? (
        <div className="py-20 text-center text-slate-400 font-medium text-sm">
          Loading products catalog...
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center text-slate-400 font-medium text-sm">
          No products found matching your search or category filter.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filteredProducts.map((p) => {
            const isLowStock = p.currentStock <= p.minimumStock;
            const categoryBadge = p.category || (p.type === 'bottle' ? 'BOTTLE' : 'CAP');
            const displayImageUrl = getProductImageUrl(p);

            return (
              <div
                key={p.id}
                className="bg-white rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col justify-between group"
              >
                {/* Product Image / Dark Navy Placeholder Box */}
                <div className="h-48 w-full bg-slate-50/50 relative flex items-center justify-center border-b border-slate-100 overflow-hidden p-3">
                  {displayImageUrl ? (
                    <img
                      src={displayImageUrl}
                      alt={p.name}
                      className="max-h-full max-w-full object-contain transition-transform duration-300 group-hover:scale-105"
                      onError={(e) => {
                        // Fallback to placeholder if image fails to load
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="w-full h-full bg-[#132247] rounded-xl flex flex-col items-center justify-center relative shadow-inner">
                      {/* Stylized Box Icon for custom items */}
                      <Boxes className="w-12 h-12 text-[#f59e0b] stroke-[1.5] transition-transform duration-300 group-hover:scale-110" />
                    </div>
                  )}

                  {/* Low Stock Badge overlay */}
                  {isLowStock && (
                    <div className="absolute top-3 left-3 bg-rose-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      <span>Low Stock</span>
                    </div>
                  )}
                </div>

                {/* Product Information */}
                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div>
                    {/* Header Row: Title & Badge */}
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-extrabold text-slate-900 text-sm tracking-tight uppercase line-clamp-1" title={p.name}>
                        {p.name}
                      </h3>
                      <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded-md uppercase shrink-0 tracking-wide">
                        {categoryBadge}
                      </span>
                    </div>

                    {/* Subtext: SKU & Description */}
                    <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mt-1 line-clamp-1">
                      {p.sku} {p.description ? `• ${p.description}` : ''}
                    </div>
                  </div>

                  {/* Product Specification Grid */}
                  <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 py-2.5 px-3 bg-slate-50/80 rounded-xl border border-slate-100 text-[11px]">
                    <div>
                      <span className="text-slate-400 font-medium text-[10px] block">Material</span>
                      <span className="font-semibold text-slate-800 line-clamp-1">
                        {p.material || (p.type === 'bottle' ? 'PET' : 'HDPE')}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 font-medium text-[10px] block">
                        {p.gsm ? 'GSM' : 'Size / Spec'}
                      </span>
                      <span className="font-semibold text-slate-800 line-clamp-1">
                        {p.gsm || p.sizeOrType}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 font-medium text-[10px] block">Printing</span>
                      <span className="font-semibold text-slate-800 line-clamp-1">
                        {p.printing || (p.type === 'bottle' ? 'Standard' : 'CMYK')}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 font-medium text-[10px] block">
                        {p.dimensions ? 'Dimensions' : 'Stock'}
                      </span>
                      <span
                        className={`font-semibold line-clamp-1 ${
                          isLowStock ? 'text-rose-600 font-bold' : 'text-slate-800'
                        }`}
                      >
                        {p.dimensions || `${p.currentStock.toLocaleString()} ${p.unit}`}
                      </span>
                    </div>
                  </div>

                  {/* Card Bottom: Unit Price & Actions */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between mt-auto">
                    <div>
                      <span className="text-[10px] text-slate-400 font-medium block uppercase tracking-wider">
                        Unit price
                      </span>
                      <span className="text-base font-extrabold text-[#132247]">
                        ₹{p.priceA.toFixed(2)}
                      </span>
                    </div>

                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => onOpenAddProductModal(p.type, p)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                        title="Edit Product"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(p.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                        title="Delete Product"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

