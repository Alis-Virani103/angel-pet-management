import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Bell,
  Plus,
  User,
  Database,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  Layers,
  ShoppingCart,
  ShoppingBag,
  Boxes,
  Truck,
  IndianRupee,
  Menu
} from 'lucide-react';
import { seedDatabase } from '../../services/db';
import { useTranslation } from '../../i18n';

interface HeaderProps {
  collapsed: boolean;
  mobileOpen?: boolean;
  onToggleMobileMenu?: () => void;
  onOpenNewOrderModal?: () => void;
  onOpenAddCustomerModal?: () => void;
  onOpenRecordPaymentModal?: () => void;
  onOpenNewDispatchModal?: () => void;
  onOpenAddFinishedGoodsModal?: () => void;
  onOpenNewPurchaseModal?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  collapsed,
  mobileOpen = false,
  onToggleMobileMenu,
  onOpenNewOrderModal,
  onOpenAddCustomerModal,
  onOpenRecordPaymentModal,
  onOpenNewDispatchModal,
  onOpenAddFinishedGoodsModal,
  onOpenNewPurchaseModal
}) => {
  const { language, setLanguage, t } = useTranslation();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [resetMessage, setResetMessage] = useState('');

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/sales?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleResetData = async () => {
    await seedDatabase(true);
    setResetMessage(t('Database reset to reference demo data!'));
    setTimeout(() => {
      setResetMessage('');
      window.location.reload();
    }, 800);
  };

  return (
    <header
      className={`fixed top-0 right-0 z-20 h-16 bg-white/90 backdrop-blur-md border-b border-slate-200 transition-all duration-300 flex items-center justify-between px-3 sm:px-6 left-0 ${
        collapsed ? 'md:left-20' : 'md:left-64'
      }`}
    >
      {/* Left Section: Mobile Menu Toggle & Brand / Search Input */}
      <div className="flex items-center space-x-2 sm:space-x-4 flex-1 pr-2">
        {/* Mobile Hamburger Toggle Button */}
        <button
          onClick={onToggleMobileMenu}
          className="md:hidden p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors shrink-0"
          title={t('Open menu')}
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Search Input Form */}
        <form onSubmit={handleSearchSubmit} className="relative w-full max-w-[200px] sm:max-w-xs md:max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={t('Search orders...')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 sm:py-2 bg-slate-100 hover:bg-slate-100/80 focus:bg-white text-xs font-medium text-slate-800 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
        </form>
      </div>

      {/* Actions & User Controls */}
      <div className="flex items-center space-x-1.5 sm:space-x-3 shrink-0">
        <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
          <span className="hidden lg:inline">{t('Language')}</span>
          <select
            aria-label={t('Select language')}
            value={language}
            onChange={(event) => setLanguage(event.target.value as 'en' | 'gu')}
            className="px-2 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="en">English</option>
            <option value="gu">ગુજરાતી</option>
          </select>
        </label>
        {/* Quick Action Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowQuickActions(!showQuickActions)}
            className="flex items-center space-x-1 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs shadow-sm shadow-blue-500/30 transition-colors"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">{t('Create New')}</span>
            <ChevronDown className="w-3.5 h-3.5 opacity-80 shrink-0" />
          </button>


          {showQuickActions && (
            <div
              className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200"
              onMouseLeave={() => setShowQuickActions(false)}
            >
              <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                {t('Quick Actions')}
              </div>
              <button
                onClick={() => {
                  setShowQuickActions(false);
                  onOpenNewOrderModal ? onOpenNewOrderModal() : navigate('/sales');
                }}
                className="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center space-x-2.5 text-xs text-slate-700 font-medium"
              >
                <ShoppingCart className="w-4 h-4 text-blue-600" />
                <span>{t('New Sales Order')}</span>
              </button>
              <button
                onClick={() => {
                  setShowQuickActions(false);
                  onOpenNewPurchaseModal ? onOpenNewPurchaseModal() : navigate('/purchases');
                }}
                className="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center space-x-2.5 text-xs text-slate-700 font-medium"
              >
                <ShoppingBag className="w-4 h-4 text-indigo-600" />
                <span>{t('New Purchase Entry')}</span>
              </button>
              <button
                onClick={() => {
                  setShowQuickActions(false);
                  onOpenAddCustomerModal ? onOpenAddCustomerModal() : navigate('/customers');
                }}
                className="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center space-x-2.5 text-xs text-slate-700 font-medium"
              >
                <User className="w-4 h-4 text-emerald-600" />
                <span>{t('Add Customer')}</span>
              </button>
              <button
                onClick={() => {
                  setShowQuickActions(false);
                  onOpenAddFinishedGoodsModal ? onOpenAddFinishedGoodsModal() : navigate('/finished-goods');
                }}
                className="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center space-x-2.5 text-xs text-slate-700 font-medium"
              >
                <Boxes className="w-4 h-4 text-purple-600" />
                <span>{t('Add Finished Goods Stock')}</span>
              </button>
              <button
                onClick={() => {
                  setShowQuickActions(false);
                  onOpenRecordPaymentModal ? onOpenRecordPaymentModal() : navigate('/finance');
                }}
                className="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center space-x-2.5 text-xs text-slate-700 font-medium"
              >
                <IndianRupee className="w-4 h-4 text-amber-600" />
                <span>{t('Record Payment')}</span>
              </button>
              <button
                onClick={() => {
                  setShowQuickActions(false);
                  onOpenNewDispatchModal ? onOpenNewDispatchModal() : navigate('/dispatch');
                }}
                className="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center space-x-2.5 text-xs text-slate-700 font-medium"
              >
                <Truck className="w-4 h-4 text-sky-600" />
                <span>{t('New Dispatch')}</span>
              </button>
            </div>
          )}
        </div>

        {/* Notifications Button */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors relative"
            title="Notifications"
          >
            <Bell className="w-5 h-5" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-amber-500 rounded-full ring-2 ring-white"></span>
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-slate-100 py-3 z-50">
              <div className="px-4 pb-2 border-b border-slate-100 flex items-center justify-between">
                <span className="font-semibold text-xs text-slate-800">Alerts & System Notifications</span>
                <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-semibold">
                  3 Active
                </span>
              </div>
              <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                <div className="p-3 hover:bg-slate-50 flex items-start space-x-3 text-xs">
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-slate-800">500ml Bottle Stock Low</p>
                    <p className="text-[11px] text-slate-500">Current stock (1,250) below minimum limit (3,000).</p>
                  </div>
                </div>
                <div className="p-3 hover:bg-slate-50 flex items-start space-x-3 text-xs">
                  <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-slate-800">45mm Cap Stock Low</p>
                    <p className="text-[11px] text-slate-500">Current stock (1,400) below minimum limit (3,000).</p>
                  </div>
                </div>
                <div className="p-3 hover:bg-slate-50 flex items-start space-x-3 text-xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-slate-800">Payment Received (REC-5021)</p>
                    <p className="text-[11px] text-slate-500">₹50,000 received from MediCare Labs.</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* User Profile / Settings Menu */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center space-x-2 pl-2 pr-3 py-1 rounded-xl hover:bg-slate-100 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs">
              AD
            </div>
            <div className="hidden md:flex flex-col text-left">
              <span className="text-xs font-semibold text-slate-800">Admin</span>
              <span className="text-[10px] text-slate-500">Angel Pet</span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 z-50">
              <div className="px-4 py-2 border-b border-slate-100">
                <p className="font-semibold text-xs text-slate-800">Admin Owner</p>
                <p className="text-[11px] text-slate-500">admin@angelpet.com</p>
              </div>
              <button
                onClick={() => {
                  setShowUserMenu(false);
                  navigate('/settings');
                }}
                className="w-full text-left px-4 py-2 hover:bg-slate-50 text-xs text-slate-700 flex items-center space-x-2 font-medium"
              >
                <Layers className="w-4 h-4 text-slate-500" />
                <span>Company Settings</span>
              </button>
              <button
                onClick={handleResetData}
                className="w-full text-left px-4 py-2 hover:bg-slate-50 text-xs text-amber-700 flex items-center space-x-2 font-medium"
              >
                <Database className="w-4 h-4 text-amber-500" />
                <span>Reset Demo Seed Data</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {resetMessage && (
        <div className="absolute top-18 right-6 bg-emerald-600 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-lg animate-in fade-in">
          {resetMessage}
        </div>
      )}
    </header>
  );
};
