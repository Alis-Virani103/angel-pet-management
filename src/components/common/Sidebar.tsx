import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  ShoppingCart,
  Users,
  BarChart3,
  Package,
  Boxes,
  Layers,
  IndianRupee,
  Truck,
  FileText,
  Settings,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  X
} from 'lucide-react';

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/sales', label: 'Sales & Orders', icon: ShoppingCart },
  { path: '/customers', label: 'Customers', icon: Users },
  { path: '/analytics', label: 'Analytics', icon: BarChart3 },
  { path: '/products', label: 'Product Directory', icon: Package },
  { path: '/finished-goods', label: 'Finished Goods', icon: Boxes },
  { path: '/raw-materials', label: 'Raw Materials', icon: Layers },
  { path: '/finance', label: 'Finance', icon: IndianRupee },
  { path: '/dispatch', label: 'Dispatch', icon: Truck },
  { path: '/documents', label: 'Documents', icon: FileText },
  { path: '/settings', label: 'Settings', icon: Settings },
];

export const Sidebar: React.FC<SidebarProps> = ({
  collapsed,
  onToggleCollapse,
  mobileOpen = false,
  onCloseMobile
}) => {
  return (
    <>
      {/* Mobile Drawer Overlay Backdrop */}
      {mobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm md:hidden transition-opacity"
        />
      )}

      {/* Main Sidebar Drawer */}
      <aside
        className={`fixed top-0 left-0 z-40 h-screen bg-slate-900 text-slate-300 transition-all duration-300 flex flex-col border-r border-slate-800 ${
          mobileOpen
            ? 'translate-x-0 w-72 shadow-2xl'
            : '-translate-x-full md:translate-x-0'
        } ${collapsed ? 'md:w-20' : 'md:w-64'}`}
      >
        {/* Brand Header */}
        <div className="h-16 px-4 flex items-center justify-between border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center space-x-3 overflow-hidden">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-sky-400 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-blue-500/20 shrink-0">
              A
            </div>
            {(!collapsed || mobileOpen) && (
              <div className="flex flex-col truncate">
                <span className="font-bold text-white text-base tracking-tight truncate">ANGEL PET</span>
                <span className="text-[11px] text-blue-400 font-medium tracking-wide uppercase">Packaging ERP</span>
              </div>
            )}
          </div>

          {/* Desktop Toggle Button */}
          <button
            onClick={onToggleCollapse}
            className="hidden md:flex p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors focus:outline-none"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          </button>

          {/* Mobile Close Button */}
          <button
            onClick={onCloseMobile}
            className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors focus:outline-none"
            title="Close navigation"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation List */}
        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onCloseMobile}
                className={({ isActive }) =>
                  `flex items-center space-x-3 px-3 py-2.5 rounded-xl transition-all duration-200 text-sm font-medium ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                  }`
                }
                title={collapsed && !mobileOpen ? item.label : undefined}
              >
                <Icon className="w-5 h-5 shrink-0" />
                {(!collapsed || mobileOpen) && <span className="truncate">{item.label}</span>}
              </NavLink>
            );
          })}
        </div>

        {/* Footer Profile badge */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/40">
          <div className="flex items-center space-x-3 p-2 rounded-xl bg-slate-800/40">
            <div className="w-9 h-9 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-sm border border-blue-500/30 shrink-0">
              AD
            </div>
            {(!collapsed || mobileOpen) && (
              <div className="flex flex-col truncate">
                <span className="text-xs font-semibold text-slate-200 truncate">Admin Owner</span>
                <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-medium">
                  <ShieldCheck className="w-3 h-3" /> System Admin
                </span>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
};

