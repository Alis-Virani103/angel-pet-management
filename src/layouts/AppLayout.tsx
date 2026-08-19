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

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Fixed Left Sidebar */}
      <Sidebar collapsed={collapsed} onToggleCollapse={() => setCollapsed(!collapsed)} />

      {/* Main Content Area */}
      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${
          collapsed ? 'ml-20' : 'ml-64'
        }`}
      >
        {/* Top Sticky Header */}
        <Header
          collapsed={collapsed}
          onOpenNewOrderModal={onOpenNewOrderModal}
          onOpenAddCustomerModal={onOpenAddCustomerModal}
          onOpenRecordPaymentModal={onOpenRecordPaymentModal}
          onOpenNewDispatchModal={onOpenNewDispatchModal}
          onOpenAddFinishedGoodsModal={onOpenAddFinishedGoodsModal}
        />

        {/* Page Container */}
        <main className="flex-1 mt-16 p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
