import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AppLayout } from './layouts/AppLayout';
import { Dashboard } from './pages/Dashboard';
import { SalesOrders } from './pages/SalesOrders';
import { OrderDetails } from './pages/OrderDetails';
import { Customers } from './pages/Customers';
import { CustomerProfile } from './pages/CustomerProfile';
import { Analytics } from './pages/Analytics';
import { ProductDirectory } from './pages/ProductDirectory';
import { FinishedGoods } from './pages/FinishedGoods';
import { RawMaterials } from './pages/RawMaterials';
import { Purchases } from './pages/Purchases';
import { PurchaseDetails } from './pages/PurchaseDetails';
import { Finance } from './pages/Finance';
import { DispatchPage } from './pages/Dispatch';
import { Documents } from './pages/Documents';
import { SettingsPage } from './pages/SettingsPage';

// Modals
import { NewOrderModal } from './components/modals/NewOrderModal';
import { AddCustomerModal } from './components/modals/AddCustomerModal';
import { AddProductModal } from './components/modals/AddProductModal';
import { RecordPaymentModal } from './components/modals/RecordPaymentModal';
import { AddExpenseModal } from './components/modals/AddExpenseModal';
import { NewDispatchModal } from './components/modals/NewDispatchModal';
import { AddFinishedGoodsModal } from './components/modals/AddFinishedGoodsModal';
import { AddRawMaterialModal } from './components/modals/AddRawMaterialModal';
import { RecordMaterialUsageModal } from './components/modals/RecordMaterialUsageModal';
import { UploadDocumentModal } from './components/modals/UploadDocumentModal';
import { NewPurchaseModal } from './components/modals/NewPurchaseModal';
import { RecordPurchasePaymentModal } from './components/modals/RecordPurchasePaymentModal';
import { ProductType, Customer, Product, RawMaterial } from './types';
import { useTranslation } from './i18n';

