import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Product, ProductType, ProductStatus } from '../../types';
import { addProduct, updateProduct } from '../../services/db';
import { uploadToCloudinary } from '../../services/cloudinary';
import { Package, AlertCircle, UploadCloud, Image as ImageIcon } from 'lucide-react';

interface AddProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultType?: ProductType;
  initialProduct?: Product | null;
  onProductAdded?: () => void;
}

export const AddProductModal: React.FC<AddProductModalProps> = ({
  isOpen,
  onClose,
  defaultType = 'bottle',
  initialProduct,
  onProductAdded
}) => {
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [type, setType] = useState<ProductType>(defaultType);
  const [sizeOrType, setSizeOrType] = useState('');
  const [description, setDescription] = useState('');
  const [priceA, setPriceA] = useState<number>(10);
  const [priceB, setPriceB] = useState<number>(9);
  const [priceC, setPriceC] = useState<number>(8);
  const [currentStock, setCurrentStock] = useState<number>(1000);
  const [minimumStock, setMinimumStock] = useState<number>(500);
  const [unit, setUnit] = useState('pcs');
  const [status, setStatus] = useState<ProductStatus>('active');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [uploadStatusText, setUploadStatusText] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (initialProduct) {
        setName(initialProduct.name || '');
        setSku(initialProduct.sku || '');
        setType(initialProduct.type || defaultType);
        setSizeOrType(initialProduct.sizeOrType || '');
        setDescription(initialProduct.description || '');
        setPriceA(initialProduct.priceA || 0);
        setPriceB(initialProduct.priceB || 0);
        setPriceC(initialProduct.priceC || 0);
        setCurrentStock(initialProduct.currentStock || 0);
        setMinimumStock(initialProduct.minimumStock || 0);
        setUnit(initialProduct.unit || 'pcs');
        setStatus(initialProduct.status || 'active');
        setImagePreview(initialProduct.imageUrl || '');
      } else {
        setName('');
        setSku('');
        setType(defaultType);
        setSizeOrType('');
        setDescription('');
        setPriceA(10);
        setPriceB(9);
        setPriceC(8);
        setCurrentStock(1000);
        setMinimumStock(500);
        setUnit('pcs');
        setStatus('active');
        setImagePreview('');
      }
      setImageFile(null);
      setUploadStatusText('');
      setError('');
    }
  }, [isOpen, initialProduct, defaultType]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
      setError('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Product name is required.');
      return;
    }

    setLoading(true);
    setError('');
    setUploadStatusText('');

    try {
      let finalImageUrl = initialProduct?.imageUrl || '';
      let finalPublicId = initialProduct?.cloudinaryPublicId || '';

      if (imageFile) {
        setUploadStatusText('Uploading image to Cloudinary...');
        const uploadRes = await uploadToCloudinary(imageFile);
        finalImageUrl = uploadRes.secure_url;
        finalPublicId = uploadRes.public_id;
      }

      setUploadStatusText('Saving product data...');

      if (initialProduct) {
        await updateProduct(initialProduct.id, {
          name: name.trim(),
          sku: sku.trim() || initialProduct.sku,
          type,
          sizeOrType: sizeOrType.trim() || name.trim(),
          description: description.trim(),
          priceA: Number(priceA),
          priceB: Number(priceB),
          priceC: Number(priceC),
          currentStock: Number(currentStock),
          minimumStock: Number(minimumStock),
          unit,
          status,
          imageUrl: finalImageUrl,
          cloudinaryPublicId: finalPublicId
        });
      } else {
        await addProduct({
          name: name.trim(),
          sku: sku.trim() || `${type === 'bottle' ? 'BTL' : 'CAP'}-${Math.floor(100 + Math.random() * 900)}`,
          type,
          sizeOrType: sizeOrType.trim() || name.trim(),
          description: description.trim(),
          priceA: Number(priceA),
          priceB: Number(priceB),
          priceC: Number(priceC),
          currentStock: Number(currentStock),
          minimumStock: Number(minimumStock),
          unit,
          status,
          imageUrl: finalImageUrl,
          cloudinaryPublicId: finalPublicId
        });
      }

      if (onProductAdded) onProductAdded();
      onClose();
    } catch (err) {
      console.error(err);
      setError(initialProduct ? 'Failed to update product.' : 'Failed to add product.');
    } finally {
      setLoading(false);
      setUploadStatusText('');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialProduct ? 'Edit Product Spec' : type === 'bottle' ? 'Add New Bottle Spec' : 'Add New Cap Spec'}
      subtitle="Define pricing tiers A/B/C and stock safety parameters"
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2 font-medium">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Product Image Upload Field */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Product Image (Cloudinary Storage)
          </label>
          <div className="flex items-center gap-4 p-3 bg-slate-50 border border-slate-200 rounded-2xl">
            <div className="w-16 h-16 rounded-xl bg-white border border-slate-200 flex items-center justify-center overflow-hidden shrink-0 shadow-xs">
              {imagePreview ? (
                <img src={imagePreview} alt="Preview" className="w-full h-full object-contain p-1" />
              ) : (
                <ImageIcon className="w-6 h-6 text-slate-300" />
              )}
            </div>
            <div className="flex-1">
              <label className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 hover:border-blue-400 rounded-xl text-xs font-semibold text-slate-700 cursor-pointer shadow-xs transition-colors">
                <UploadCloud className="w-4 h-4 text-blue-600" />
                <span>{imagePreview ? 'Change Photo' : 'Upload Product Photo'}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                />
              </label>
              <p className="text-[11px] text-slate-400 mt-1">
                {imageFile ? imageFile.name : imagePreview ? 'Cloudinary Image Attached' : 'Select JPEG/PNG photo to store on Cloudinary'}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Product Category</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as ProductType)}
              className="w-full px-3 py-2 bg-slate-50 text-xs font-medium text-slate-800 rounded-xl border border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="bottle">Bottle</option>
              <option value="cap">Cap</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Product Name</label>
            <input
              type="text"
              required
              placeholder={type === 'bottle' ? 'e.g. 750ml Bottle' : 'e.g. 38mm Flip Cap'}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 text-xs font-medium text-slate-800 rounded-xl border border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">SKU Code</label>
            <input
              type="text"
              placeholder="e.g. BTL-750"
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 text-xs font-medium text-slate-800 rounded-xl border border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {type === 'bottle' ? 'Volume / Size Spec' : 'Neck Type / Thread Spec'}
            </label>
            <input
              type="text"
              placeholder={type === 'bottle' ? '750 ml' : '38 mm neck'}
              value={sizeOrType}
              onChange={(e) => setSizeOrType(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 text-xs font-medium text-slate-800 rounded-xl border border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
        </div>

        {/* Price Tiers */}
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
          <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
            Price Tiers (A / B / C per unit)
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Price A (Standard ₹)</label>
              <input
                type="number"
                step="0.01"
                required
                value={priceA}
                onChange={(e) => setPriceA(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 text-xs bg-white rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Price B (Wholesale ₹)</label>
              <input
                type="number"
                step="0.01"
                required
                value={priceB}
                onChange={(e) => setPriceB(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 text-xs bg-white rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Price C (Special ₹)</label>
              <input
                type="number"
                step="0.01"
                required
                value={priceC}
                onChange={(e) => setPriceC(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 text-xs bg-white rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>
        </div>

        {/* Stock & Unit */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Current Stock</label>
            <input
              type="number"
              value={currentStock}
              onChange={(e) => setCurrentStock(parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 bg-slate-50 text-xs font-medium text-slate-800 rounded-xl border border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Minimum Alert Stock</label>
            <input
              type="number"
              value={minimumStock}
              onChange={(e) => setMinimumStock(parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 bg-slate-50 text-xs font-medium text-slate-800 rounded-xl border border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Unit</label>
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 text-xs font-medium text-slate-800 rounded-xl border border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="pcs">pcs</option>
              <option value="units">units</option>
              <option value="boxes">boxes</option>
            </select>
          </div>
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
            <Package className="w-4 h-4" />
            <span>{loading ? uploadStatusText || 'Saving...' : initialProduct ? 'Update Product' : 'Add Product'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
