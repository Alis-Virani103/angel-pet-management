import React, { useEffect, useState } from 'react';
import { DocumentItem } from '../types';
import { getDocuments, deleteDocument } from '../services/db';
import {
  FileText,
  Download,
  Trash2,
  Search,
  Plus,
} from 'lucide-react';
import { useTranslation } from '../i18n';

interface DocumentsProps {
  onOpenUploadDocumentModal: () => void;
}

export const Documents: React.FC<DocumentsProps> = ({
  onOpenUploadDocumentModal,
}) => {
  const { t } = useTranslation();
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDocs();
  }, []);

  const loadDocs = async () => {
    setLoading(true);

    try {
      const list = await getDocuments();
      setDocuments(list);
    } catch (error) {
      console.error('Failed to load documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDoc = async (
    id: string,
    storagePath?: string
  ) => {
    const confirmed = window.confirm(
      'Are you sure you want to delete this document?'
    );

    if (!confirmed) return;

    try {
      await deleteDocument(id, storagePath);
      await loadDocs();
    } catch (error) {
      console.error('Failed to delete document:', error);
      alert('Failed to delete the document. Please try again.');
    }
  };

  const filteredDocs = documents.filter((doc) => {
    const matchesCategory =
      activeCategory === 'all' ||
      doc.category === activeCategory;

    const query = searchQuery.trim().toLowerCase();

    const matchesSearch =
      query === '' ||
      doc.name.toLowerCase().includes(query) ||
      doc.category.toLowerCase().includes(query);

    return matchesCategory && matchesSearch;
  });

  const categories = [
    { key: 'all', label: 'All Files' },
    { key: 'gst', label: 'GST Certificates' },
    { key: 'invoice', label: 'Invoices' },
    { key: 'bill', label: 'Delivery Bills' },
    { key: 'kyc', label: 'KYC & Permits' },
    { key: 'contract', label: 'Contracts' },
  ];

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            {t('Documents Workspace')}
          </h1>

          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Store, categorize and download business files backed by Firebase Storage
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenUploadDocumentModal}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-md shadow-blue-500/20 transition-colors flex items-center gap-2 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>{t('Upload Document')}</span>
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">

        {/* Categories */}
        <div className="flex flex-wrap items-center gap-1.5">
          {categories.map((category) => (
            <button
              type="button"
              key={category.key}
              onClick={() => setActiveCategory(category.key)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all ${
                activeCategory === category.key
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                  : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
              }`}
            >
              {t(category.label)}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />

          <input
            type="text"
            placeholder={t('Search documents...')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 text-xs font-medium text-slate-800 rounded-xl border border-slate-200 outline-none focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
        </div>
      </div>

      {/* Documents */}
      {loading ? (
        <div className="bg-white p-12 text-center rounded-3xl border border-slate-100">
          <div className="flex flex-col items-center gap-3">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />

            <p className="text-xs text-slate-400 font-medium">
              {t('Loading documents...')}
            </p>
          </div>
        </div>
      ) : filteredDocs.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-3xl border border-slate-100">
          <FileText className="w-10 h-10 mx-auto text-slate-300 mb-3" />

          <p className="text-sm text-slate-500 font-semibold">
            No documents found
          </p>

          <p className="text-xs text-slate-400 mt-1">
            Try changing the category or search query.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

          {filteredDocs.map((doc) => {
            const hasDownloadUrl =
              Boolean(doc.downloadUrl) &&
              doc.downloadUrl !== '#';

            return (
              <div
                key={doc.id}
                className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4"
              >

                {/* Document information */}
                <div className="flex items-start gap-3">

                  <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>

                  <div className="flex-1 min-w-0">

                    <h3
                      className="text-xs font-bold text-slate-900 truncate"
                      title={doc.name}
                    >
                      {doc.name}
                    </h3>

                    <div className="flex items-center gap-2 mt-1">

                      <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px] font-semibold uppercase">
                        {doc.category}
                      </span>

                      <span className="text-[10px] text-slate-400">
                        {doc.fileSize
                          ? `${(doc.fileSize / 1024).toFixed(0)} KB`
                          : 'Unknown size'}
                      </span>

                    </div>
                  </div>
                </div>

                {/* Bottom actions */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-100">

                  <span className="text-[11px] text-slate-400">
                    Uploaded {doc.uploadDate}
                  </span>

                  <div className="flex items-center gap-2">

                    {/* Download */}
                    {hasDownloadUrl ? (
                      <a
                        href={doc.downloadUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 font-semibold transition-colors flex items-center gap-1 text-xs"
                        title="Download File"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download</span>
                      </a>
                    ) : (
                      <button
                        type="button"
                        disabled
                        className="p-2 rounded-xl bg-slate-100 text-slate-400 font-semibold flex items-center gap-1 text-xs cursor-not-allowed"
                        title="No file available"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Unavailable</span>
                      </button>
                    )}

                    {/* Delete */}
                    <button
                      type="button"
                      onClick={() =>
                        handleDeleteDoc(
                          doc.id,
                          doc.storagePath
                        )
                      }
                      className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      title="Delete File"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

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