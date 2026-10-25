import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AppLayout } from './layouts/AppLayout';
import { Dashboard } from './pages/Dashboard';
import { SalesOrders } from './pages/SalesOrders';
import { OrderDetails } from './pages/OrderDetails';
import { Customers } from './pages/Customers';
import { CustomerProfile } from './pages/CustomerProfile';
import { Suppliers } from './pages/Suppliers';
import { SupplierProfile } from './pages/SupplierProfile';
import { Analytics } from './pages/Analytics';
import { ProductDirectory } from './pages/ProductDirectory';
import { FinishedGoods } from './pages/FinishedGoods';
import { RawMaterials } from './pages/RawMaterials';
import { Purchases } from './pages/Purchases';
import { PurchasedMaterials } from './pages/PurchasedMaterials';
import { PurchaseDetails } from './pages/PurchaseDetails';
import { Finance } from './pages/Finance';
import { DispatchPage } from './pages/Dispatch';
import { Documents } from './pages/Documents';
import { SettingsPage } from './pages/SettingsPage';
import { AuthorityPage } from './pages/AuthorityPage';
import { GstExemptSales } from './pages/GstExemptSales';
import { AdminRoute, PermissionRoute } from './auth/AuthContext';

// Modals
import { NewOrderModal } from './components/modals/NewOrderModal';
import { AddCustomerModal } from './components/modals/AddCustomerModal';
import { AddSupplierModal } from './components/modals/AddSupplierModal';
import { AddProductModal } from './components/modals/AddProductModal';
import { RecordPaymentModal } from './components/modals/RecordPaymentModal';
import { AddExpenseModal } from './components/modals/AddExpenseModal';
import { NewDispatchModal } from './components/modals/NewDispatchModal';
import { AddFinishedGoodsModal } from './components/modals/AddFinishedGoodsModal';
import { AddRawMaterialModal } from './components/modals/AddRawMaterialModal';
import { UploadDocumentModal } from './components/modals/UploadDocumentModal';
import { NewPurchaseModal } from './components/modals/NewPurchaseModal';
import { RecordPurchasePaymentModal } from './components/modals/RecordPurchasePaymentModal';
import { ProductType, Customer, Product, RawMaterial, Supplier } from './types';
import { useTranslation } from './i18n';

