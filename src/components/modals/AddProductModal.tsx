import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Product, ProductType, ProductStatus } from '../../types';
import { addProduct, updateProduct, getProducts } from '../../services/db';
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
  const [allProducts, setAllProducts] = useState<Product[]>([]);
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
  const [unitsPerPacket, setUnitsPerPacket] = useState('');
  const [compatibleCapId, setCompatibleCapId] = useState('');
  const [compatibleInnerId, setCompatibleInnerId] = useState('');
  const [comboPriceA, setComboPriceA] = useState<string | number>('');
  const [comboPriceB, setComboPriceB] = useState<string | number>('');
  const [comboPriceC, setComboPriceC] = useState<string | number>('');
  const [weightPerPiece, setWeightPerPiece] = useState<string | number>('');
  const [weightUnit, setWeightUnit] = useState<'g' | 'kg'>('g');
  const [status, setStatus] = useState<ProductStatus>('active');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [uploadStatusText, setUploadStatusText] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      getProducts().then(setAllProducts).catch(console.error);
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
        setUnitsPerPacket(
          typeof initialProduct.unitsPerPacket === 'number' && initialProduct.unitsPerPacket > 0
            ? String(initialProduct.unitsPerPacket)
            : ''
        );
        setCompatibleCapId(initialProduct.compatibleCapId || '');
        setCompatibleInnerId(initialProduct.compatibleInnerId || '');
        setComboPriceA(
          typeof initialProduct.comboPriceA === 'number' && initialProduct.comboPriceA > 0
            ? initialProduct.comboPriceA
            : ''
        );
        setComboPriceB(
          typeof initialProduct.comboPriceB === 'number' && initialProduct.comboPriceB > 0
            ? initialProduct.comboPriceB
            : ''
        );
        setComboPriceC(
          typeof initialProduct.comboPriceC === 'number' && initialProduct.comboPriceC > 0
            ? initialProduct.comboPriceC
            : ''
        );
        setWeightPerPiece(
          typeof initialProduct.weightPerPiece === 'number' && initialProduct.weightPerPiece > 0
            ? initialProduct.weightPerPiece
            : ''
        );
        setWeightUnit(initialProduct.weightUnit === 'kg' ? 'kg' : 'g');
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
        setUnitsPerPacket('');
        setCompatibleCapId('');
        setCompatibleInnerId('');
        setComboPriceA('');
        setComboPriceB('');
        setComboPriceC('');
        setWeightPerPiece('');
        setWeightUnit('g');
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
    if ([priceA, priceB, priceC, currentStock, minimumStock].some((value) => !Number.isFinite(value) || value < 0)) {
      setError('Prices and stock values must be valid non-negative numbers.');
      return;
    }

    const packetInput = unitsPerPacket.trim();
    let parsedUnitsPerPacket: number | undefined;
    if (packetInput !== '') {
      const parsed = Number(packetInput);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        setError('Units per Packet must be a positive whole number.');
        return;
      }
      parsedUnitsPerPacket = parsed;
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

      const parsedComboPriceA = comboPriceA !== '' && !isNaN(Number(comboPriceA)) && Number(comboPriceA) > 0 ? Number(comboPriceA) : undefined;
      const parsedComboPriceB = comboPriceB !== '' && !isNaN(Number(comboPriceB)) && Number(comboPriceB) > 0 ? Number(comboPriceB) : undefined;
      const parsedComboPriceC = comboPriceC !== '' && !isNaN(Number(comboPriceC)) && Number(comboPriceC) > 0 ? Number(comboPriceC) : undefined;

      let parsedWeightPerPiece: number | undefined = undefined;
      let parsedWeightUnit: 'g' | 'kg' | undefined = undefined;
      if (weightPerPiece !== '' && weightPerPiece !== null && weightPerPiece !== undefined) {
        const parsedW = Number(weightPerPiece);
        if (isNaN(parsedW) || parsedW <= 0) {
          setError('Weight per piece must be a valid positive number.');
          setLoading(false);
          return;
        }
        parsedWeightPerPiece = parsedW;
        parsedWeightUnit = weightUnit;
      }

      if (initialProduct) {
        const updates = {
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
          unitsPerPacket: parsedUnitsPerPacket,
          ...(type === 'bottle'
            ? {
                compatibleCapId: compatibleCapId || undefined,
                compatibleInnerId: compatibleInnerId || undefined,
                comboPriceA: parsedComboPriceA,
                comboPriceB: parsedComboPriceB,
                comboPriceC: parsedComboPriceC
              }
            : {}),
          weightPerPiece: parsedWeightPerPiece,
          weightUnit: parsedWeightUnit,
          status
        } as Partial<Product>;
        if (imageFile) {
          updates.imageUrl = finalImageUrl;
          updates.cloudinaryPublicId = finalPublicId;
        }
        await updateProduct(initialProduct.id, updates);
      } else {
        const skuPrefix = type === 'bottle' ? 'BTL' : type === 'inner' ? 'INR' : 'CAP';
        await addProduct({
          name: name.trim(),
          sku: sku.trim() || `${skuPrefix}-${Math.floor(100 + Math.random() * 900)}`,
          type,
          sizeOrType: sizeOrType.trim() || name.trim(),
          description: description.trim(),
          priceA: Number(priceA),
          priceB: Number(priceB),
          priceC: Number(priceC),
          currentStock: Number(currentStock),
          minimumStock: Number(minimumStock),
          unit,
          ...(parsedUnitsPerPacket ? { unitsPerPacket: parsedUnitsPerPacket } : {}),
          ...(type === 'bottle'
            ? {
                compatibleCapId: compatibleCapId || undefined,
                compatibleInnerId: compatibleInnerId || undefined,
                comboPriceA: parsedComboPriceA,
                comboPriceB: parsedComboPriceB,
                comboPriceC: parsedComboPriceC
              }
            : {}),
          weightPerPiece: parsedWeightPerPiece,
          weightUnit: parsedWeightUnit,
          status,
          imageUrl: finalImageUrl,
          cloudinaryPublicId: finalPublicId
        });
      }

      if (onProductAdded) onProductAdded();
      onClose();
    } catch (err) {
      console.error('Product save failed:', err);
      const detail = err instanceof Error ? ` ${err.message}` : '';
      setError(`${initialProduct ? 'Failed to update product.' : 'Failed to add product.'}${detail}`);
    } finally {
      setLoading(false);
      setUploadStatusText('');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialProduct ? 'Edit Product Spec' : type === 'bottle' ? 'Add New Bottle Spec' : type === 'inner' ? 'Add New Inner Spec' : 'Add New Cap Spec'}
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
            <label className="form-label">Product Category</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as ProductType)}
              className="form-select"
            >
              <option value="bottle">Bottle</option>
              <option value="cap">Cap</option>
              <option value="inner">Inner</option>
            </select>
          </div>

          <div>
            <label className="form-label">Product Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="form-input"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="form-label">SKU Code</label>
            <input
              type="text"
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              className="form-input"
            />
          </div>

          <div>
            <label className="form-label">
              {type === 'bottle' ? 'Volume / Size Spec' : 'Neck Type / Thread Spec'}
            </label>
            <input
              type="text"
              value={sizeOrType}
              onChange={(e) => setSizeOrType(e.target.value)}
              className="form-input"
            />
          </div>
        </div>

        {/* Price Tiers */}
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
          <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
            Price Tiers (A / B / C per unit)
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="form-label">Price A (Standard ₹)</label>
              <input
                type="number"
                step="0.01"
                required
                value={priceA}
                onChange={(e) => setPriceA(parseFloat(e.target.value) || 0)}
                className="form-input bg-white"
              />
            </div>
            <div>
              <label className="form-label">Price B (Wholesale ₹)</label>
              <input
                type="number"
                step="0.01"
                required
                value={priceB}
                onChange={(e) => setPriceB(parseFloat(e.target.value) || 0)}
                className="form-input bg-white"
              />
            </div>
            <div>
              <label className="form-label">Price C (Special ₹)</label>
              <input
                type="number"
                step="0.01"
                required
                value={priceC}
                onChange={(e) => setPriceC(parseFloat(e.target.value) || 0)}
                className="form-input bg-white"
              />
            </div>
          </div>
        </div>

        {/* COMBO CONFIGURATION (Only for Bottle Products) */}
        {type === 'bottle' && (
          <div className="p-4 bg-blue-50/70 rounded-2xl border border-blue-100 space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                Combo Configuration
              </label>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Set compatible components and bundled Bottle + Inner + Cap combo pricing.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="form-label">Compatible Inner</label>
                <select
                  value={compatibleInnerId}
                  onChange={(e) => setCompatibleInnerId(e.target.value)}
                  className="form-select bg-white"
                >
                  <option value="">Select Inner Product</option>
                  {allProducts
                    .filter((p) => p.type === 'inner')
                    .map((inner) => (
                      <option key={inner.id} value={inner.id}>
                        {inner.name} ({inner.sizeOrType || inner.sku})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="form-label">Compatible Cap</label>
                <select
                  value={compatibleCapId}
                  onChange={(e) => setCompatibleCapId(e.target.value)}
                  className="form-select bg-white"
                >
                  <option value="">Select Cap Product</option>
                  {allProducts
                    .filter((p) => p.type === 'cap')
                    .map((cap) => (
                      <option key={cap.id} value={cap.id}>
                        {cap.name} ({cap.sizeOrType || cap.sku})
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div>
                <label className="form-label">COMBO PRICE — A</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-semibold">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Combo Price A"
                    value={comboPriceA}
                    onChange={(e) => setComboPriceA(e.target.value)}
                    className="form-input bg-white pl-7"
                  />
                </div>
              </div>
              <div>
                <label className="form-label">COMBO PRICE — B</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-semibold">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Combo Price B"
                    value={comboPriceB}
                    onChange={(e) => setComboPriceB(e.target.value)}
                    className="form-input bg-white pl-7"
                  />
                </div>
              </div>
              <div>
                <label className="form-label">COMBO PRICE — C</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-semibold">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Combo Price C"
                    value={comboPriceC}
                    onChange={(e) => setComboPriceC(e.target.value)}
                    className="form-input bg-white pl-7"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Stock & Unit */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="form-label">Current Stock</label>
            <input
              type="number"
              value={currentStock}
              onChange={(e) => setCurrentStock(parseInt(e.target.value) || 0)}
              className="form-input"
            />
          </div>

          <div>
            <label className="form-label">Minimum Alert Stock</label>
            <input
              type="number"
              value={minimumStock}
              onChange={(e) => setMinimumStock(parseInt(e.target.value) || 0)}
              className="form-input"
            />
          </div>

          <div>
            <label className="form-label">Unit</label>
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="form-select"
            >
              <option value="pcs">pcs</option>
              <option value="units">units</option>
              <option value="boxes">boxes</option>
            </select>
          </div>

          <div>
            <label className="form-label">Units per Packet (Optional)</label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={unitsPerPacket}
              onChange={(e) => setUnitsPerPacket(e.target.value.replace(/\D/g, ''))}
              className="form-input"
            />
            <p className="text-[11px] text-slate-400 mt-1">Leave empty if this product is not sold in packets.</p>
          </div>
        </div>

        {/* Weight Configuration */}
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
          <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
            Weight Configuration (Optional)
          </label>
          <p className="text-[11px] text-slate-500">
            Set individual unit weight used for shipment and invoice weight conversions.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div>
              <label className="form-label">Weight per Piece</label>
              <input
                type="number"
                step="any"
                min="0.0001"
                placeholder="e.g. 10 or 0.01"
                value={weightPerPiece}
                onChange={(e) => setWeightPerPiece(e.target.value)}
                className="form-input bg-white"
              />
            </div>
            <div>
              <label className="form-label">Unit</label>
              <select
                value={weightUnit}
                onChange={(e) => setWeightUnit(e.target.value as 'g' | 'kg')}
                className="form-select bg-white"
              >
                <option value="g">grams (g)</option>
                <option value="kg">kilograms (kg)</option>
              </select>
            </div>
          </div>
          {weightPerPiece !== '' && Number(weightPerPiece) > 0 && (
            <p className="text-[11px] text-blue-600 font-semibold pt-1">
              ✓ 1 {type} = {weightPerPiece} {weightUnit}
            </p>
          )}
        </div>

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
            <Package className="w-4 h-4" />
            <span>{loading ? (uploadStatusText || 'Saving...') : initialProduct ? 'Update Product' : 'Add Product'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