export function App() {
  const { language } = useTranslation();
  // Global modal state control
  const [isNewOrderOpen, setIsNewOrderOpen] = useState(false);
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [defaultProductType, setDefaultProductType] = useState<ProductType>('bottle');

  const [isRecordPaymentOpen, setIsRecordPaymentOpen] = useState(false);
  const [targetOrderIdForPayment, setTargetOrderIdForPayment] = useState<string | undefined>(undefined);
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [isNewDispatchOpen, setIsNewDispatchOpen] = useState(false);
  const [targetOrderIdForDispatch, setTargetOrderIdForDispatch] = useState<string | undefined>(undefined);
  const [isAddFinishedGoodsOpen, setIsAddFinishedGoodsOpen] = useState(false);

  const [isAddRawMaterialOpen, setIsAddRawMaterialOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<RawMaterial | null>(null);

  const [isRecordMaterialUsageOpen, setIsRecordMaterialUsageOpen] = useState(false);
  const [isUploadDocumentOpen, setIsUploadDocumentOpen] = useState(false);

  const [isNewPurchaseOpen, setIsNewPurchaseOpen] = useState(false);
  const [isRecordPurchasePaymentOpen, setIsRecordPurchasePaymentOpen] = useState(false);
  const [targetPurchaseIdForPayment, setTargetPurchaseIdForPayment] = useState<string | undefined>(undefined);

  // Refresh key to re-trigger component fetches across page navigation
  const [refreshKey, setRefreshKey] = useState(0);
  const triggerRefresh = () => setRefreshKey((prev) => prev + 1);

  const openRecordPayment = (orderId?: string) => {
    setTargetOrderIdForPayment(orderId);
    setIsRecordPaymentOpen(true);
  };

  const openRecordPurchasePayment = (purchaseId?: string) => {
    setTargetPurchaseIdForPayment(purchaseId);
    setIsRecordPurchasePaymentOpen(true);
  };

  const openNewDispatch = (orderId?: string) => {
    setTargetOrderIdForDispatch(orderId);
    setIsNewDispatchOpen(true);
  };

  const openAddCustomer = (customer?: Customer) => {
    setEditingCustomer(customer || null);
    setIsAddCustomerOpen(true);
  };

  const openAddProduct = (type: ProductType = 'bottle', product?: Product) => {
    setDefaultProductType(type);
    setEditingProduct(product || null);
    setIsAddProductOpen(true);
  };

  const openAddRawMaterial = (material?: RawMaterial) => {
    setEditingMaterial(material || null);
    setIsAddRawMaterialOpen(true);
  };

  return (
    <div key={language}>
      <Router>
      <Routes>
        <Route
          element={
            <AppLayout
              onOpenNewOrderModal={() => setIsNewOrderOpen(true)}
              onOpenAddCustomerModal={() => openAddCustomer()}
              onOpenRecordPaymentModal={() => openRecordPayment()}
              onOpenNewDispatchModal={() => openNewDispatch()}
              onOpenAddFinishedGoodsModal={() => setIsAddFinishedGoodsOpen(true)}
              onOpenNewPurchaseModal={() => setIsNewPurchaseOpen(true)}
            />
          }
        >
          <Route
            path="/"
            element={
              <Dashboard
                key={`dash-${refreshKey}`}
                onOpenNewOrderModal={() => setIsNewOrderOpen(true)}
                onOpenAddCustomerModal={() => openAddCustomer()}
                onOpenRecordPaymentModal={() => openRecordPayment()}
                onOpenNewDispatchModal={() => openNewDispatch()}
                onOpenAddFinishedGoodsModal={() => setIsAddFinishedGoodsOpen(true)}
              />
            }
          />
          <Route
            path="/sales"
            element={
              <SalesOrders
                key={`sales-${refreshKey}`}
                onOpenNewOrderModal={() => setIsNewOrderOpen(true)}
                onOpenRecordPaymentModal={(id) => openRecordPayment(id)}
                onOpenNewDispatchModal={(id) => openNewDispatch(id)}
              />
            }
          />
          <Route
            path="/sales/:orderId"
            element={
              <OrderDetails
                key={`ord-${refreshKey}`}
                onOpenRecordPaymentModal={(id) => openRecordPayment(id)}
                onOpenNewDispatchModal={(id) => openNewDispatch(id)}
              />
            }
          />
          <Route
            path="/customers"
            element={
              <Customers
                key={`cus-${refreshKey}`}
                onOpenAddCustomerModal={(cus) => openAddCustomer(cus)}
                onOpenNewOrderModal={() => setIsNewOrderOpen(true)}
              />
            }
          />
          <Route
            path="/customers/:customerId"
            element={
              <CustomerProfile
                key={`cusprof-${refreshKey}`}
                onOpenNewOrderModal={() => setIsNewOrderOpen(true)}
              />
            }
          />
          <Route path="/analytics" element={<Analytics key={`analytic-${refreshKey}`} />} />
          <Route
            path="/products"
            element={
              <ProductDirectory
                key={`prod-${refreshKey}`}
                onOpenAddProductModal={(type, prod) => openAddProduct(type, prod)}
              />
            }
          />
          <Route
            path="/finished-goods"
            element={
              <FinishedGoods
                key={`fg-${refreshKey}`}
                onOpenAddFinishedGoodsModal={() => setIsAddFinishedGoodsOpen(true)}
              />
            }
          />
          <Route
            path="/purchases"
            element={
              <Purchases
                key={`pur-${refreshKey}`}
                onOpenNewPurchaseModal={() => setIsNewPurchaseOpen(true)}
                onOpenRecordPurchasePaymentModal={(id) => openRecordPurchasePayment(id)}
              />
            }
          />
          <Route
            path="/purchases/:purchaseId"
            element={
              <PurchaseDetails
                key={`purdt-${refreshKey}`}
                onOpenRecordPurchasePaymentModal={(id) => openRecordPurchasePayment(id)}
              />
            }
          />
          <Route
            path="/raw-materials"
            element={
              <RawMaterials
                key={`rm-${refreshKey}`}
                onOpenAddRawMaterialModal={(mat) => openAddRawMaterial(mat)}
                onOpenRecordMaterialUsageModal={() => setIsRecordMaterialUsageOpen(true)}
                onOpenNewPurchaseModal={() => setIsNewPurchaseOpen(true)}
              />
            }
          />
          <Route
            path="/finance"
            element={
              <Finance
                key={`fin-${refreshKey}`}
                onOpenRecordPaymentModal={() => openRecordPayment()}
                onOpenAddExpenseModal={() => setIsAddExpenseOpen(true)}
              />
            }
          />
          <Route
            path="/dispatch"
            element={
              <DispatchPage
                key={`disp-${refreshKey}`}
                onOpenNewDispatchModal={() => openNewDispatch()}
              />
            }
          />
          <Route
            path="/documents"
            element={
              <Documents
                key={`doc-${refreshKey}`}
                onOpenUploadDocumentModal={() => setIsUploadDocumentOpen(true)}
              />
            }
          />
          <Route path="/settings" element={<SettingsPage key={`set-${refreshKey}`} />} />
        </Route>
      </Routes>

      {/* Global Action Modals */}
      <NewOrderModal
        isOpen={isNewOrderOpen}
        onClose={() => setIsNewOrderOpen(false)}
        onOrderCreated={triggerRefresh}
      />
      <AddCustomerModal
        isOpen={isAddCustomerOpen}
        onClose={() => {
          setIsAddCustomerOpen(false);
          setEditingCustomer(null);
        }}
        initialCustomer={editingCustomer}
        onCustomerAdded={triggerRefresh}
      />
      <AddProductModal
        isOpen={isAddProductOpen}
        onClose={() => {
          setIsAddProductOpen(false);
          setEditingProduct(null);
        }}
        defaultType={defaultProductType}
        initialProduct={editingProduct}
        onProductAdded={triggerRefresh}
      />
      <RecordPaymentModal
        isOpen={isRecordPaymentOpen}
        onClose={() => setIsRecordPaymentOpen(false)}
        defaultOrderId={targetOrderIdForPayment}
        onPaymentRecorded={triggerRefresh}
      />
      <AddExpenseModal
        isOpen={isAddExpenseOpen}
        onClose={() => setIsAddExpenseOpen(false)}
        onExpenseAdded={triggerRefresh}
      />
      <NewDispatchModal
        isOpen={isNewDispatchOpen}
        onClose={() => {
          setIsNewDispatchOpen(false);
          setTargetOrderIdForDispatch(undefined);
        }}
        defaultOrderId={targetOrderIdForDispatch}
        onDispatchCreated={triggerRefresh}
      />
      <AddFinishedGoodsModal
        isOpen={isAddFinishedGoodsOpen}
        onClose={() => setIsAddFinishedGoodsOpen(false)}
        onStockAdded={triggerRefresh}
      />
      <AddRawMaterialModal
        isOpen={isAddRawMaterialOpen}
        onClose={() => {
          setIsAddRawMaterialOpen(false);
          setEditingMaterial(null);
        }}
        initialMaterial={editingMaterial}
        onMaterialAdded={triggerRefresh}
      />
      <RecordMaterialUsageModal
        isOpen={isRecordMaterialUsageOpen}
        onClose={() => setIsRecordMaterialUsageOpen(false)}
        onUsageRecorded={triggerRefresh}
      />
      <UploadDocumentModal
        isOpen={isUploadDocumentOpen}
        onClose={() => setIsUploadDocumentOpen(false)}
        onDocumentUploaded={triggerRefresh}
      />
      <NewPurchaseModal
        isOpen={isNewPurchaseOpen}
        onClose={() => setIsNewPurchaseOpen(false)}
        onPurchaseCreated={triggerRefresh}
      />
      <RecordPurchasePaymentModal
        isOpen={isRecordPurchasePaymentOpen}
        onClose={() => setIsRecordPurchasePaymentOpen(false)}
        defaultPurchaseId={targetPurchaseIdForPayment}
        onPaymentRecorded={triggerRefresh}
      />
      </Router>
    </div>
  );
}

export default App;
