import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc
  , deleteField
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { auth, db, storage, isLiveFirebaseConfigured } from '../firebase/config';

// Helper to check if Firebase sync should be attempted
const shouldSyncToFirebase = (): boolean => {
  return Boolean(isLiveFirebaseConfigured && db !== null);
};

export async function requirePermission(module: AuthorityModule, action: PermissionAction): Promise<void> {
  const user = auth?.currentUser;
  if (!user || !db) throw new Error('You must sign in to access company data.');

  const token = await user.getIdTokenResult();
  if (token.claims.admin === true) return;

  const profileSnapshot = await getDoc(doc(getDb(), 'userProfiles', user.uid));
  if (!profileSnapshot.exists()) throw new Error('No employee permissions are configured for this account.');
  const profile = profileSnapshot.data();
  if (profile.active !== true) throw new Error('This employee account has been deactivated.');
  const allowedActions = profile.permissions?.[module];
  if (!Array.isArray(allowedActions) || !allowedActions.includes(action)) {
    throw new Error(`Permission denied: ${action} access to ${module}.`);
  }
}

export async function requireAnyPermission(
  moduleActions: Array<[AuthorityModule, PermissionAction]>
): Promise<void> {
  let lastError: unknown;
  for (const [module, action] of moduleActions) {
    try {
      await requirePermission(module, action);
      return;
    } catch (error) {
      lastError = error;
      if (!(error instanceof Error) || !error.message.startsWith('Permission denied:')) throw error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Permission denied.');
}

// Helper to safely get db instance (for TypeScript)
const getDb = (): NonNullable<typeof db> => {
  if (!db) throw new Error('Firestore not initialized');
  return db;
};

async function getCloudItems<T extends { id: string }>(collectionName: string): Promise<T[]> {
  if (!isLiveFirebaseConfigured || !db) {
    throw new Error('Company data is available only through the configured Firebase project.');
  }
  const snapshot = await withTimeout(getDocs(collection(getDb(), collectionName)), 10000);
  return snapshot.docs.map((item) => ({ ...item.data(), id: item.id } as T));
}

async function persistCloudWrite(operation: Promise<unknown>, description: string): Promise<void> {
  try {
    await withTimeout(operation, 10000);
  } catch (error) {
    console.error(`${description} was not confirmed by Firebase:`, error);
    throw error;
  }
}
import type {
  Customer,
  Supplier,
  Product,
  Order,
  Payment,
  PaymentReminder,
  Expense,
  Dispatch,
  RawMaterial,
  RawMaterialUsage,
  FinishedGoodsLog,
  DocumentItem,
  Settings,
  DashboardMetrics,
  PurchaseOrder,
  PurchaseStatus,
  PurchasePaymentStatus,
  PurchasePayment
  , PurchasedMaterial
  , SignedOrderCopy
  , AuthorityModule
  , PermissionAction
} from '../types';
import { getOrderDeliveryProgress, generateNextChallanNumber } from '../utils/dispatchUtils';
import { toBaseQuantity } from '../utils/unitConversion';

const initialCustomers: Customer[] = [];
const initialProducts: Product[] = [];
const initialOrders: Order[] = [];
const initialDispatches: Dispatch[] = [];
const initialPayments: Payment[] = [];
const initialExpenses: Expense[] = [];
const initialRawMaterials: RawMaterial[] = [];
const initialRawMaterialUsage: RawMaterialUsage[] = [];
const initialFinishedGoodsLogs: FinishedGoodsLog[] = [];
const initialDocuments: DocumentItem[] = [];
const initialPurchases: PurchaseOrder[] = [];
const initialSettings: Settings = {
  companyName: '',
  gstin: '',
  phone: '',
  email: '',
  address: '',
  invoicePrefix: 'ORD-',
  gstRate: 18,
  defaultPriceCategory: 'A',
  enableNotifications: true
};

// LocalStorage Keys for fallback
const STORAGE_KEYS = {
  CUSTOMERS: 'angel_pet_customers',
  SUPPLIERS: 'angel_pet_suppliers',
  PRODUCTS: 'angel_pet_products',
  ORDERS: 'angel_pet_orders',
  DISPATCHES: 'angel_pet_dispatches',
  PAYMENTS: 'angel_pet_payments',
  EXPENSES: 'angel_pet_expenses',
  RAW_MATERIALS: 'angel_pet_raw_materials',
  RAW_MATERIAL_USAGE: 'angel_pet_raw_material_usage',
  FINISHED_GOODS_LOGS: 'angel_pet_finished_goods_logs',
  DOCUMENTS: 'angel_pet_documents',
  SETTINGS: 'angel_pet_settings',
  PURCHASES: 'angel_pet_purchases',
  PURCHASED_MATERIALS: 'angel_pet_purchased_materials',
  PAYMENT_REMINDERS: 'angel_pet_payment_reminders'
};

const DEMO_DATA_STORAGE_KEYS = [
  STORAGE_KEYS.CUSTOMERS,
  STORAGE_KEYS.SUPPLIERS,
  STORAGE_KEYS.ORDERS,
  STORAGE_KEYS.DISPATCHES,
  STORAGE_KEYS.PAYMENTS,
  STORAGE_KEYS.EXPENSES,
  STORAGE_KEYS.RAW_MATERIALS,
  STORAGE_KEYS.RAW_MATERIAL_USAGE,
  STORAGE_KEYS.FINISHED_GOODS_LOGS,
  STORAGE_KEYS.DOCUMENTS,
  STORAGE_KEYS.SETTINGS,
  STORAGE_KEYS.PURCHASES,
  STORAGE_KEYS.PURCHASED_MATERIALS,
  STORAGE_KEYS.PAYMENT_REMINDERS
];

function clearDemoDataFromLocalStorage(): void {
  if (typeof localStorage === 'undefined') return;

  for (const key of DEMO_DATA_STORAGE_KEYS) {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error(`Unable to clear demo data cache ${key} from LocalStorage:`, error);
    }
  }
}

clearDemoDataFromLocalStorage();

// Helper to interact with LocalStorage
function getLocalItem<T>(key: string, fallback: T): T {
  try {
    if (typeof localStorage === 'undefined') return fallback;
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : fallback;
  } catch (e) {
    console.error(`Error reading ${key} from localStorage:`, e);
    return fallback;
  }

}

function setLocalItem<T>(key: string, value: T): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error(`Error writing ${key} to localStorage:`, e);
  }
}

// Timeout wrapper for Firestore promises to avoid hanging if network/Firestore is uninitialized
function withTimeout<T>(promise: Promise<T>, timeoutMs = 2500): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Firestore operation timed out')), timeoutMs)
    )
  ]);
}

// Strip undefined properties because Firestore setDoc throws on undefined fields
function sanitizeForFirestore<T>(data: T): any {
  if (data === undefined || data === null) return null;
  return JSON.parse(JSON.stringify(data));
}

// Helper to merge LocalStorage items and Remote Firestore items safely without losing local state
function mergeLocalAndRemote<T extends { id: string }>(localList: T[], remoteList: T[]): T[] {
  const remoteMap = new Map(remoteList.map((item) => [item.id, item]));
  const merged: T[] = [];
  const processedIds = new Set<string>();

  for (const localItem of localList) {
    processedIds.add(localItem.id);
    const remoteItem = remoteMap.get(localItem.id);
    if (remoteItem) {
      merged.push({ ...remoteItem, ...localItem });
    } else {
      merged.push(localItem);
    }
  }

  for (const remoteItem of remoteList) {
    if (!processedIds.has(remoteItem.id)) {
      merged.push(remoteItem);
    }
  }

  return merged;
}

