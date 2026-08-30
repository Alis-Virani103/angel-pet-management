import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from '../components/common/Sidebar';
import { Header } from '../components/common/Header';

interface AppLayoutProps {
  onOpenNewOrderModal?: () => void;
  onOpenAddCustomerModal?: () => void;
  onOpenRecordPaymentModal?: () => void;
  onOpenNewDispatchModal?: () => void;
  onOpenAddFinishedGoodsModal?: () => void;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  onOpenNewOrderModal,
  onOpenAddCustomerModal,
  onOpenRecordPaymentModal,
  onOpenNewDispatchModal,
  onOpenAddFinishedGoodsModal
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar (Desktop Fixed & Mobile Drawer) */}
      <Sidebar
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed(!collapsed)}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      {/* Main Content Area */}
      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ml-0 ${
          collapsed ? 'md:ml-20' : 'md:ml-64'
        }`}
      >
        {/* Top Sticky Header */}
        <Header
          collapsed={collapsed}
          mobileOpen={mobileMenuOpen}
          onToggleMobileMenu={() => setMobileMenuOpen(!mobileMenuOpen)}
          onOpenNewOrderModal={onOpenNewOrderModal}
          onOpenAddCustomerModal={onOpenAddCustomerModal}
          onOpenRecordPaymentModal={onOpenRecordPaymentModal}
          onOpenNewDispatchModal={onOpenNewDispatchModal}
          onOpenAddFinishedGoodsModal={onOpenAddFinishedGoodsModal}
        />

        {/* Page Container */}
        <main className="flex-1 mt-16 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

