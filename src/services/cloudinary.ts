/**
 * Cloudinary Upload Helper Service
 * Handles secure unsigned client uploads to Cloudinary for product images.
 * Keeps API secrets off the client and provides automatic fallbacks.
 */

export interface CloudinaryUploadResult {
  secure_url: string;
  public_id: string;
}

function toDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error || new Error('Unable to read image file'));
    reader.readAsDataURL(file);
  });
}

export async function uploadToCloudinary(file: File | Blob): Promise<CloudinaryUploadResult> {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
  const folder = import.meta.env.VITE_CLOUDINARY_FOLDER || 'angel-pet';

  if (!cloudName || !uploadPreset) {
    throw new Error('Cloudinary configuration is missing.');
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', uploadPreset);
  formData.append('folder', folder);

  try {
    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: 'POST',
      body: formData
    });

    if (response.ok) {
      const data = await response.json();
      return {
        secure_url: data.secure_url,
        public_id: data.public_id
      };
    } else {
      const errorData = await response.json().catch(() => ({}));
      console.warn('Cloudinary upload returned status error:', errorData);
    }
  } catch (err) {
    console.warn('Cloudinary upload network request error:', err);
  }

  // Keep the fallback usable after the product is reloaded from storage.
  const fallbackUrl = await toDataUrl(file);
  return {
    secure_url: fallbackUrl,
    public_id: `fallback-${Date.now()}`
  };
}
