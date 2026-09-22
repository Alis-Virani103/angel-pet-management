import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { DocumentCategory } from '../../types';
import { uploadDocument } from '../../services/db';
import { UploadCloud, FileText, AlertCircle } from 'lucide-react';

interface UploadDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDocumentUploaded?: () => void;
}

export const UploadDocumentModal: React.FC<UploadDocumentModalProps> = ({
  isOpen,
  onClose,
  onDocumentUploaded
}) => {
  const [category, setCategory] = useState<DocumentCategory>('gst');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError('');
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    e.stopPropagation();

    // Prevent submission when no file is selected
    if (!file) {
      setError('Please choose a file to upload.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await uploadDocument(file, category);

      if (onDocumentUploaded) {
        onDocumentUploaded();
      }

      setFile(null);
      onClose();
    } catch (err) {
      console.error('Document upload failed:', err);

      setError(
        err instanceof Error
          ? err.message
          : 'Failed to upload document. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Upload Compliance / Business Document"
      subtitle="Upload files to Firebase Storage and track document metadata"
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2 font-medium">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div>
          <label className="form-label">
            Document Category
          </label>

          <select
            value={category}
            onChange={(e) =>
              setCategory(e.target.value as DocumentCategory)
            }
            className="form-select"
          >
            <option value="gst">
              GST Registration & Tax Certificates
            </option>
            <option value="invoice">Invoices & Bills</option>
            <option value="bill">Delivery / Lorry Bills</option>
            <option value="kyc">KYC & Compliance Permits</option>
            <option value="contract">
              Client Contracts & Pricing Agreements
            </option>
            <option value="general">General Documents</option>
          </select>
        </div>

        {/* File Drag Drop Input */}
        <div>
          <label className="form-label">
            Choose File
          </label>

          <div className="border-2 border-dashed border-slate-200 hover:border-blue-400 bg-slate-50 hover:bg-blue-50/30 rounded-2xl p-6 text-center transition-all cursor-pointer relative">
            <input
              type="file"
              required
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />

            <div className="flex flex-col items-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                <UploadCloud className="w-6 h-6" />
              </div>

              <div className="text-xs font-semibold text-slate-800">
                {file
                  ? file.name
                  : 'Click or Drag file to upload'}
              </div>

              <div className="text-[11px] text-slate-500">
                {file
                  ? `${(file.size / 1024).toFixed(1)} KB — ${
                      file.type || 'File'
                    }`
                  : 'PDF, PNG, JPG, or DOCX up to 10MB'}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="btn-secondary"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={loading || !file}
            className="btn-primary"
          >
            <UploadCloud className="w-4 h-4" />

            <span>
              {loading ? 'Uploading...' : 'Upload Document'}
            </span>
          </button>
        </div>
      </form>
    </Modal>
  );
};