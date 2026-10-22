import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Product, ProductType, ProductStatus } from '../../types';
import { addProduct, updateProduct, getProducts } from '../../services/db';
import { cleanDecimalInput, cleanIntegerInput, getProductUnitsPerPacket } from '../../utils/packetUtils';
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
  const [priceA, setPriceA] = useState('');
  const [priceB, setPriceB] = useState('');
  const [priceC, setPriceC] = useState('');
  const [currentStock, setCurrentStock] = useState('1000');
  const [minimumStock, setMinimumStock] = useState('500');
  const [unit, setUnit] = useState('pcs');
  const [unitsPerPacket, setUnitsPerPacket] = useState('');
  const [allowFractionalPackets, setAllowFractionalPackets] = useState(true);
  const [compatibleCapId, setCompatibleCapId] = useState('');
  const [compatibleInnerId, setCompatibleInnerId] = useState('');
  const [comboPriceA, setComboPriceA] = useState('');
  const [comboPriceB, setComboPriceB] = useState('');
  const [comboPriceC, setComboPriceC] = useState('');
  const [weightPerPiece, setWeightPerPiece] = useState('');
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
        setPriceA(initialProduct.priceA !== undefined && initialProduct.priceA !== null ? cleanDecimalInput(String(initialProduct.priceA)) : '');
        setPriceB(initialProduct.priceB !== undefined && initialProduct.priceB !== null ? cleanDecimalInput(String(initialProduct.priceB)) : '');
        setPriceC(initialProduct.priceC !== undefined && initialProduct.priceC !== null ? cleanDecimalInput(String(initialProduct.priceC)) : '');
        setCurrentStock(initialProduct.currentStock !== undefined && initialProduct.currentStock !== null ? cleanIntegerInput(String(initialProduct.currentStock)) : '0');
        setMinimumStock(initialProduct.minimumStock !== undefined && initialProduct.minimumStock !== null ? cleanIntegerInput(String(initialProduct.minimumStock)) : '0');
        setUnit(initialProduct.unit || 'pcs');
        const savedUnitsPerPacket = getProductUnitsPerPacket(initialProduct);
        setUnitsPerPacket(savedUnitsPerPacket ? String(savedUnitsPerPacket) : '');
        setAllowFractionalPackets(initialProduct.allowFractionalPackets !== false);
        setCompatibleCapId(initialProduct.compatibleCapId || '');
        setCompatibleInnerId(initialProduct.compatibleInnerId || '');
        const rawComboA = initialProduct.comboPriceA as unknown;
        const numComboA = rawComboA !== undefined && rawComboA !== null && rawComboA !== '' ? Number(rawComboA) : NaN;
        setComboPriceA(!isNaN(numComboA) && numComboA > 0 ? (typeof rawComboA === 'number' ? rawComboA.toFixed(2) : cleanDecimalInput(String(rawComboA))) : '');
        const rawComboB = initialProduct.comboPriceB as unknown;
        const numComboB = rawComboB !== undefined && rawComboB !== null && rawComboB !== '' ? Number(rawComboB) : NaN;
        setComboPriceB(!isNaN(numComboB) && numComboB > 0 ? (typeof rawComboB === 'number' ? rawComboB.toFixed(2) : cleanDecimalInput(String(rawComboB))) : '');
        const rawComboC = initialProduct.comboPriceC as unknown;
        const numComboC = rawComboC !== undefined && rawComboC !== null && rawComboC !== '' ? Number(rawComboC) : NaN;
        setComboPriceC(!isNaN(numComboC) && numComboC > 0 ? (typeof rawComboC === 'number' ? rawComboC.toFixed(2) : cleanDecimalInput(String(rawComboC))) : '');
        const rawWeight = initialProduct.weightPerPiece ??
          (initialProduct as any).weight ??
          (initialProduct as any).pieceWeight ??
          (initialProduct as any).weightPerPieceGrams ??
          (initialProduct as any).unitWeight;
        const numWeight = rawWeight !== undefined && rawWeight !== null && rawWeight !== '' ? Number(rawWeight) : NaN;
        setWeightPerPiece(!isNaN(numWeight) && numWeight > 0 ? cleanDecimalInput(String(rawWeight)) : '');
        const rawUnit = initialProduct.weightUnit ?? (initialProduct as any).unitOfWeight;
        setWeightUnit(rawUnit === 'kg' ? 'kg' : 'g');
        setStatus(initialProduct.status || 'active');
        setImagePreview(initialProduct.imageUrl || '');
      } else {
        setName('');
        setSku('');
        setType(defaultType);
        setSizeOrType('');
        setDescription('');
        setPriceA('');
        setPriceB('');
        setPriceC('');
        setCurrentStock('1000');
        setMinimumStock('500');
        setUnit('pcs');
        setUnitsPerPacket('');
        setAllowFractionalPackets(true);
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
    const parsedPriceA = Number(priceA);
    const parsedPriceB = Number(priceB);
    const parsedPriceC = Number(priceC);
    const parsedCurrentStock = Number.parseInt(currentStock, 10);
    const parsedMinimumStock = Number.parseInt(minimumStock, 10);
    if (
      [priceA, priceB, priceC].some((value) => value.trim() === '') ||
      [currentStock, minimumStock].some((value) => value.trim() === '') ||
      [parsedPriceA, parsedPriceB, parsedPriceC, parsedCurrentStock, parsedMinimumStock].some((value) => !Number.isFinite(value) || value < 0)
    ) {
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
          priceA: parsedPriceA,
          priceB: parsedPriceB,
          priceC: parsedPriceC,
          currentStock: parsedCurrentStock,
          minimumStock: parsedMinimumStock,
          unit,
          ...(parsedUnitsPerPacket !== undefined
            ? { unitsPerPacket: parsedUnitsPerPacket, allowFractionalPackets }
            : {}),
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
          priceA: parsedPriceA,
          priceB: parsedPriceB,
          priceC: parsedPriceC,
          currentStock: parsedCurrentStock,
          minimumStock: parsedMinimumStock,
          unit,
          ...(parsedUnitsPerPacket ? { unitsPerPacket: parsedUnitsPerPacket, allowFractionalPackets } : {}),
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
                onChange={(e) => setPriceA(cleanDecimalInput(e.target.value))}
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
                onChange={(e) => setPriceB(cleanDecimalInput(e.target.value))}
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
                onChange={(e) => setPriceC(cleanDecimalInput(e.target.value))}
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="form-label">COMBO PRICE — A</label>
                <div className="flex w-full min-w-0 items-center rounded-xl border border-slate-200 bg-white focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20">
                  <span className="shrink-0 pl-3 text-xs font-semibold text-slate-400">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Combo Price A"
                    value={comboPriceA}
                    onChange={(e) => setComboPriceA(cleanDecimalInput(e.target.value))}
                    className="h-10 w-0 min-w-0 flex-1 border-0 bg-transparent px-2 text-left text-xs font-medium tabular-nums text-slate-800 outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="form-label">COMBO PRICE — B</label>
                <div className="flex w-full min-w-0 items-center rounded-xl border border-slate-200 bg-white focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20">
                  <span className="shrink-0 pl-3 text-xs font-semibold text-slate-400">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Combo Price B"
                    value={comboPriceB}
                    onChange={(e) => setComboPriceB(cleanDecimalInput(e.target.value))}
                    className="h-10 w-0 min-w-0 flex-1 border-0 bg-transparent px-2 text-left text-xs font-medium tabular-nums text-slate-800 outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="form-label">COMBO PRICE — C</label>
                <div className="flex w-full min-w-0 items-center rounded-xl border border-slate-200 bg-white focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20">
                  <span className="shrink-0 pl-3 text-xs font-semibold text-slate-400">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Combo Price C"
                    value={comboPriceC}
                    onChange={(e) => setComboPriceC(cleanDecimalInput(e.target.value))}
                    className="h-10 w-0 min-w-0 flex-1 border-0 bg-transparent px-2 text-left text-xs font-medium tabular-nums text-slate-800 outline-none"
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
              onChange={(e) => setCurrentStock(cleanIntegerInput(e.target.value))}
              className="form-input"
            />
          </div>

          <div>
            <label className="form-label">Minimum Alert Stock</label>
            <input
              type="number"
              value={minimumStock}
              onChange={(e) => setMinimumStock(cleanIntegerInput(e.target.value))}
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
              onChange={(e) => setUnitsPerPacket(cleanIntegerInput(e.target.value))}
              className="form-input"
            />
            <p className="text-[11px] text-slate-400 mt-1">Leave empty if this product is not sold in packets.</p>
            {unitsPerPacket.trim() !== '' && (
              <div className="mt-2.5 p-2.5 bg-slate-100/70 rounded-xl border border-slate-200/70">
                <label className="flex items-start gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={allowFractionalPackets}
                    onChange={(e) => setAllowFractionalPackets(e.target.checked)}
                    className="mt-0.5 rounded text-blue-600 focus:ring-0"
                  />
                  <div>
                    <span className="text-xs font-semibold text-slate-800">Allow Fractional Packets</span>
                    <p className="text-[10px] text-slate-500 leading-tight mt-0.5">
                      {allowFractionalPackets
                        ? 'Permits decimal packet counts (e.g. 2.5 packets). In Packets mode, total pieces = packet count × units/pkt.'
                        : 'Packets must be whole numbers (1, 2, 3...). Fractional quantities can only be ordered in Pieces mode.'}
                    </p>
                  </div>
                </label>
              </div>
            )}
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
                onChange={(e) => setWeightPerPiece(cleanDecimalInput(e.target.value))}
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
