import React, { useState, useRef } from 'react';
import { Modal } from '../common/Modal';
import { PurchaseOrder, PurchasePhoto } from '../../types';
import { uploadToCloudinary } from '../../services/cloudinary';
import { updatePurchase } from '../../services/db';
import { Camera, X, Loader2, AlertCircle, Image as ImageIcon, Download, Trash2 } from 'lucide-react';

interface PurchasePhotosModalProps {
  isOpen: boolean;
  onClose: () => void;
  purchase: PurchaseOrder;
  onPhotosUpdated?: () => void;
}

export const PurchasePhotosModal: React.FC<PurchasePhotosModalProps> = ({
  isOpen,
  onClose,
  purchase,
  onPhotosUpdated
}) => {
  const [photos, setPhotos] = useState<PurchasePhoto[]>(purchase.photos || []);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');
  const [previewPhoto, setPreviewPhoto] = useState<PurchasePhoto | null>(null);
  const [deletingPhotoId, setDeletingPhotoId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

    if (!validTypes.includes(file.type)) {
      setError('Please select a valid image file (JPG, JPEG, PNG, or WebP).');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB.');
      return;
    }

    setUploading(true);
    setError('');
    setUploadProgress(0);

    try {
      setUploadProgress(30);
      const uploadResult = await uploadToCloudinary(file);
      setUploadProgress(70);

      const newPhoto: PurchasePhoto = {
        id: `photo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        url: uploadResult.secure_url,
        fileName: file.name,
        fileSize: file.size,
        uploadedAt: new Date().toISOString()
      };

      const updatedPhotos = [...photos, newPhoto];
      setPhotos(updatedPhotos);
      setUploadProgress(100);

      // Save to database
      await updatePurchase(purchase.id, { photos: updatedPhotos });

      if (onPhotosUpdated) {
        onPhotosUpdated();
      }

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      console.error('Photo upload failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to upload photo. Please try again.');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDeletePhoto = async (photoId: string) => {
    if (!window.confirm('Are you sure you want to delete this photo? This action cannot be undone.')) {
      return;
    }

    setDeletingPhotoId(photoId);
    setError('');

    try {
      const updatedPhotos = photos.filter((p) => p.id !== photoId);
      setPhotos(updatedPhotos);

      await updatePurchase(purchase.id, { photos: updatedPhotos });

      if (onPhotosUpdated) {
        onPhotosUpdated();
      }
    } catch (err) {
      console.error('Photo deletion failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete photo. Please try again.');
      // Revert on error
      setPhotos(photos);
    } finally {
      setDeletingPhotoId(null);
    }
  };

  const handleDownloadPhoto = (photo: PurchasePhoto) => {
    const link = document.createElement('a');
    link.href = photo.url;
    link.download = photo.fileName || `purchase-photo-${photo.id}`;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Purchase Photos"
        subtitle={`Manage photos for ${purchase.purchaseNumber}`}
        maxWidth="2xl"
      >
        <div className="space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Upload Section */}
          <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center hover:border-blue-400 transition-colors">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              onChange={handleFileSelect}
              disabled={uploading}
              className="hidden"
              id="photo-upload-input"
            />
            <label
              htmlFor="photo-upload-input"
              className={`cursor-pointer ${uploading ? 'pointer-events-none opacity-50' : ''}`}
            >
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                  {uploading ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : (
                    <Camera className="w-6 h-6" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-700">
                    {uploading ? 'Uploading...' : 'Click to upload photos'}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    JPG, JPEG, PNG, or WebP (max 10MB)
                  </p>
                </div>
                {uploading && (
                  <div className="w-full max-w-xs">
                    <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-600 transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                    <p className="text-xs text-slate-500 mt-1">{uploadProgress}%</p>
                  </div>
                )}
              </div>
            </label>
          </div>

          {/* Photos Grid */}
          {photos.length === 0 ? (
            <div className="text-center py-8">
              <ImageIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-500">No photos uploaded yet</p>
              <p className="text-xs text-slate-400 mt-1">Upload photos to document this purchase</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {photos.map((photo) => (
                <div
                  key={photo.id}
                  className="relative group aspect-square bg-slate-100 rounded-lg overflow-hidden border border-slate-200"
                >
                  <img
                    src={photo.url}
                    alt={photo.fileName}
                    className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => setPreviewPhoto(photo)}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="absolute bottom-0 left-0 right-0 p-2 flex items-center justify-between gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleDownloadPhoto(photo)}
                      className="p-1.5 bg-white/90 hover:bg-white rounded-md text-slate-700 hover:text-blue-600 transition-colors"
                      title="Download photo"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeletePhoto(photo.id)}
                      disabled={deletingPhotoId === photo.id}
                      className="p-1.5 bg-white/90 hover:bg-rose-100 rounded-md text-slate-700 hover:text-rose-600 transition-colors disabled:opacity-50"
                      title="Delete photo"
                    >
                      {deletingPhotoId === photo.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  <div className="absolute top-2 right-2 bg-black/50 text-white text-[10px] px-2 py-0.5 rounded">
                    {formatFileSize(photo.fileSize)}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Close Button */}
          <div className="flex justify-end pt-4 border-t border-slate-100">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>

      {/* Photo Preview Modal */}
      {previewPhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setPreviewPhoto(null)}
        >
          <div className="relative max-w-4xl max-h-full">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setPreviewPhoto(null);
              }}
              className="absolute -top-10 right-0 p-2 text-white hover:text-slate-300 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={previewPhoto.url}
              alt={previewPhoto.fileName}
              className="max-w-full max-h-[85vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
            <div className="mt-2 text-center text-white text-sm">
              {previewPhoto.fileName}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
