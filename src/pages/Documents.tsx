import React, { useState, useEffect } from 'react';
import { DocumentItem, DocumentCategory } from '../types';
import { getDocuments, deleteDocument } from '../services/db';
import {
  FileText,
  UploadCloud,
  Download,
  Trash2,
  Search,
  CheckCircle2,
  FileCheck,
  ShieldCheck,
  Plus
} from 'lucide-react';

interface DocumentsProps {
  onOpenUploadDocumentModal: () => void;
}

export const Documents: React.FC<DocumentsProps> = ({ onOpenUploadDocumentModal }) => {
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
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDoc = async (id: string, storagePath?: string) => {
    if (window.confirm('Delete this document?')) {
      try {
        await deleteDocument(id, storagePath);
        loadDocs();
      } catch (e) {
        console.error(e);
      }
    }
  };

  const filteredDocs = documents.filter((doc) => {
    const matchesCategory = activeCategory === 'all' || doc.category === activeCategory;
    const q = searchQuery.toLowerCase();
    const matchesSearch = doc.name.toLowerCase().includes(q) || doc.category.toLowerCase().includes(q);
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Title & Upload Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Documents Workspace</h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Store, categorize and download business files backed by Firebase Storage
          </p>
        </div>

        <button
          onClick={onOpenUploadDocumentModal}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-md shadow-blue-500/20 transition-colors flex items-center space-x-2 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Upload Document</span>
        </button>
      </div>

      {/* Category Filter Chips & Search Bar */}
      <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { key: 'all', label: 'All Files' },
            { key: 'gst', label: 'GST Certificates' },
            { key: 'invoice', label: 'Invoices' },
            { key: 'bill', label: 'Delivery Bills' },
            { key: 'kyc', label: 'KYC & Permits' },
            { key: 'contract', label: 'Contracts' }
          ].map((cat) => (
            <button
              key={cat.key}
              onClick={() => setActiveCategory(cat.key)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all ${
                activeCategory === cat.key
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                  : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 text-xs font-medium text-slate-800 rounded-xl border border-slate-200 focus:bg-white"
          />
        </div>
      </div>

      {/* Documents Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredDocs.length === 0 ? (
          <div className="col-span-full bg-white p-12 text-center rounded-3xl border border-slate-100 text-xs text-slate-400 font-medium">
            No documents found matching category or search query.
          </div>
        ) : (
          filteredDocs.map((doc) => (
            <div
              key={doc.id}
              className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4"
            >
              <div className="flex items-start space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-xs font-bold text-slate-900 truncate" title={doc.name}>
                    {doc.name}
                  </h3>
                  <div className="flex items-center space-x-2 mt-1">
                    <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px] font-semibold uppercase">
                      {doc.category}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {(doc.fileSize / 1024).toFixed(0)} KB
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs">
                <span className="text-[11px] text-slate-400">Uploaded {doc.uploadDate}</span>
                <div className="flex items-center space-x-2">
                  <a
                    href={doc.downloadUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 font-semibold transition-colors flex items-center gap-1 text-xs"
                    title="Download File"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download</span>
                  </a>
                  <button
                    onClick={() => handleDeleteDoc(doc.id, doc.storagePath)}
                    className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                    title="Delete File"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