function dedupeById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function createUniqueId(prefix: string, existingIds: Set<string>): string {
  let id = '';
  do {
    id = `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  } while (existingIds.has(id));
  return id;
}

function mergePurchases(localList: PurchaseOrder[], remoteList: PurchaseOrder[]): PurchaseOrder[] {
  const merged = mergeLocalAndRemote(localList, remoteList);
  const localById = new Map(localList.map((purchase) => [purchase.id, purchase]));
  const remoteById = new Map(remoteList.map((purchase) => [purchase.id, purchase]));

  return dedupeById(merged.map((purchase) => {
    const localPurchase = localById.get(purchase.id);
    const remotePurchase = remoteById.get(purchase.id);
    if (!localPurchase || !remotePurchase) return purchase;

    const paymentRecords = dedupeById([
      ...(localPurchase.paymentRecords || []),
      ...(remotePurchase.paymentRecords || [])
    ]);
    const paidAmount = Math.max(
      localPurchase.paidAmount || 0,
      remotePurchase.paidAmount || 0,
      paymentRecords.reduce((sum, payment) => sum + payment.amount, 0)
    );

    return {
      ...remotePurchase,
      ...localPurchase,
      paymentRecords: paymentRecords.length > 0 ? paymentRecords : undefined,
      paidAmount,
      paymentStatus: paidAmount >= purchase.totalAmount ? 'paid' : paidAmount > 0 ? 'partially_paid' : 'pending'
    };
  }));
}

function mergeProducts(localList: Product[], remoteList: Product[]): Product[] {
  const localMap = new Map(localList.map((item) => [item.id, item]));
  const merged = remoteList.map((remoteItem) => ({
    ...localMap.get(remoteItem.id),
    ...remoteItem
  }));
  const remoteIds = new Set(remoteList.map((item) => item.id));

  return [
    ...merged,
    ...localList.filter((localItem) => !remoteIds.has(localItem.id))
  ];
}

// ================= CUSTOMERS =================
export async function getCustomers(): Promise<Customer[]> {
  await requireAnyPermission([
    ['customers', 'view'],
    ['salesOrders', 'view'],
    ['finance', 'view']
  ]);
  const items = await getCloudItems<Customer>('customers');
  const customers = items.map((customer) => ({
    ...customer,
    company: customer.company || '',
    phone: customer.phone || ''
  }));
  setLocalItem(STORAGE_KEYS.CUSTOMERS, customers);
  return customers;
}

export async function addCustomer(data: Omit<Customer, 'id' | 'createdAt' | 'totalOrders' | 'totalSpent'> & { id?: string }): Promise<Customer> {
  await requirePermission('customers', 'create');
  const customerId = data.id || `CUS-${Date.now().toString().slice(-4)}`;
  const newCustomer: Customer = {
    ...data,
    id: customerId,
    createdAt: new Date().toISOString().split('T')[0],
    totalOrders: 0,
    totalSpent: 0
  };

  // Always update LocalStorage immediately for instant UI response
  const list = getLocalItem<Customer[]>(STORAGE_KEYS.CUSTOMERS, initialCustomers);
  const existingIndex = list.findIndex((c) => c.id === customerId);
  let newList: Customer[];
  if (existingIndex >= 0) {
    newList = [...list];
    newList[existingIndex] = newCustomer;
  } else {
    newList = [newCustomer, ...list];
  }
  setLocalItem(STORAGE_KEYS.CUSTOMERS, newList);

  // Sync with Firestore asynchronously
  if (shouldSyncToFirebase()) {
    await persistCloudWrite(setDoc(doc(getDb(), 'customers', newCustomer.id), sanitizeForFirestore(newCustomer)), 'Adding customer');
  }

  return newCustomer;
}

export async function updateCustomer(id: string, updates: Partial<Customer>): Promise<Customer> {
  const updateKeys = Object.keys(updates);
  if (updateKeys.length === 1 && updateKeys[0] === 'paymentReminder') {
    await requireAnyPermission([['customers', 'edit'], ['finance', 'edit']]);
  } else if (updateKeys.length > 0 && updateKeys.every((key) => key === 'totalOrders' || key === 'totalSpent')) {
    await requireAnyPermission([['customers', 'edit'], ['salesOrders', 'create']]);
  } else {
    await requirePermission('customers', 'edit');
  }
  let updated: Customer | null = null;
  const list = getLocalItem<Customer[]>(STORAGE_KEYS.CUSTOMERS, initialCustomers);
  let found = false;
  const newList = list.map((item) => {
    if (item.id === id) {
      found = true;
      updated = { ...item, ...updates };
      return updated;
    }
    return item;
  });
  if (!found || !updated) throw new Error(`Customer not found: ${id}`);
  setLocalItem(STORAGE_KEYS.CUSTOMERS, newList);

  if (shouldSyncToFirebase()) {
    const firebaseUpdates = sanitizeForFirestore(updated) as Record<string, unknown>;
    if (updates.paymentReminder === undefined && Object.prototype.hasOwnProperty.call(updates, 'paymentReminder')) {
      firebaseUpdates.paymentReminder = deleteField();
    }
    await persistCloudWrite(setDoc(doc(getDb(), 'customers', id), firebaseUpdates, { merge: true }), 'Updating customer');
  }

  return updated;
}

export async function deleteCustomer(id: string): Promise<void> {
  await requirePermission('customers', 'delete');
  const list = getLocalItem<Customer[]>(STORAGE_KEYS.CUSTOMERS, initialCustomers);
  setLocalItem(STORAGE_KEYS.CUSTOMERS, list.filter((item) => item.id !== id));

  if (shouldSyncToFirebase()) {
    await persistCloudWrite(deleteDoc(doc(getDb(), 'customers', id)), 'Deleting customer');
  }
}

// ================= SUPPLIERS =================
export async function getSuppliers(): Promise<Supplier[]> {
  await requirePermission('suppliers', 'view');
  const saved = await getCloudItems<Supplier>('suppliers');
  let purchases: PurchaseOrder[] = [];
  try {
    purchases = await getPurchases();
  } catch (error) {
    if (!(error instanceof Error) || !error.message.startsWith('Permission denied:')) throw error;
  }
  const normalizedSaved = saved.map((supplier) => ({
    ...supplier,
    company: supplier.company || '',
    phone: supplier.phone || ''
  }));
  const byCompany = new Map(normalizedSaved
    .filter((supplier) => supplier.company)
    .map((supplier) => [(supplier.company || '').toLowerCase(), supplier]));
  const suppliers = new Map<string, Supplier>();

  purchases.forEach((purchase) => {
    const company = purchase.supplierName?.trim();
    if (!company) return;
    const key = company.toLowerCase();
    const existing = byCompany.get(key);
    const related = purchases.filter((item) => item.supplierName?.trim().toLowerCase() === key);
    const totalPurchases = related.reduce((sum, item) => sum + (item.totalAmount || 0), 0);
    const totalPaid = related.reduce((sum, item) => sum + (item.paidAmount || 0), 0);
    suppliers.set(key, {
      id: existing?.id || `SUP-${company.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`,
      name: existing?.name || company,
      company,
      phone: existing?.phone || purchase.supplierPhone || '',
      address: existing?.address || '',
      status: existing?.status || 'active',
      createdAt: existing?.createdAt || purchase.purchaseDate || new Date().toISOString().split('T')[0],
      totalPurchases,
      totalPaid,
      totalOutstanding: Math.max(0, totalPurchases - totalPaid)
    });
  });

  normalizedSaved.forEach((supplier) => {
    const key = supplier.company ? supplier.company.toLowerCase() : `supplier:${supplier.id}`;
    if (!suppliers.has(key)) suppliers.set(key, supplier);
  });

  const result = Array.from(suppliers.values());
  setLocalItem(STORAGE_KEYS.SUPPLIERS, result);
  return result;
}

export async function addSupplier(data: Omit<Supplier, 'id' | 'createdAt' | 'totalPurchases' | 'totalPaid' | 'totalOutstanding'>): Promise<Supplier> {
  await requirePermission('suppliers', 'create');
  const supplier: Supplier = {
    ...data,
    id: `SUP-${Date.now().toString().slice(-8)}`,
    createdAt: new Date().toISOString().split('T')[0],
    totalPurchases: 0,
    totalPaid: 0,
    totalOutstanding: 0
  };
  const list = getLocalItem<Supplier[]>(STORAGE_KEYS.SUPPLIERS, []);
  setLocalItem(STORAGE_KEYS.SUPPLIERS, [supplier, ...list]);
  if (shouldSyncToFirebase()) {
    await persistCloudWrite(setDoc(doc(getDb(), 'suppliers', supplier.id), sanitizeForFirestore(supplier)), 'Adding supplier');
  }
  return supplier;
}

export async function updateSupplier(id: string, updates: Partial<Supplier>): Promise<Supplier> {
  await requirePermission('suppliers', 'edit');
  const list = getLocalItem<Supplier[]>(STORAGE_KEYS.SUPPLIERS, []);
  const current = list.find((supplier) => supplier.id === id);
  if (!current) throw new Error('Supplier not found.');
  const updated = { ...current, ...updates };
  setLocalItem(STORAGE_KEYS.SUPPLIERS, list.map((supplier) => supplier.id === id ? updated : supplier));
  if (shouldSyncToFirebase()) {
    await persistCloudWrite(setDoc(doc(getDb(), 'suppliers', id), sanitizeForFirestore(updated), { merge: true }), 'Updating supplier');
  }
  return updated;
}

export async function deleteSupplier(id: string): Promise<void> {
  await requirePermission('suppliers', 'delete');
  const list = getLocalItem<Supplier[]>(STORAGE_KEYS.SUPPLIERS, []);
  setLocalItem(STORAGE_KEYS.SUPPLIERS, list.filter((supplier) => supplier.id !== id));
  if (shouldSyncToFirebase()) {
    await persistCloudWrite(deleteDoc(doc(getDb(), 'suppliers', id)), 'Deleting supplier');
  }
}

// ================= PRODUCTS =================
export async function getProducts(): Promise<Product[]> {
  await requireAnyPermission([
    ['productDirectory', 'view'],
    ['salesOrders', 'view'],
    ['finishedGoods', 'view'],
    ['dispatch', 'view'],
    ['dashboard', 'view']
  ]);
  const items = await getCloudItems<Product>('products');
  setLocalItem(STORAGE_KEYS.PRODUCTS, items);
  return items;
}

export async function addProduct(data: Omit<Product, 'id' | 'createdAt'>): Promise<Product> {
  await requirePermission('productDirectory', 'create');
  const prefix = data.type === 'bottle' ? 'PRD-1' : 'PRD-2';
  const newProduct: Product = {
    ...data,
    id: `${prefix}${Math.floor(100 + Math.random() * 900)}`,
    createdAt: new Date().toISOString().split('T')[0]
  };

  const list = getLocalItem<Product[]>(STORAGE_KEYS.PRODUCTS, initialProducts);
  setLocalItem(STORAGE_KEYS.PRODUCTS, [newProduct, ...list]);

  if (shouldSyncToFirebase()) {
    await persistCloudWrite(setDoc(doc(getDb(), 'products', newProduct.id), newProduct), 'Adding product');
  }

  return newProduct;
}

export async function updateProduct(id: string, updates: Partial<Product>): Promise<Product> {
  const updateKeys = Object.keys(updates);
  if (updateKeys.length === 1 && updateKeys[0] === 'currentStock') {
    await requireAnyPermission([
      ['productDirectory', 'edit'],
      ['finishedGoods', 'create'],
      ['dispatch', 'create']
    ]);
  } else {
    await requirePermission('productDirectory', 'edit');
  }
  let updated: Product | null = null;
  const list = getLocalItem<Product[]>(STORAGE_KEYS.PRODUCTS, initialProducts);
  let found = false;
  const shouldClearUnitsPerPacket = Object.prototype.hasOwnProperty.call(updates, 'unitsPerPacket')
    && !(typeof updates.unitsPerPacket === 'number' && Number.isInteger(updates.unitsPerPacket) && updates.unitsPerPacket > 0);
  const newList = list.map((item) => {
    if (item.id === id) {
      found = true;
      const nextProduct: Product = { ...item, ...updates };
      if (shouldClearUnitsPerPacket) {
        delete nextProduct.unitsPerPacket;
      }
      updated = nextProduct;
      return nextProduct;
    }
    return item;
  });
  if (!found) throw new Error(`Product not found: ${id}`);
  setLocalItem(STORAGE_KEYS.PRODUCTS, newList);

  // Sync with Firestore
  if (shouldSyncToFirebase() && updated) {
    const firebaseUpdates: Record<string, unknown> = Object.fromEntries(
      Object.entries(updates).filter(([, value]) => value !== undefined)
    );
    if (shouldClearUnitsPerPacket) {
      firebaseUpdates.unitsPerPacket = deleteField();
    }
    await persistCloudWrite(setDoc(doc(getDb(), 'products', id), firebaseUpdates, { merge: true }), `Updating product ${id}`);
  }

  if (!updated) throw new Error('Product not found');
  return updated;
}

export async function deleteProduct(id: string): Promise<void> {
  await requirePermission('productDirectory', 'delete');
  const list = getLocalItem<Product[]>(STORAGE_KEYS.PRODUCTS, initialProducts);
  setLocalItem(STORAGE_KEYS.PRODUCTS, list.filter((item) => item.id !== id));

  if (shouldSyncToFirebase()) {
    await persistCloudWrite(deleteDoc(doc(getDb(), 'products', id)), 'Deleting product');
  }
}

// ================= ORDERS =================
export async function getOrders(): Promise<Order[]> {
  await requireAnyPermission([
    ['salesOrders', 'view'],
    ['finance', 'view'],
    ['dispatch', 'view'],
    ['dashboard', 'view']
  ]);
  const items = dedupeById(await getCloudItems<Order>('orders'));
  setLocalItem(STORAGE_KEYS.ORDERS, items);
  return items;
}

export async function addOrder(orderData: Omit<Order, 'id' | 'orderNumber' | 'paidAmount' | 'paymentStatus' | 'orderStatus' | 'orderDate'>): Promise<Order> {
  await requirePermission('salesOrders', 'create');
  const randomNum = Math.floor(10000 + Math.random() * 90000);
  const orderNumber = `ORD-${randomNum}`;
  const orderType = orderData.orderType || 'REGULAR';
  const isAS = orderType === 'AS';
  const isCashMemo = !isAS && orderData.paymentType === 'cash_memo';
  if (isCashMemo && orderData.totalAmount > 0) {
    await requirePermission('finance', 'create');
  }
  const orderDate = new Date().toISOString().split('T')[0];

  const newOrder: Order = {
    ...orderData,
    orderType,
    id: orderNumber,
    orderNumber,
    orderStatus: 'pending',
    paymentStatus: isAS ? 'paid' : (isCashMemo ? 'paid' : 'pending'),
    paidAmount: isAS ? 0 : (isCashMemo ? orderData.totalAmount : 0),
    paymentType: isAS ? undefined : (orderData.paymentType || 'debit_memo'),
    orderDate
  };

  const list = getLocalItem<Order[]>(STORAGE_KEYS.ORDERS, initialOrders);
  setLocalItem(STORAGE_KEYS.ORDERS, [newOrder, ...list]);

  if (shouldSyncToFirebase()) {
    await persistCloudWrite(setDoc(doc(getDb(), 'orders', newOrder.id), sanitizeForFirestore(newOrder)), 'Adding order');
  }

  // Update Customer's total orders & total spent (AS Orders do not add to totalSpent)
  const customers = await getCustomers();
  const targetCustomer = customers.find((c) => c.id === newOrder.customerId);
  if (targetCustomer) {
    const updatedTotalOrders = (targetCustomer.totalOrders || 0) + 1;
    const updatedTotalSpent = (targetCustomer.totalSpent || 0) + (isAS ? 0 : newOrder.totalAmount);
    await updateCustomer(targetCustomer.id, {
      totalOrders: updatedTotalOrders,
      totalSpent: updatedTotalSpent
    });
  }

  // If Cash Memo and not AS Order, automatically record full payment in Finance
  if (!isAS && isCashMemo && newOrder.totalAmount > 0) {
    const existingPaymentIds = new Set((await getPayments()).map((payment) => payment.id));
    const receiptNumber = createUniqueId('REC', existingPaymentIds);
    const newPayment: Payment = {
      id: receiptNumber,
      receiptNumber,
      orderId: newOrder.id,
      orderNumber: newOrder.orderNumber,
      customerId: newOrder.customerId,
      customerName: newOrder.companyName || newOrder.customerName,
      amount: newOrder.totalAmount,
      paymentMethod: 'cash',
      paymentDate: orderDate,
      notes: 'Full payment received against Cash Memo'
    };

    const paymentList = getLocalItem<Payment[]>(STORAGE_KEYS.PAYMENTS, initialPayments);
    setLocalItem(STORAGE_KEYS.PAYMENTS, [newPayment, ...paymentList]);

    if (shouldSyncToFirebase()) {
      await persistCloudWrite(setDoc(doc(getDb(), 'payments', newPayment.id), sanitizeForFirestore(newPayment)), 'Recording cash memo payment');
    }
  }

  return newOrder;
}

export async function updateOrder(id: string, updates: Partial<Order>): Promise<Order> {
  const updateKeys = Object.keys(updates);
  if (updateKeys.length > 0 && updateKeys.every((key) => key === 'paidAmount' || key === 'paymentStatus')) {
    await requireAnyPermission([['salesOrders', 'edit'], ['finance', 'create']]);
  } else if (updateKeys.length === 1 && updateKeys[0] === 'signedCopy') {
    await requireAnyPermission([['salesOrders', 'edit'], ['salesOrders', 'create']]);
  } else {
    await requirePermission('salesOrders', 'edit');
  }
  let updated: Order | null = null;
  const list = getLocalItem<Order[]>(STORAGE_KEYS.ORDERS, initialOrders);
  let found = false;
  const newList = list.map((item) => {
    if (item.id === id) {
      found = true;
      updated = { ...item, ...updates };
      return updated;
    }
    return item;
  });
  if (!found || !updated) throw new Error(`Sales order not found: ${id}`);
  setLocalItem(STORAGE_KEYS.ORDERS, newList);

  if (shouldSyncToFirebase()) {
    await persistCloudWrite(setDoc(doc(getDb(), 'orders', id), sanitizeForFirestore(updated), { merge: true }), `Updating order ${id}`);
  }

  return updated;
}

export async function updateOrderStatus(id: string, newStatus: Order['orderStatus']): Promise<Order> {
  const orders = await getOrders();
  const current = orders.find((order) => order.id === id);
  if (!current) throw new Error(`Sales order not found: ${id}`);

  let canEdit = true;
  try {
    await requirePermission('salesOrders', 'edit');
  } catch (error) {
    if (!(error instanceof Error) || !error.message.startsWith('Permission denied:')) throw error;
    canEdit = false;
  }

  if (!canEdit) {
    await requirePermission('salesOrders', 'approve');
    if (current.orderStatus !== 'pending' || newStatus !== 'confirmed') {
      throw new Error('Approve permission only allows confirming a pending sales order.');
    }
    const updated = { ...current, orderStatus: newStatus };
    if (shouldSyncToFirebase()) {
      await persistCloudWrite(setDoc(doc(getDb(), 'orders', id), { orderStatus: newStatus }, { merge: true }), 'Approving sales order');
    }
    const localOrders = getLocalItem<Order[]>(STORAGE_KEYS.ORDERS, initialOrders);
    setLocalItem(STORAGE_KEYS.ORDERS, localOrders.map((order) => order.id === id ? updated : order));
    return updated;
  }

  return updateOrder(id, { orderStatus: newStatus });
}

export async function uploadOrderSignedCopy(orderId: string, file: File): Promise<Order> {
  await requirePermission('salesOrders', 'create');
  const orders = await getOrders();
  const target = orders.find((order) => order.id === orderId);
  if (!target) throw new Error('Sales order not found.');

  if (!isLiveFirebaseConfigured || !storage) throw new Error('Firebase Storage is required for signed order copies.');

  const storagePath = `orders/${orderId}/signed-copy/${Date.now()}_${file.name}`;
  const fileRef = ref(storage, storagePath);
  await withTimeout(uploadBytes(fileRef, file), 30000);
  const downloadUrl = await withTimeout(getDownloadURL(fileRef), 10000);
  const signedCopy: SignedOrderCopy = {
    downloadUrl,
    storagePath,
    fileName: file.name,
    fileType: file.type,
    fileSize: file.size,
    uploadedAt: new Date().toISOString()
  };

  try {
    const updated = await updateOrder(orderId, { signedCopy });
    if (target.signedCopy?.storagePath && target.signedCopy.storagePath !== storagePath) {
      await deleteObject(ref(storage, target.signedCopy.storagePath)).catch((error) => {
        console.warn('Could not delete replaced signed copy from Firebase Storage:', error);
      });
    }
    return updated;
  } catch (error) {
    await deleteObject(fileRef).catch(() => {});
    throw error;
  }
}

export async function removeOrderSignedCopy(orderId: string): Promise<Order> {
  await requireAnyPermission([['salesOrders', 'edit'], ['salesOrders', 'delete']]);
  const orders = await getOrders();
  const target = orders.find((order) => order.id === orderId);
  if (!target) throw new Error('Sales order not found.');

  if (target.signedCopy?.storagePath && storage) {
    await withTimeout(deleteObject(ref(storage, target.signedCopy.storagePath)), 10000);
  }

  const { signedCopy: _removedSignedCopy, ...withoutSignedCopy } = target;
  const list = getLocalItem<Order[]>(STORAGE_KEYS.ORDERS, initialOrders);
  const updated = list.map((order) => order.id === orderId ? withoutSignedCopy : order);
  setLocalItem(STORAGE_KEYS.ORDERS, updated);

  if (shouldSyncToFirebase()) {
    await withTimeout(updateDoc(doc(getDb(), 'orders', orderId), { signedCopy: deleteField() }), 10000);
  }

  return withoutSignedCopy;
}

// ================= DISPATCHES =================
export async function getDispatches(): Promise<Dispatch[]> {
  await requireAnyPermission([['dispatch', 'view'], ['salesOrders', 'view'], ['finance', 'view']]);
  const items = await getCloudItems<Dispatch>('dispatches');
  setLocalItem(STORAGE_KEYS.DISPATCHES, items);
  return items;
}

export async function addDispatch(data: Omit<Dispatch, 'id' | 'dispatchNumber' | 'createdAt'>): Promise<Dispatch> {
  await requirePermission('dispatch', 'create');
  const orders = await getOrders();
  const targetOrder = orders.find((order) => order.id === data.orderId || order.orderNumber === data.orderNumber);
  if (!targetOrder) {
    throw new Error('Sales order not found.');
  }
  if (targetOrder?.orderStatus === 'cancelled') {
    throw new Error('Cancelled orders cannot be dispatched.');
  }

  const existingDispatches = await getDispatches();
  const orderDispatches = existingDispatches.filter(
    (d) => d.orderId === targetOrder.id || d.orderNumber === targetOrder.orderNumber
  );

  // Validate per-product delivery quantities against remaining quantities
  const progress = getOrderDeliveryProgress(targetOrder, orderDispatches);
  
  if (data.items.length === 0) {
    throw new Error('No items specified for delivery.');
  }

  let totalDeliveringThisTime = 0;

  for (const dispatchItem of data.items) {
    if (dispatchItem.quantity < 0) {
      throw new Error(`Quantity for ${dispatchItem.productName} cannot be negative.`);
    }
    const productProgress = progress.items.find(
      (p) => p.productId === dispatchItem.productId || p.productName === dispatchItem.productName
    );
    const remaining = productProgress ? productProgress.remainingQuantity : 0;

    if (dispatchItem.quantity > remaining) {
      if (progress.items.length === 1) {
        throw new Error(`Only ${remaining.toLocaleString()} units remain for delivery.`);
      }
      throw new Error(`Only ${remaining.toLocaleString()} units remain for delivery of ${dispatchItem.productName}.`);
    }
    totalDeliveringThisTime += dispatchItem.quantity;
  }

  if (totalDeliveringThisTime <= 0) {
    throw new Error('Please specify at least one product with a delivery quantity greater than 0.');
  }

  if (
    (data.status === 'dispatched' || data.status === 'delivered') &&
    targetOrder.orderType !== 'AS'
  ) {
    assertDispatchStockAvailable(data.items, await getProducts());
  }

  // Generate unique sub-challan number (e.g. CH-001, CH-002)
  const dispatchNumber = generateNextChallanNumber(existingDispatches);
  const newDispatch: Dispatch = {
    ...data,
    id: dispatchNumber,
    dispatchNumber,
    createdAt: new Date().toISOString().split('T')[0]
  };

  const list = getLocalItem<Dispatch[]>(STORAGE_KEYS.DISPATCHES, initialDispatches);
  setLocalItem(STORAGE_KEYS.DISPATCHES, [newDispatch, ...list]);

  if (shouldSyncToFirebase()) {
    await persistCloudWrite(setDoc(doc(getDb(), 'dispatches', newDispatch.id), sanitizeForFirestore(newDispatch)), 'Adding dispatch');
  }

  // If status is 'dispatched' or 'delivered', automatically update inventory stock & order status
  if (data.status === 'dispatched' || data.status === 'delivered') {
    await processDispatchStockDeduction(newDispatch);
  }

  return newDispatch;
}

function assertDispatchStockAvailable(items: Dispatch['items'], products: Product[]): void {
  const requiredByProduct = new Map<string, number>();
  for (const item of items) {
    requiredByProduct.set(item.productId, (requiredByProduct.get(item.productId) || 0) + item.quantity);
  }

  for (const [productId, quantity] of requiredByProduct) {
    const product = products.find((candidate) => candidate.id === productId);
    if (product && product.currentStock < quantity) {
      throw new Error(`Insufficient stock for ${product.name}. Available: ${product.currentStock}, required: ${quantity}.`);
    }
  }
}

export async function updateDispatchStatus(id: string, newStatus: Dispatch['status']): Promise<Dispatch> {
  const dispatches = await getDispatches();
  const dispatch = dispatches.find((d) => d.id === id);
  if (!dispatch) throw new Error(`Dispatch not found: ${id}`);

  let canEdit = true;
  try {
    await requirePermission('dispatch', 'edit');
  } catch (error) {
    if (!(error instanceof Error) || !error.message.startsWith('Permission denied:')) throw error;
    canEdit = false;
  }
  if (!canEdit) {
    await requirePermission('dispatch', 'approve');
    if (dispatch.status !== 'pending' || newStatus !== 'ready') {
      throw new Error('Approve permission only allows moving a pending dispatch to ready.');
    }
  }
  const updatedDispatch: Dispatch = { ...dispatch, status: newStatus };

  const list = getLocalItem<Dispatch[]>(STORAGE_KEYS.DISPATCHES, initialDispatches);
  const newList = list.map((item) => (item.id === id ? updatedDispatch : item));
  setLocalItem(STORAGE_KEYS.DISPATCHES, newList);

  if (shouldSyncToFirebase()) {
    await persistCloudWrite(setDoc(doc(getDb(), 'dispatches', id), sanitizeForFirestore(updatedDispatch), { merge: true }), 'Updating dispatch status');
  }

  if (newStatus === 'dispatched' || newStatus === 'delivered') {
    await processDispatchStockDeduction(updatedDispatch);
  }

  return updatedDispatch;
}

async function processDispatchStockDeduction(dispatch: Dispatch): Promise<void> {
  const orders = await getOrders();
  const targetOrder = orders.find((o) => o.id === dispatch.orderId || o.orderNumber === dispatch.orderNumber);
  if (targetOrder?.orderStatus === 'cancelled') {
    throw new Error('Cancelled orders cannot affect inventory.');
  }

  // AS Orders must NOT deduct stock
  const isASOrder = targetOrder?.orderType === 'AS';

  if (!dispatch.stockDeducted && !isASOrder) {
    const products = await getProducts();
    const deductedByProduct = new Map<string, number>();
    for (const item of dispatch.items) {
      deductedByProduct.set(item.productId, (deductedByProduct.get(item.productId) || 0) + item.quantity);
    }
    assertDispatchStockAvailable(dispatch.items, products);
    for (const [productId, quantity] of deductedByProduct) {
      const product = products.find((p) => p.id === productId);
      if (product) {
        const newStock = product.currentStock - quantity;
        await updateProduct(product.id, { currentStock: newStock });
      }
    }

    // Mark stock as deducted for this specific sub-delivery to avoid duplicate deductions
    const list = getLocalItem<Dispatch[]>(STORAGE_KEYS.DISPATCHES, initialDispatches);
    const newList = list.map((item) => (item.id === dispatch.id ? { ...item, stockDeducted: true } : item));
    setLocalItem(STORAGE_KEYS.DISPATCHES, newList);

    if (shouldSyncToFirebase()) {
      await persistCloudWrite(setDoc(doc(getDb(), 'dispatches', dispatch.id), { stockDeducted: true }, { merge: true }), 'Saving dispatch stock status');
    }
  }

  // Update order status based on total fulfillment progress across all sub-deliveries
  if (targetOrder) {
    const allDispatches = await getDispatches();
    const orderProgress = getOrderDeliveryProgress(targetOrder, allDispatches);

    let newOrderStatus: Order['orderStatus'] = targetOrder.orderStatus;
    if (orderProgress.isFullyDelivered) {
      const allDelivered = orderProgress.subDeliveries.every((d) => d.status === 'delivered');
      newOrderStatus = allDelivered ? 'completed' : 'dispatched';
    } else if (orderProgress.totalDeliveredQuantity > 0) {
      newOrderStatus = 'dispatched';
    }
    if (newOrderStatus !== targetOrder.orderStatus) {
      await updateOrderStatus(targetOrder.id, newOrderStatus);
    }
  }
}

// ================= PAYMENTS =================
export async function getPayments(): Promise<Payment[]> {
  await requireAnyPermission([['finance', 'view'], ['dashboard', 'view']]);
  const items = dedupeById(await getCloudItems<Payment>('payments'));
  setLocalItem(STORAGE_KEYS.PAYMENTS, items);
  return items;
}

export async function addPayment(data: Omit<Payment, 'id' | 'receiptNumber'>): Promise<Payment> {
  await requirePermission('finance', 'create');
  if (!Number.isFinite(data.amount) || data.amount <= 0) {
    throw new Error('Payment amount must be greater than zero.');
  }
  const orders = await getOrders();
  const targetOrder = orders.find((o) => o.id === data.orderId || o.orderNumber === data.orderNumber);
  if (!targetOrder) throw new Error('Sales order not found.');
  if (targetOrder.orderType === 'AS') {
    throw new Error('Payment not applicable for AS Order.');
  }
  if (targetOrder.orderStatus === 'cancelled') {
    throw new Error('Cancelled orders cannot receive payments.');
  }
  if (targetOrder.paymentType === 'cash_memo') {
    throw new Error('Cash Memo orders are already paid in full. Additional payments cannot be recorded.');
  }
  if (data.amount > Math.max(0, targetOrder.totalAmount - targetOrder.paidAmount)) {
    throw new Error('Payment amount cannot exceed the outstanding balance.');
  }

  const existingPaymentIds = new Set((await getPayments()).map((payment) => payment.id));
  const receiptNumber = createUniqueId('REC', existingPaymentIds);
  const newPayment: Payment = {
    ...data,
    id: receiptNumber,
    receiptNumber
  };

  const list = getLocalItem<Payment[]>(STORAGE_KEYS.PAYMENTS, initialPayments);
  setLocalItem(STORAGE_KEYS.PAYMENTS, [newPayment, ...list]);

  if (shouldSyncToFirebase()) {
    await persistCloudWrite(setDoc(doc(getDb(), 'payments', newPayment.id), newPayment), 'Adding payment');
  }

  const newPaid = targetOrder.paidAmount + data.amount;
  const newStatus: Order['paymentStatus'] = newPaid >= targetOrder.totalAmount ? 'paid' : 'partially_paid';
  await updateOrder(targetOrder.id, {
    paidAmount: newPaid,
    paymentStatus: newStatus
  });

  return newPayment;
}

// ================= PAYMENT REMINDERS =================
export async function getPaymentReminders(): Promise<PaymentReminder[]> {
  await requirePermission('finance', 'view');
  const dedupeByOrderId = (items: PaymentReminder[]) => {
    const seenOrders = new Set<string>();
    return items.filter((item) => {
      if (seenOrders.has(item.orderId)) return false;
      seenOrders.add(item.orderId);
      return true;
    });
  };
  const items = dedupeByOrderId(dedupeById(await getCloudItems<PaymentReminder>('paymentReminders')));
  setLocalItem(STORAGE_KEYS.PAYMENT_REMINDERS, items);
  return items;
}

export async function savePaymentReminder(
  data: Omit<PaymentReminder, 'id' | 'createdAt' | 'updatedAt'>
): Promise<PaymentReminder> {
  const now = new Date().toISOString();
  const existing = (await getPaymentReminders()).find((reminder) => reminder.orderId === data.orderId);
  await requirePermission('finance', existing ? 'edit' : 'create');
  const reminder: PaymentReminder = {
    ...data,
    id: existing?.id || `REM-${data.orderId}`,
    createdAt: existing?.createdAt || now,
    updatedAt: now
  };
  const list = getLocalItem<PaymentReminder[]>(STORAGE_KEYS.PAYMENT_REMINDERS, []);
  const next = [reminder, ...list.filter((item) => item.id !== reminder.id && item.orderId !== reminder.orderId)];
  setLocalItem(STORAGE_KEYS.PAYMENT_REMINDERS, next);

  if (shouldSyncToFirebase()) {
    await persistCloudWrite(setDoc(doc(getDb(), 'paymentReminders', reminder.id), sanitizeForFirestore(reminder)), 'Saving payment reminder');
  }
  return reminder;
}

// ================= EXPENSES =================
export async function getExpenses(): Promise<Expense[]> {
  await requirePermission('finance', 'view');
  const items = dedupeById(await getCloudItems<Expense>('expenses'));
  setLocalItem(STORAGE_KEYS.EXPENSES, items);
  return items;
}

export async function addExpense(data: Omit<Expense, 'id'>): Promise<Expense> {
  await requirePermission('finance', 'create');
  const id = `EXP-${Math.floor(300 + Math.random() * 700)}`;
  const newExpense: Expense = { ...data, id };

  const list = getLocalItem<Expense[]>(STORAGE_KEYS.EXPENSES, initialExpenses);
  const updatedList = [newExpense, ...list.filter((item) => item.id !== id)];
  setLocalItem(STORAGE_KEYS.EXPENSES, updatedList);

  if (shouldSyncToFirebase()) {
    await persistCloudWrite(setDoc(doc(getDb(), 'expenses', id), newExpense), 'Adding expense');
  }

  return newExpense;
}

export async function deleteExpense(id: string): Promise<void> {
  await requirePermission('finance', 'delete');
  const list = getLocalItem<Expense[]>(STORAGE_KEYS.EXPENSES, initialExpenses);
  const newList = list.filter((item) => item.id !== id);
  setLocalItem(STORAGE_KEYS.EXPENSES, newList);

  if (shouldSyncToFirebase()) {
    await persistCloudWrite(deleteDoc(doc(getDb(), 'expenses', id)), 'Deleting expense');
  }
}

// ================= RAW MATERIALS & USAGE =================
export async function getRawMaterials(): Promise<RawMaterial[]> {
  await requireAnyPermission([
    ['rawMaterials', 'view'],
    ['purchases', 'view'],
    ['purchasedMaterials', 'view'],
    ['finishedGoods', 'view'],
    ['dashboard', 'view']
  ]);
  const items = await getCloudItems<RawMaterial>('rawMaterials');
  setLocalItem(STORAGE_KEYS.RAW_MATERIALS, items);
  return items;
}

export async function addRawMaterial(data: Omit<RawMaterial, 'id' | 'status' | 'lastRestocked'>): Promise<RawMaterial> {
  await requireAnyPermission([
    ['rawMaterials', 'create'],
    ['purchases', 'create'],
    ['purchases', 'edit'],
    ['purchases', 'approve']
  ]);
  const id = `RM-${Math.floor(100 + Math.random() * 900)}`;
  const status = data.currentStock <= data.minimumStock ? 'low_stock' : 'healthy';
  const newMaterial: RawMaterial = {
    ...data,
    id,
    status,
    lastRestocked: new Date().toISOString().split('T')[0],
    // Set default unit configuration if not provided
    baseUnit: data.baseUnit || data.unit || 'kg',
    purchaseUnit: data.purchaseUnit || data.unit || 'kg',
    consumptionUnit: data.consumptionUnit || data.unit || 'kg',
    conversionFactor: data.conversionFactor || 1,
    piecesPerBaseUnit: data.piecesPerBaseUnit || undefined
  };

  const list = getLocalItem<RawMaterial[]>(STORAGE_KEYS.RAW_MATERIALS, initialRawMaterials);
  setLocalItem(STORAGE_KEYS.RAW_MATERIALS, [newMaterial, ...list]);

  if (shouldSyncToFirebase()) {
    await persistCloudWrite(setDoc(doc(getDb(), 'rawMaterials', id), newMaterial), 'Adding raw material');
  }

  return newMaterial;
}

export async function updateRawMaterial(id: string, updates: Partial<RawMaterial>): Promise<RawMaterial> {
  const inventoryUpdateKeys = new Set(['currentStock', 'minimumStock', 'unitCost', 'supplier', 'lastRestocked', 'status']);
  const updateKeys = Object.keys(updates);
  if (updateKeys.length > 0 && updateKeys.every((key) => inventoryUpdateKeys.has(key))) {
    await requireAnyPermission([
      ['rawMaterials', 'edit'],
      ['rawMaterials', 'create'],
      ['purchases', 'edit'],
      ['purchases', 'approve'],
      ['finishedGoods', 'create'],
      ['dispatch', 'create']
    ]);
  } else {
    await requirePermission('rawMaterials', 'edit');
  }
  let updated: RawMaterial | null = null;
  const list = getLocalItem<RawMaterial[]>(STORAGE_KEYS.RAW_MATERIALS, initialRawMaterials);
  let found = false;
  const newList = list.map((item) => {
    if (item.id === id) {
      found = true;
      const currentStock = updates.currentStock !== undefined ? updates.currentStock : item.currentStock;
      const minimumStock = updates.minimumStock !== undefined ? updates.minimumStock : item.minimumStock;
      const status = currentStock <= minimumStock ? ('low_stock' as const) : ('healthy' as const);
      updated = { ...item, ...updates, status };
      return updated;
    }
    return item;
  });
  if (!found || !updated) throw new Error(`Raw material not found: ${id}`);
  setLocalItem(STORAGE_KEYS.RAW_MATERIALS, newList);

  if (shouldSyncToFirebase()) {
    await persistCloudWrite(setDoc(doc(getDb(), 'rawMaterials', id), updated, { merge: true }), 'Updating raw material');
  }

  return updated;
}

export async function deleteRawMaterial(id: string): Promise<void> {
  await requirePermission('rawMaterials', 'delete');
  const list = getLocalItem<RawMaterial[]>(STORAGE_KEYS.RAW_MATERIALS, initialRawMaterials);
  setLocalItem(STORAGE_KEYS.RAW_MATERIALS, list.filter((item) => item.id !== id));

  if (shouldSyncToFirebase()) {
    await persistCloudWrite(deleteDoc(doc(getDb(), 'rawMaterials', id)), 'Deleting raw material');
  }
}

export async function getRawMaterialUsage(): Promise<RawMaterialUsage[]> {
  await requireAnyPermission([['rawMaterials', 'view'], ['finishedGoods', 'view']]);
  const items = await getCloudItems<RawMaterialUsage>('rawMaterialUsage');
  setLocalItem(STORAGE_KEYS.RAW_MATERIAL_USAGE, items);
  return items;
}

export async function recordRawMaterialUsage(data: Omit<RawMaterialUsage, 'id'>): Promise<RawMaterialUsage> {
  await requireAnyPermission([['rawMaterials', 'create'], ['finishedGoods', 'create'], ['dispatch', 'create']]);
  const id = `RMU-${Math.floor(1000 + Math.random() * 9000)}`;
  
  // Get material to handle unit conversion
  const materials = await getRawMaterials();
  const material = materials.find((m) => m.id === data.materialId);
  if (!material) {
    throw new Error('Raw material not found.');
  }
  
  // Stock deduction is the net consumption plus recorded wastage.
  const totalDeductionInput = data.totalDeduction || data.quantity;
  const baseQuantity = toBaseQuantity(data.quantity, data.unit, material);
  const baseTotalDeduction = toBaseQuantity(totalDeductionInput, data.unit, material);
  const baseUnit = material.baseUnit || material.unit;
  const equivalentPieces = data.equivalentPieces ?? (
    material.piecesPerBaseUnit && material.piecesPerBaseUnit > 0
      ? baseQuantity * material.piecesPerBaseUnit
      : undefined
  );

  if (baseTotalDeduction > material.currentStock) {
    throw new Error(`Insufficient stock. Available: ${material.currentStock} ${baseUnit}.`);
  }
  
  const newUsage: RawMaterialUsage = {
    ...data,
    id,
    baseQuantity,
    baseTotalDeduction,
    baseUnit,
    equivalentPieces,
    createdAt: new Date().toISOString()
  };

  const list = getLocalItem<RawMaterialUsage[]>(STORAGE_KEYS.RAW_MATERIAL_USAGE, initialRawMaterialUsage);
  setLocalItem(STORAGE_KEYS.RAW_MATERIAL_USAGE, [newUsage, ...list]);

  if (shouldSyncToFirebase()) {
    await persistCloudWrite(setDoc(doc(getDb(), 'rawMaterialUsage', id), newUsage), 'Recording raw material usage');
  }

  // Deduct stock from target raw material (always in base unit using total deduction)
  if (material) {
    const newStock = Math.max(0, material.currentStock - baseTotalDeduction);
    await updateRawMaterial(material.id, { currentStock: newStock });
  }

  return newUsage;
}

// ================= PURCHASED MATERIALS =================
export async function getPurchasedMaterials(): Promise<PurchasedMaterial[]> {
  await requirePermission('purchasedMaterials', 'view');
  const items = await getCloudItems<PurchasedMaterial>('purchasedMaterials');
  setLocalItem(STORAGE_KEYS.PURCHASED_MATERIALS, items);
  return items;
}

export async function addPurchasedMaterial(
  data: Omit<PurchasedMaterial, 'id' | 'createdAt' | 'updatedAt'>
): Promise<PurchasedMaterial> {
  await requirePermission('purchasedMaterials', 'create');
  const id = `PM-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const now = new Date().toISOString();
  const newMaterial: PurchasedMaterial = { ...data, id, createdAt: now };
  const list = getLocalItem<PurchasedMaterial[]>(STORAGE_KEYS.PURCHASED_MATERIALS, []);
  setLocalItem(STORAGE_KEYS.PURCHASED_MATERIALS, [newMaterial, ...list]);

  if (shouldSyncToFirebase()) {
    await persistCloudWrite(setDoc(doc(getDb(), 'purchasedMaterials', id), sanitizeForFirestore(newMaterial)), 'Adding purchased material');
  }
  return newMaterial;
}

export async function updatePurchasedMaterial(
  id: string,
  updates: Partial<Omit<PurchasedMaterial, 'id' | 'createdAt'>>
): Promise<PurchasedMaterial> {
  await requirePermission('purchasedMaterials', 'edit');
  const list = getLocalItem<PurchasedMaterial[]>(STORAGE_KEYS.PURCHASED_MATERIALS, []);
  const existing = list.find((item) => item.id === id);
  if (!existing) throw new Error('Purchased material not found');
  const updated: PurchasedMaterial = { ...existing, ...updates, updatedAt: new Date().toISOString() };
  const fieldsToClear: Array<keyof PurchasedMaterial> = updates.conversionMode === 'bags'
    ? ['packetQuantity', 'packetWeightKg', 'unitsPerPacket', 'totalPieces', 'weightPerPieceGrams', 'equivalentPieces']
    : updates.conversionMode === 'piece_count'
      ? ['packetQuantity', 'packetWeightKg', 'unitsPerPacket', 'numberOfBags', 'weightPerBagKg']
      : updates.conversionMode === 'packets'
        ? ['unitsPerPacket', 'numberOfBags', 'weightPerBagKg', 'totalPieces', 'weightPerPieceGrams', 'equivalentPieces']
        : [];
  fieldsToClear.forEach((field) => {
    delete updated[field];
  });
  setLocalItem(STORAGE_KEYS.PURCHASED_MATERIALS, list.map((item) => item.id === id ? updated : item));

  if (shouldSyncToFirebase()) {
    const firebaseUpdates: Record<string, unknown> = sanitizeForFirestore(updated);
    fieldsToClear.forEach((field) => {
      firebaseUpdates[field] = deleteField();
    });
    await persistCloudWrite(setDoc(doc(getDb(), 'purchasedMaterials', id), firebaseUpdates, { merge: true }), 'Updating purchased material');
  }
  return updated;
}

export async function deletePurchasedMaterial(id: string): Promise<void> {
  await requirePermission('purchasedMaterials', 'delete');
  const list = getLocalItem<PurchasedMaterial[]>(STORAGE_KEYS.PURCHASED_MATERIALS, []);
  setLocalItem(STORAGE_KEYS.PURCHASED_MATERIALS, list.filter((item) => item.id !== id));

  if (shouldSyncToFirebase()) {
    await persistCloudWrite(deleteDoc(doc(getDb(), 'purchasedMaterials', id)), 'Deleting purchased material');
  }
}

// ================= PURCHASES =================
export async function getPurchases(): Promise<PurchaseOrder[]> {
  await requireAnyPermission([['purchases', 'view'], ['finance', 'view']]);
  const items = dedupeById(await getCloudItems<PurchaseOrder>('purchases'));
  setLocalItem(STORAGE_KEYS.PURCHASES, items);
  return items;
}

export async function addPurchase(
  purchaseData: Omit<PurchaseOrder, 'id' | 'purchaseNumber' | 'paidAmount' | 'paymentStatus' | 'createdAt'> & {
    id?: string;
    purchaseNumber?: string;
    paidAmount?: number;
    paymentStatus?: PurchasePaymentStatus;
  }
): Promise<PurchaseOrder> {
  await requirePermission('purchases', 'create');
  const randomNum = Math.floor(10000 + Math.random() * 90000);
  const purchaseNumber = purchaseData.purchaseNumber || `PO-${randomNum}`;
  const id = purchaseData.id || purchaseNumber;

  const newPurchase: PurchaseOrder = {
    ...purchaseData,
    id,
    purchaseNumber,
    paidAmount: purchaseData.paidAmount || 0,
    paymentStatus: purchaseData.paymentStatus || 'pending',
    stockAdded: false,
    createdAt: new Date().toISOString().split('T')[0]
  };

  const list = getLocalItem<PurchaseOrder[]>(STORAGE_KEYS.PURCHASES, initialPurchases);
  setLocalItem(STORAGE_KEYS.PURCHASES, [newPurchase, ...list]);

  if (shouldSyncToFirebase()) {
    await persistCloudWrite(setDoc(doc(getDb(), 'purchases', newPurchase.id), newPurchase), 'Adding purchase');
  }

  // Idempotent stock addition: if status is 'received' or 'completed', trigger stock increment once
  if (newPurchase.status === 'received' || newPurchase.status === 'completed') {
    return await processPurchaseStockAddition(newPurchase);
  }

  return newPurchase;
}

export async function updatePurchase(id: string, updates: Partial<PurchaseOrder>): Promise<PurchaseOrder> {
  await requirePermission('purchases', 'edit');
  const purchases = await getPurchases();
  const target = purchases.find((purchase) => purchase.id === id);
  if (!target) throw new Error(`Purchase order not found: ${id}`);

  const updated: PurchaseOrder = { ...target, ...updates };
  if (target.stockAdded && updates.items) {
    const previousByMaterial = new Map<string, number>();
    const nextByMaterial = new Map<string, number>();
    target.items.forEach((item) => previousByMaterial.set(item.rawMaterialId, (previousByMaterial.get(item.rawMaterialId) || 0) + item.quantity));
    updated.items.forEach((item) => nextByMaterial.set(item.rawMaterialId, (nextByMaterial.get(item.rawMaterialId) || 0) + item.quantity));

    const materials = await getRawMaterials();
    const materialIds = new Set([...previousByMaterial.keys(), ...nextByMaterial.keys()]);
    for (const materialId of materialIds) {
      const material = materials.find((item) => item.id === materialId);
      if (!material) continue;
      const delta = (nextByMaterial.get(materialId) || 0) - (previousByMaterial.get(materialId) || 0);
      if (delta !== 0) {
        await updateRawMaterial(materialId, {
          currentStock: Math.max(0, material.currentStock + delta),
          lastRestocked: updated.purchaseDate || new Date().toISOString().split('T')[0]
        });
      }
    }
  }

  const list = getLocalItem<PurchaseOrder[]>(STORAGE_KEYS.PURCHASES, initialPurchases);
  setLocalItem(STORAGE_KEYS.PURCHASES, list.map((purchase) => purchase.id === id ? updated : purchase));

  if (shouldSyncToFirebase()) {
    await persistCloudWrite(setDoc(doc(getDb(), 'purchases', id), updates, { merge: true }), 'Updating purchase');
  }
  return updated;
}

export async function updatePurchaseStatus(id: string, newStatus: PurchaseStatus): Promise<PurchaseOrder> {
  const purchases = await getPurchases();
  const target = purchases.find((p) => p.id === id);

  if (!target) throw new Error('Purchase order not found');
  let canEdit = true;
  try {
    await requirePermission('purchases', 'edit');
  } catch (error) {
    if (!(error instanceof Error) || !error.message.startsWith('Permission denied:')) throw error;
    canEdit = false;
  }
  if (!canEdit) {
    await requirePermission('purchases', 'approve');
    if (target.status !== 'pending' || newStatus !== 'received') {
      throw new Error('Approve permission only allows receiving a pending purchase.');
    }
  }

  const updated: PurchaseOrder = { ...target, status: newStatus };

  const list = getLocalItem<PurchaseOrder[]>(STORAGE_KEYS.PURCHASES, initialPurchases);
  const newList = list.map((item) => (item.id === id ? updated : item));
  setLocalItem(STORAGE_KEYS.PURCHASES, newList);

  if (shouldSyncToFirebase()) {
    await persistCloudWrite(setDoc(doc(getDb(), 'purchases', id), { status: newStatus }, { merge: true }), 'Updating purchase status');
  }

  // If transition to received or completed, apply stock addition idempotently
  if (newStatus === 'received' || newStatus === 'completed') {
    return await processPurchaseStockAddition(updated);
  }

  return updated;
}

export async function recordPurchasePayment(id: string, amount: number, paymentDate = new Date().toISOString().split('T')[0], notes = ''): Promise<PurchaseOrder> {
  await requirePermission('finance', 'create');
  await requirePermission('purchases', 'edit');
  const purchases = await getPurchases();
  const target = purchases.find((p) => p.id === id);

  if (!target) throw new Error('Purchase order not found');
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Payment amount must be greater than zero.');
  if (!paymentDate || Number.isNaN(Date.parse(`${paymentDate}T00:00:00`))) throw new Error('Payment date is invalid.');
  if (amount > Math.max(0, target.totalAmount - target.paidAmount)) throw new Error('Payment amount cannot exceed the outstanding balance.');

  const newPaidAmount = target.paidAmount + amount;
  const newPaymentStatus: PurchasePaymentStatus =
    newPaidAmount >= target.totalAmount ? 'paid' : 'partially_paid';

  const updated: PurchaseOrder = {
    ...target,
    paidAmount: newPaidAmount,
    paymentStatus: newPaymentStatus,
    paymentRecords: [
      ...(target.paymentRecords || []),
      {
        id: `PAY-${Date.now()}`,
        purchaseId: target.id,
        purchaseNumber: target.purchaseNumber,
        supplierName: target.supplierName,
        amount,
        paymentDate,
        notes
      } satisfies PurchasePayment
    ]
  };

  const list = getLocalItem<PurchaseOrder[]>(STORAGE_KEYS.PURCHASES, initialPurchases);
  const newList = list.map((item) => (item.id === id ? updated : item));
  setLocalItem(STORAGE_KEYS.PURCHASES, newList);

  if (shouldSyncToFirebase()) {
    await persistCloudWrite(
      setDoc(
        doc(getDb(), 'purchases', id),
        { paidAmount: newPaidAmount, paymentStatus: newPaymentStatus, paymentRecords: updated.paymentRecords },
        { merge: true }
      ),
      'Recording purchase payment'
    );
  }

  return updated;
}

export async function deletePurchase(id: string): Promise<void> {
  await requirePermission('purchases', 'delete');
  const list = getLocalItem<PurchaseOrder[]>(STORAGE_KEYS.PURCHASES, initialPurchases);
  setLocalItem(
    STORAGE_KEYS.PURCHASES,
    list.filter((item) => item.id !== id)
  );

  if (shouldSyncToFirebase()) {
    await persistCloudWrite(deleteDoc(doc(getDb(), 'purchases', id)), 'Deleting purchase');
  }
}

async function processPurchaseStockAddition(purchase: PurchaseOrder): Promise<PurchaseOrder> {
  // CRITICAL RULE: If stockAdded is already true, NEVER add stock again!
  if (purchase.stockAdded) {
    return purchase;
  }

  if (purchase.status !== 'received' && purchase.status !== 'completed') {
    return purchase;
  }

  const materials = await getRawMaterials();
  const additionsByMaterial = new Map<string, number>();

  for (const item of purchase.items) {
    let material = materials.find((m) => m.id === item.rawMaterialId) ||
                   materials.find((m) => (m.name || '').trim().toLowerCase() === (item.rawMaterialName || '').trim().toLowerCase());

    if (material) {
      // Inventory is stored in base units, while purchase lines may use bags,
      // packets, cartons, or pieces.
      const quantityToAdd = toBaseQuantity(item.quantity, item.unit, material);
      
      const previousAddition = additionsByMaterial.get(material.id) || 0;
      const totalAddition = previousAddition + quantityToAdd;
      const newStock = material.currentStock + totalAddition;
      await updateRawMaterial(material.id, {
        currentStock: newStock,
        unitCost: item.unitCost > 0 ? item.unitCost : material.unitCost,
        supplier: purchase.supplierName || material.supplier,
        lastRestocked: purchase.purchaseDate || new Date().toISOString().split('T')[0]
      });
      additionsByMaterial.set(material.id, totalAddition);
    } else if (item.rawMaterialName) {
      const newMat = await addRawMaterial({
        name: item.rawMaterialName.trim(),
        code: item.hsnSac || `MAT-${Math.floor(1000 + Math.random() * 9000)}`,
        category: item.category || 'granules',
        currentStock: item.quantity,
        minimumStock: 500,
        unit: item.unit || 'kg',
        baseUnit: item.unit || 'kg',
        purchaseUnit: item.unit || 'kg',
        consumptionUnit: item.unit || 'kg',
        conversionFactor: 1,
        piecesPerBaseUnit: undefined,
        unitCost: item.unitCost || 0,
        supplier: purchase.supplierName || ''
      });
      materials.push(newMat);
      additionsByMaterial.set(newMat.id, item.quantity);
    }
  }

  const updatedPurchase = { ...purchase, stockAdded: true };
  const list = getLocalItem<PurchaseOrder[]>(STORAGE_KEYS.PURCHASES, initialPurchases);
  const newList = list.map((p) => (p.id === purchase.id ? updatedPurchase : p));
  setLocalItem(STORAGE_KEYS.PURCHASES, newList);

  if (shouldSyncToFirebase()) {
    await persistCloudWrite(setDoc(doc(getDb(), 'purchases', purchase.id), { stockAdded: true }, { merge: true }), 'Saving purchase stock status');
  }

  return updatedPurchase;
}

// ================= FINISHED GOODS LOG =================
export async function getFinishedGoodsLogs(): Promise<FinishedGoodsLog[]> {
  await requirePermission('finishedGoods', 'view');
  const items = await getCloudItems<FinishedGoodsLog>('finishedGoodsLogs');
  setLocalItem(STORAGE_KEYS.FINISHED_GOODS_LOGS, items);
  return items;
}

export async function addFinishedGoodsLog(data: Omit<FinishedGoodsLog, 'id'>): Promise<FinishedGoodsLog> {
  await requirePermission('finishedGoods', 'create');
  const id = `FGL-${Math.floor(9000 + Math.random() * 1000)}`;
  const newLog: FinishedGoodsLog = {
    ...data,
    id,
    source: data.source || 'Production',
    createdAt: data.createdAt || new Date().toISOString()
  };

  const list = getLocalItem<FinishedGoodsLog[]>(STORAGE_KEYS.FINISHED_GOODS_LOGS, initialFinishedGoodsLogs);
  setLocalItem(STORAGE_KEYS.FINISHED_GOODS_LOGS, [newLog, ...list]);

  if (shouldSyncToFirebase()) {
    await persistCloudWrite(setDoc(doc(getDb(), 'finishedGoodsLogs', id), newLog), 'Adding finished-goods log');
  }

  // Add produced quantity to target product stock
  const products = await getProducts();
  const product = products.find((p) => p.id === data.productId);
  if (product) {
    await updateProduct(product.id, {
      currentStock: product.currentStock + data.quantityProduced
    });
  }

  return newLog;
}

// ================= DOCUMENTS & FIREBASE STORAGE =================
export async function getDocuments(): Promise<DocumentItem[]> {
  await requirePermission('documents', 'view');
  const items = await getCloudItems<DocumentItem>('documents');
  setLocalItem(STORAGE_KEYS.DOCUMENTS, items);
  return items;
}

export async function uploadDocument(file: File, category: DocumentItem['category']): Promise<DocumentItem> {
  await requirePermission('documents', 'create');
  if (!isLiveFirebaseConfigured || !storage) {
    throw new Error('Firebase Storage is required to upload company documents.');
  }
  const id = `DOC-${Math.floor(100 + Math.random() * 900)}`;
  const storagePath = `documents/${Date.now()}_${file.name}`;
  const fileRef = ref(storage, storagePath);
  await withTimeout(uploadBytes(fileRef, file), 30000);
  const downloadUrl = await withTimeout(getDownloadURL(fileRef), 10000);

  const newDoc: DocumentItem = {
    id,
    name: file.name,
    category,
    fileType: file.type || 'application/octet-stream',
    fileSize: file.size,
    downloadUrl,
    storagePath,
    uploadDate: new Date().toISOString().split('T')[0]
  };

  const list = getLocalItem<DocumentItem[]>(STORAGE_KEYS.DOCUMENTS, initialDocuments);
  setLocalItem(STORAGE_KEYS.DOCUMENTS, [newDoc, ...list]);

  if (shouldSyncToFirebase()) {
    await persistCloudWrite(setDoc(doc(getDb(), 'documents', id), newDoc), 'Saving document record');
  }

  return newDoc;
}

export async function deleteDocument(id: string, storagePath?: string): Promise<void> {
  await requirePermission('documents', 'delete');
  if (isLiveFirebaseConfigured && storage && storagePath) {
    await withTimeout(deleteObject(ref(storage, storagePath)), 10000);
  }

  if (shouldSyncToFirebase()) {
    await persistCloudWrite(deleteDoc(doc(getDb(), 'documents', id)), 'Deleting document record');
  }

  const list = getLocalItem<DocumentItem[]>(STORAGE_KEYS.DOCUMENTS, initialDocuments);
  setLocalItem(STORAGE_KEYS.DOCUMENTS, list.filter((d) => d.id !== id));
}

// ================= SETTINGS =================
export async function getSettings(): Promise<Settings> {
  if (!auth?.currentUser) throw new Error('You must sign in to view company settings.');
  if (isLiveFirebaseConfigured && db) {
    const snap = await withTimeout(getDoc(doc(getDb(), 'settings', 'company_settings')), 10000);
    return snap.exists() ? snap.data() as Settings : initialSettings;
  }
  throw new Error('Company settings are unavailable without Firebase.');
}

export async function updateSettings(updates: Partial<Settings>): Promise<Settings> {
  if (!auth?.currentUser || (await auth.currentUser.getIdTokenResult()).claims.admin !== true) {
    throw new Error('Administrator permission is required to update company settings.');
  }
  const current = await getSettings();
  const newSettings = { ...current, ...updates };
  setLocalItem(STORAGE_KEYS.SETTINGS, newSettings);

  if (shouldSyncToFirebase()) {
    await persistCloudWrite(setDoc(doc(getDb(), 'settings', 'company_settings'), newSettings), 'Updating company settings');
  }
  return newSettings;
}

// ================= DASHBOARD & ANALYTICS METRICS =================
export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  await requirePermission('dashboard', 'view');
  const orders = await getOrders();
  const products = await getProducts();
  const payments = await getPayments();
  const rawMaterials = await getRawMaterials();

  // Exclude AS Orders from commercial totalSales
  const commercialOrders = orders.filter((o) => o.orderType !== 'AS');
  const totalSales = commercialOrders.reduce((sum, o) => sum + o.totalAmount, 0);
  const totalOrders = orders.length;
  const pendingOrders = orders.filter((o) => o.orderStatus === 'pending' || o.orderStatus === 'confirmed').length;

  const finishedGoodsCount = products.reduce((sum, p) => sum + p.currentStock, 0);
  const productLowStockCount = products.filter((p) => p.currentStock <= p.minimumStock).length;
  const rmLowStockCount = rawMaterials.filter((rm) => rm.currentStock <= rm.minimumStock).length;
  const lowStockCount = productLowStockCount + rmLowStockCount;

  const totalCollected = payments.reduce((sum, p) => sum + p.amount, 0);
  const outstandingPayments = Math.max(0, totalSales - totalCollected);

  return {
    totalSales,
    totalOrders,
    pendingOrders,
    finishedGoodsCount,
    lowStockCount,
    outstandingPayments
  };
}