export function App() {
  const { language } = useTranslation();
  
  // Global modal state control
  const [isNewOrderOpen, setIsNewOrderOpen] = useState(false);
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [isAddSupplierOpen, setIsAddSupplierOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

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

  const openAddSupplier = (supplier?: Supplier) => {
    setEditingSupplier(supplier || null);
    setIsAddSupplierOpen(true);
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
              <PermissionRoute module="dashboard">
              <Dashboard
                key={`dash-${refreshKey}`}
                onOpenNewOrderModal={() => setIsNewOrderOpen(true)}
                onOpenAddCustomerModal={() => openAddCustomer()}
                onOpenRecordPaymentModal={() => openRecordPayment()}
                onOpenNewDispatchModal={() => openNewDispatch()}
                onOpenAddFinishedGoodsModal={() => setIsAddFinishedGoodsOpen(true)}
              />
              </PermissionRoute>
            }
          />
          <Route
            path="/sales"
            element={
              <PermissionRoute module="salesOrders">
              <SalesOrders
                key={`sales-${refreshKey}`}
                onOpenNewOrderModal={() => setIsNewOrderOpen(true)}
                onOpenRecordPaymentModal={(id) => openRecordPayment(id)}
                onOpenNewDispatchModal={(id) => openNewDispatch(id)}
              />
              </PermissionRoute>
            }
          />
          <Route
            path="/sales/:orderId"
            element={
              <PermissionRoute module="salesOrders">
              <OrderDetails
                key={`ord-${refreshKey}`}
                onOpenRecordPaymentModal={(id) => openRecordPayment(id)}
                onOpenNewDispatchModal={(id) => openNewDispatch(id)}
              />
              </PermissionRoute>
            }
          />
          <Route
            path="/customers"
            element={
              <PermissionRoute module="customers">
              <Customers
                key={`cus-${refreshKey}`}
                onOpenAddCustomerModal={(cus) => openAddCustomer(cus)}
                onOpenNewOrderModal={() => setIsNewOrderOpen(true)}
              />
              </PermissionRoute>
            }
          />
          <Route
            path="/customers/:customerId"
            element={
              <PermissionRoute module="customers">
              <CustomerProfile
                key={`cusprof-${refreshKey}`}
                onOpenNewOrderModal={() => setIsNewOrderOpen(true)}
              />
              </PermissionRoute>
            }
          />
          <Route
            path="/suppliers"
            element={<PermissionRoute module="suppliers"><Suppliers key={`sup-${refreshKey}`} onOpenAddSupplierModal={(supplier) => openAddSupplier(supplier)} /></PermissionRoute>}
          />
          <Route path="/suppliers/:supplierId" element={<PermissionRoute module="suppliers"><SupplierProfile key={`supprof-${refreshKey}`} /></PermissionRoute>} />
          <Route path="/analytics" element={<PermissionRoute module="analytics"><Analytics key={`analytic-${refreshKey}`} /></PermissionRoute>} />
          <Route
            path="/products"
            element={
              <PermissionRoute module="productDirectory">
              <ProductDirectory
                key={`prod-${refreshKey}`}
                onOpenAddProductModal={(type, prod) => openAddProduct(type, prod)}
              />
              </PermissionRoute>
            }
          />
          <Route
            path="/finished-goods"
            element={
              <PermissionRoute module="finishedGoods">
              <FinishedGoods
                key={`fg-${refreshKey}`}
                onOpenAddFinishedGoodsModal={() => setIsAddFinishedGoodsOpen(true)}
                onStockAdded={triggerRefresh}
              />
              </PermissionRoute>
            }
          />
          <Route
            path="/purchases"
            element={
              <PermissionRoute module="purchases">
              <Purchases
                key={`pur-${refreshKey}`}
                onOpenNewPurchaseModal={() => setIsNewPurchaseOpen(true)}
                onOpenRecordPurchasePaymentModal={(id) => openRecordPurchasePayment(id)}
              />
              </PermissionRoute>
            }
          />
          <Route
            path="/purchases/:purchaseId"
            element={
              <PermissionRoute module="purchases">
              <PurchaseDetails
                key={`purdt-${refreshKey}`}
                onOpenRecordPurchasePaymentModal={(id) => openRecordPurchasePayment(id)}
              />
              </PermissionRoute>
            }
          />
          <Route path="/purchased-materials" element={<PermissionRoute module="purchasedMaterials"><PurchasedMaterials key={`pm-${refreshKey}`} /></PermissionRoute>} />
          <Route
            path="/raw-materials"
            element={
              <PermissionRoute module="rawMaterials">
              <RawMaterials
                key={`rm-${refreshKey}`}
                onOpenNewPurchaseModal={() => setIsNewPurchaseOpen(true)}
              />
              </PermissionRoute>
            }
          />
          <Route
            path="/finance"
            element={
              <PermissionRoute module="finance">
              <Finance
                key={`fin-${refreshKey}`}
                onOpenRecordPaymentModal={() => openRecordPayment()}
                onOpenRecordPurchasePaymentModal={(id) => openRecordPurchasePayment(id)}
                onOpenAddExpenseModal={() => setIsAddExpenseOpen(true)}
              />
              </PermissionRoute>
            }
          />
          <Route
            path="/dispatch"
            element={
              <PermissionRoute module="dispatch">
              <DispatchPage
                key={`disp-${refreshKey}`}
                onOpenNewDispatchModal={() => openNewDispatch()}
              />
              </PermissionRoute>
            }
          />
          <Route
            path="/documents"
            element={
              <PermissionRoute module="documents">
              <Documents
                key={`doc-${refreshKey}`}
                onOpenUploadDocumentModal={() => setIsUploadDocumentOpen(true)}
              />
              </PermissionRoute>
            }
          />
          <Route path="/settings" element={<AdminRoute><SettingsPage key={`set-${refreshKey}`} /></AdminRoute>} />
          <Route path="/settings/authority" element={<AdminRoute><AuthorityPage key={`authority-${refreshKey}`} /></AdminRoute>} />
          <Route path="/gst-exempt-sales" element={<AdminRoute><GstExemptSales key={`gst-${refreshKey}`} onOpenRecordPaymentModal={(id) => openRecordPayment(id)} onOpenNewDispatchModal={(id) => openNewDispatch(id)} /></AdminRoute>} />
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
      <AddSupplierModal
        isOpen={isAddSupplierOpen}
        onClose={() => {
          setIsAddSupplierOpen(false);
          setEditingSupplier(null);
        }}
        initialSupplier={editingSupplier}
        onSupplierSaved={triggerRefresh}
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
