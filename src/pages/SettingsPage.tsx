import React, { useState, useEffect } from 'react';
import { Settings } from '../types';
import { getSettings, updateSettings, seedDatabase } from '../services/db';
import {
  Settings as SettingsIcon,
  Building,
  Save,
  Database,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { useTranslation } from '../i18n';

export const SettingsPage: React.FC = () => {
  const { t } = useTranslation();
  const [settings, setSettingsState] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    loadSettingsData();
  }, []);

  const loadSettingsData = async () => {
    try {
      const data = await getSettings();
      setSettingsState(data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;

    setSaving(true);
    try {
      await updateSettings(settings);
      setSuccessMsg(t('Settings saved successfully!'));
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleResetSeed = async () => {
    try {
      await seedDatabase(true);
      setSuccessMsg(t('Database successfully reset to initial reference demo data!'));
      setTimeout(() => {
        window.location.reload();
      }, 800);
    } catch (e) {
      console.error(e);
    }
  };

  if (!settings) return <div className="p-8 text-center text-xs text-slate-400 font-medium">{t('Loading settings...')}</div>;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{t('Settings & Company Profile')}</h1>
        <p className="text-xs text-slate-500 font-medium mt-0.5">
          {t('Configure company parameters, GST invoicing rules, and demo database state')}
        </p>
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-2xl flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Company Profile Card */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center space-x-2 text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-3">
            <Building className="w-4 h-4 text-blue-600" />
            <span>{t('Company Profile Details')}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">{t('Company Registered Name')}</label>
              <input
                type="text"
                required
                value={settings.companyName}
                onChange={(e) => setSettingsState({ ...settings, companyName: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 text-xs font-medium text-slate-800 rounded-xl border border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">{t('GSTIN Tax ID')}</label>
              <input
                type="text"
                required
                value={settings.gstin}
                onChange={(e) => setSettingsState({ ...settings, gstin: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 text-xs font-medium text-slate-800 rounded-xl border border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">{t('Official Phone Number')}</label>
              <input
                type="text"
                required
                value={settings.phone}
                onChange={(e) => setSettingsState({ ...settings, phone: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 text-xs font-medium text-slate-800 rounded-xl border border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">{t('Official Email Address')}</label>
              <input
                type="email"
                required
                value={settings.email}
                onChange={(e) => setSettingsState({ ...settings, email: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 text-xs font-medium text-slate-800 rounded-xl border border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">{t('Registered Factory / Office Address')}</label>
            <textarea
              rows={2}
              value={settings.address}
              onChange={(e) => setSettingsState({ ...settings, address: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-slate-50 text-xs font-medium text-slate-800 rounded-xl border border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
        </div>

        {/* Invoice & Tax Settings */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center space-x-2 text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-3">
            <SettingsIcon className="w-4 h-4 text-purple-600" />
            <span>{t('Invoicing & Tax Parameters')}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">{t('Invoice Prefix')}</label>
              <input
                type="text"
                required
                value={settings.invoicePrefix}
                onChange={(e) => setSettingsState({ ...settings, invoicePrefix: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 text-xs font-medium text-slate-800 rounded-xl border border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">{t('Default GST Rate (%)')}</label>
              <input
                type="number"
                required
                value={settings.gstRate}
                onChange={(e) => setSettingsState({ ...settings, gstRate: parseFloat(e.target.value) || 0 })}
                className="w-full px-3.5 py-2.5 bg-slate-50 text-xs font-medium text-slate-800 rounded-xl border border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">{t('Default Client Price Category')}</label>
              <select
                value={settings.defaultPriceCategory}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSettingsState({ ...settings, defaultPriceCategory: e.target.value as any })}
                className="w-full px-3.5 py-2.5 bg-slate-50 text-xs font-medium text-slate-800 rounded-xl border border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="A">{t('Category A (Standard)')}</option>
                <option value="B">{t('Category B (Wholesale)')}</option>
                <option value="C">{t('Category C (Special)')}</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-lg shadow-blue-500/20 transition-all flex items-center space-x-2"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? t('Saving...') : t('Save Settings')}</span>
          </button>
        </div>
      </form>

      {/* Seed Reset Card */}
      <div className="bg-amber-50/60 p-6 rounded-3xl border border-amber-200 space-y-3">
        <div className="flex items-center space-x-2 text-xs font-bold text-amber-900 uppercase tracking-wider">
          <Database className="w-4 h-4 text-amber-600" />
          <span>{t('Demo Database Control')}</span>
        </div>
        <p className="text-xs text-amber-800">
          Reset all database collections (customers, products, orders, expenses, dispatches) to the reference application's initial demo seed dataset.
        </p>
        <button
          onClick={handleResetSeed}
          className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs rounded-xl shadow-sm transition-colors"
        >
          {t('Reset Demo Seed Data')}
        </button>
      </div>
    </div>
  );
};
