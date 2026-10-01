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
import { db, storage, isLiveFirebaseConfigured } from '../firebase/config';

// Helper to check if Firebase sync should be attempted
const shouldSyncToFirebase = (): boolean => {
  return Boolean(isLiveFirebaseConfigured && db !== null);
};

// Helper to safely get db instance (for TypeScript)
const getDb = (): NonNullable<typeof db> => {
  if (!db) throw new Error('Firestore not initialized');
  return db;
};
import type {
  Customer,
  Product,
  Order,
  Payment,
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
  , SignedOrderCopy
} from '../types';
import {
  initialCustomers,
  initialProducts,
  initialOrders,
  initialDispatches,
  initialPayments,
  initialExpenses,
  initialRawMaterials,
  initialRawMaterialUsage,
  initialFinishedGoodsLogs,
  initialDocuments,
  initialSettings,
  initialPurchases
} from '../data/seedData';
import { getOrderDeliveryProgress, generateNextChallanNumber } from '../utils/dispatchUtils';

// LocalStorage Keys for fallback
const STORAGE_KEYS = {
  CUSTOMERS: 'angel_pet_customers',
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
  INITIALIZED: 'angel_pet_seed_initialized_v3'
};

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

// Ensure database is seeded with initial data on first load
export async function seedDatabase(force = false): Promise<void> {
  const isAlreadyInitialized = localStorage.getItem(STORAGE_KEYS.INITIALIZED);

  if (isLiveFirebaseConfigured && db) {
    try {
      const customersSnap = await withTimeout(getDocs(collection(getDb(), 'customers')), 2000);
      const isFirestoreEmpty = customersSnap.empty;

      if (isFirestoreEmpty || force) {
        console.info('Seeding Firestore with initial dataset...');
        // Seed Customers
        for (const item of initialCustomers) {
          await withTimeout(setDoc(doc(getDb(), 'customers', item.id), item), 1500).catch(() => {});
        }
        // Seed Products
        for (const item of initialProducts) {
          await withTimeout(setDoc(doc(getDb(), 'products', item.id), item), 1500).catch(() => {});
        }
        // Seed Orders
        for (const item of initialOrders) {
          await withTimeout(setDoc(doc(getDb(), 'orders', item.id), item), 1500).catch(() => {});
        }
        // Seed Dispatches
        for (const item of initialDispatches) {
          await withTimeout(setDoc(doc(getDb(), 'dispatches', item.id), item), 1500).catch(() => {});
        }
        // Seed Payments
        for (const item of initialPayments) {
          await withTimeout(setDoc(doc(getDb(), 'payments', item.id), item), 1500).catch(() => {});
        }
        // Seed Expenses
        for (const item of initialExpenses) {
          await withTimeout(setDoc(doc(getDb(), 'expenses', item.id), item), 1500).catch(() => {});
        }
        // Seed Raw Materials
        for (const item of initialRawMaterials) {
          await withTimeout(setDoc(doc(getDb(), 'rawMaterials', item.id), item), 1500).catch(() => {});
        }
        // Seed Raw Material Usage
        for (const item of initialRawMaterialUsage) {
          await withTimeout(setDoc(doc(getDb(), 'rawMaterialUsage', item.id), item), 1500).catch(() => {});
        }
        // Seed Finished Goods Logs
        for (const item of initialFinishedGoodsLogs) {
          await withTimeout(setDoc(doc(getDb(), 'finishedGoodsLogs', item.id), item), 1500).catch(() => {});
        }
        // Seed Documents
        for (const item of initialDocuments) {
          await withTimeout(setDoc(doc(getDb(), 'documents', item.id), item), 1500).catch(() => {});
        }
        // Seed Purchases
        for (const item of initialPurchases) {
          await withTimeout(setDoc(doc(getDb(), 'purchases', item.id), item), 1500).catch(() => {});
        }
        // Seed Settings
        await withTimeout(setDoc(doc(getDb(), 'settings', 'company_settings'), initialSettings), 1500).catch(() => {});
      }
    } catch (e) {
      console.warn('Firebase seeding skipped or timed out, operating with LocalStorage sync:', e);
    }
  }

  if (!isAlreadyInitialized || force) {
    setLocalItem(STORAGE_KEYS.CUSTOMERS, initialCustomers);
    setLocalItem(STORAGE_KEYS.PRODUCTS, initialProducts);
    setLocalItem(STORAGE_KEYS.ORDERS, initialOrders);
    setLocalItem(STORAGE_KEYS.DISPATCHES, initialDispatches);
    setLocalItem(STORAGE_KEYS.PAYMENTS, initialPayments);
    setLocalItem(STORAGE_KEYS.EXPENSES, initialExpenses);
    setLocalItem(STORAGE_KEYS.RAW_MATERIALS, initialRawMaterials);
    setLocalItem(STORAGE_KEYS.RAW_MATERIAL_USAGE, initialRawMaterialUsage);
    setLocalItem(STORAGE_KEYS.FINISHED_GOODS_LOGS, initialFinishedGoodsLogs);
    setLocalItem(STORAGE_KEYS.DOCUMENTS, initialDocuments);
    setLocalItem(STORAGE_KEYS.SETTINGS, initialSettings);
    setLocalItem(STORAGE_KEYS.PURCHASES, initialPurchases);
    localStorage.setItem(STORAGE_KEYS.INITIALIZED, 'true');
  }
}

// Run seed check immediately
if (typeof localStorage !== 'undefined') {
  seedDatabase().catch((err) => console.error('Seed check error:', err));
}

// ================= CUSTOMERS =================
export async function getCustomers(): Promise<Customer[]> {
  const localItems = getLocalItem<Customer[]>(STORAGE_KEYS.CUSTOMERS, initialCustomers);
  if (isLiveFirebaseConfigured && db) {
    try {
      const snap = await withTimeout(getDocs(collection(getDb(), 'customers')), 2000);
      if (snap && snap.docs.length > 0) {
        const remoteItems = snap.docs.map((d) => d.data() as Customer);
        const merged = mergeLocalAndRemote(localItems, remoteItems);
        setLocalItem(STORAGE_KEYS.CUSTOMERS, merged);
        return merged;
      }
    } catch (e) {
      console.warn('Firebase getCustomers failed or timed out, falling back to LocalStorage:', e);
    }
  }
  return localItems;
}

export async function addCustomer(data: Omit<Customer, 'id' | 'createdAt' | 'totalOrders' | 'totalSpent'> & { id?: string }): Promise<Customer> {
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
    withTimeout(setDoc(doc(getDb(), 'customers', newCustomer.id), newCustomer), 2500).catch((e) =>
      console.error('Error adding customer to Firebase:', e)
    );
  }

  return newCustomer;
}

export async function updateCustomer(id: string, updates: Partial<Customer>): Promise<Customer> {
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
  if (!found) {
    updated = {
      id,
      name: updates.name || 'Customer',
      phone: updates.phone || '',
      company: updates.company || 'Company',
      address: updates.address || '',
      customerType: updates.customerType || 'Direct Customer',
      priceCategory: updates.priceCategory || 'A',
      status: updates.status || 'active',
      createdAt: new Date().toISOString().split('T')[0],
      totalOrders: updates.totalOrders || 0,
      totalSpent: updates.totalSpent || 0,
      ...updates
    };
    newList.push(updated);
  }
  setLocalItem(STORAGE_KEYS.CUSTOMERS, newList);

  if (shouldSyncToFirebase() && updated) {
    withTimeout(setDoc(doc(getDb(), 'customers', id), updated, { merge: true }), 2500).catch((e) =>
      console.error('Error updating customer in Firebase:', e)
    );
  }

  return updated!;
}

export async function deleteCustomer(id: string): Promise<void> {
  const list = getLocalItem<Customer[]>(STORAGE_KEYS.CUSTOMERS, initialCustomers);
  setLocalItem(STORAGE_KEYS.CUSTOMERS, list.filter((item) => item.id !== id));

  if (shouldSyncToFirebase()) {
    withTimeout(deleteDoc(doc(getDb(), 'customers', id)), 2500).catch((e) =>
      console.error('Error deleting customer in Firebase:', e)
    );
  }
}

// ================= PRODUCTS =================
export async function getProducts(): Promise<Product[]> {
  const localItems = getLocalItem<Product[]>(STORAGE_KEYS.PRODUCTS, initialProducts);

  const mergedWithInitial: Product[] = [];
  const processedIds = new Set<string>();

  for (const item of localItems) {
    processedIds.add(item.id);
    mergedWithInitial.push(item);
  }

  for (const init of initialProducts) {
    if (!processedIds.has(init.id)) {
      mergedWithInitial.push(init);
      processedIds.add(init.id);
    }
  }

  setLocalItem(STORAGE_KEYS.PRODUCTS, mergedWithInitial);

  if (isLiveFirebaseConfigured && db) {
    try {
      const snap = await withTimeout(getDocs(collection(getDb(), 'products')), 2000);
      if (snap && snap.docs.length > 0) {
        const remoteItems = snap.docs.map((d) => d.data() as Product);
        const merged = mergeLocalAndRemote(mergedWithInitial, remoteItems);
        setLocalItem(STORAGE_KEYS.PRODUCTS, merged);
        return merged;
      }
    } catch (e) {
      console.warn('Firebase getProducts failed or timed out, falling back to LocalStorage:', e);
    }
  }
  return mergedWithInitial;
}

export async function addProduct(data: Omit<Product, 'id' | 'createdAt'>): Promise<Product> {
  const prefix = data.type === 'bottle' ? 'PRD-1' : 'PRD-2';
  const newProduct: Product = {
    ...data,
    id: `${prefix}${Math.floor(100 + Math.random() * 900)}`,
    createdAt: new Date().toISOString().split('T')[0]
  };

  const list = getLocalItem<Product[]>(STORAGE_KEYS.PRODUCTS, initialProducts);
  setLocalItem(STORAGE_KEYS.PRODUCTS, [newProduct, ...list]);

  if (shouldSyncToFirebase()) {
    withTimeout(setDoc(doc(getDb(), 'products', newProduct.id), newProduct), 2500).catch((e) =>
      console.error('Error adding product to Firebase:', e)
    );
  }

  return newProduct;
}

export async function updateProduct(id: string, updates: Partial<Product>): Promise<Product> {
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
    withTimeout(setDoc(doc(getDb(), 'products', id), firebaseUpdates, { merge: true }), 2500).catch((error) => {
      console.error('Error updating product in Firebase:', {
        productId: id,
        error
      });
    });
  }

  if (!updated) throw new Error('Product not found');
  return updated;
}

export async function deleteProduct(id: string): Promise<void> {
  const list = getLocalItem<Product[]>(STORAGE_KEYS.PRODUCTS, initialProducts);
  setLocalItem(STORAGE_KEYS.PRODUCTS, list.filter((item) => item.id !== id));

  if (shouldSyncToFirebase()) {
    withTimeout(deleteDoc(doc(getDb(), 'products', id)), 2500).catch((e) =>
      console.error('Error deleting product in Firebase:', e)
    );
  }
}

// ================= ORDERS =================
export async function getOrders(): Promise<Order[]> {
  const localItems = getLocalItem<Order[]>(STORAGE_KEYS.ORDERS, initialOrders);
  if (isLiveFirebaseConfigured && db) {
    try {
      const snap = await withTimeout(getDocs(collection(getDb(), 'orders')), 2000);
      if (snap && snap.docs.length > 0) {
        const remoteItems = snap.docs.map((d) => d.data() as Order);
        const merged = mergeLocalAndRemote(localItems, remoteItems);
        setLocalItem(STORAGE_KEYS.ORDERS, merged);
        return merged;
      }
    } catch (e) {
      console.warn('Firebase getOrders failed or timed out, falling back to LocalStorage:', e);
    }
  }
  return localItems;
}

export async function addOrder(orderData: Omit<Order, 'id' | 'orderNumber' | 'paidAmount' | 'paymentStatus' | 'orderStatus' | 'orderDate'>): Promise<Order> {
  const randomNum = Math.floor(10000 + Math.random() * 90000);
  const orderNumber = `ORD-${randomNum}`;
  const orderType = orderData.orderType || 'REGULAR';
  const isAS = orderType === 'AS';
  const isCashMemo = !isAS && orderData.paymentType === 'cash_memo';
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
    withTimeout(setDoc(doc(getDb(), 'orders', newOrder.id), newOrder), 2500).catch((e) =>
      console.error('Error adding order to Firebase:', e)
    );
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
    const receiptNumber = `REC-${Math.floor(5000 + Math.random() * 5000)}`;
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
      withTimeout(setDoc(doc(getDb(), 'payments', newPayment.id), newPayment), 2500).catch((e) =>
        console.error('Error adding Cash Memo payment to Firebase:', e)
      );
    }
  }

  return newOrder;
}

export async function updateOrder(id: string, updates: Partial<Order>): Promise<Order> {
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
  if (!found) {
    updated = { id, ...updates } as Order;
    newList.push(updated);
  }
  setLocalItem(STORAGE_KEYS.ORDERS, newList);

  if (shouldSyncToFirebase() && updated) {
    withTimeout(setDoc(doc(getDb(), 'orders', id), updated, { merge: true }), 2500).catch((e) =>
      console.error('Error updating order in Firebase:', e)
    );
  }

  if (!updated) throw new Error('Order not found');
  return updated;
}

export async function updateOrderStatus(id: string, newStatus: Order['orderStatus']): Promise<Order> {
  return updateOrder(id, { orderStatus: newStatus });
}

export async function uploadOrderSignedCopy(orderId: string, file: File): Promise<Order> {
  const orders = await getOrders();
  const target = orders.find((order) => order.id === orderId);
  if (!target) throw new Error('Sales order not found.');

  if (!isLiveFirebaseConfigured || !storage) {
    if (file.size > 5 * 1024 * 1024) {
      throw new Error('Offline signed copies are limited to 5 MB. Configure Firebase Storage for larger files.');
    }
    const downloadUrl = await new Promise<string>((resolve, reject) => {
      if (typeof FileReader === 'undefined') {
        const base64Name = typeof btoa !== 'undefined' ? btoa(file.name || 'signed_copy') : 'c2lnbmVkX2NvcHk=';
        resolve(`data:application/pdf;base64,${base64Name}`);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('Could not read the signed copy for offline storage.'));
      reader.readAsDataURL(file);
    });
    return updateOrder(orderId, {
      signedCopy: {
        downloadUrl,
        storagePath: `local-orders/${orderId}/signed-copy/${Date.now()}_${file.name}`,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        uploadedAt: new Date().toISOString()
      }
    });
  }

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
  const orders = await getOrders();
  const target = orders.find((order) => order.id === orderId);
  if (!target) throw new Error('Sales order not found.');

  if (target.signedCopy?.storagePath && storage) {
    await deleteObject(ref(storage, target.signedCopy.storagePath)).catch((error) => {
      console.warn('Could not delete signed copy from Firebase Storage:', error);
    });
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
  const localItems = getLocalItem<Dispatch[]>(STORAGE_KEYS.DISPATCHES, initialDispatches);
  if (isLiveFirebaseConfigured && db) {
    try {
      const snap = await withTimeout(getDocs(collection(getDb(), 'dispatches')), 2000);
      if (snap && snap.docs.length > 0) {
        const remoteItems = snap.docs.map((d) => d.data() as Dispatch);
        const merged = mergeLocalAndRemote(localItems, remoteItems);
        setLocalItem(STORAGE_KEYS.DISPATCHES, merged);
        return merged;
      }
    } catch (e) {
      console.warn('Firebase getDispatches failed or timed out, falling back to LocalStorage:', e);
    }
  }
  return localItems;
}

export async function addDispatch(data: Omit<Dispatch, 'id' | 'dispatchNumber' | 'createdAt'>): Promise<Dispatch> {
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
    withTimeout(setDoc(doc(getDb(), 'dispatches', newDispatch.id), newDispatch), 2500).catch((e) =>
      console.error('Error adding dispatch to Firebase:', e)
    );
  }

  // If status is 'dispatched' or 'delivered', automatically update inventory stock & order status
  if (data.status === 'dispatched' || data.status === 'delivered') {
    await processDispatchStockDeduction(newDispatch);
  }

  return newDispatch;
}

export async function updateDispatchStatus(id: string, newStatus: Dispatch['status']): Promise<Dispatch> {
  const dispatches = await getDispatches();
  const dispatch = dispatches.find((d) => d.id === id);
  const updatedDispatch: Dispatch = dispatch
    ? { ...dispatch, status: newStatus }
    : {
        id,
        dispatchNumber: id,
        orderId: '',
        orderNumber: '',
        customerName: '',
        items: [],
        dispatchDate: new Date().toISOString().split('T')[0],
        status: newStatus,
        createdAt: new Date().toISOString().split('T')[0]
      };

  const list = getLocalItem<Dispatch[]>(STORAGE_KEYS.DISPATCHES, initialDispatches);
  const newList = list.map((item) => (item.id === id ? updatedDispatch : item));
  setLocalItem(STORAGE_KEYS.DISPATCHES, newList);

  if (shouldSyncToFirebase()) {
    withTimeout(setDoc(doc(getDb(), 'dispatches', id), updatedDispatch, { merge: true }), 2500).catch((e) =>
      console.error('Error updating dispatch in Firebase:', e)
    );
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
    for (const [productId, quantity] of deductedByProduct) {
      const product = products.find((candidate) => candidate.id === productId);
      if (product && product.currentStock < quantity) {
        throw new Error(`Insufficient stock for ${product.name}. Available: ${product.currentStock}, required: ${quantity}.`);
      }
    }
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
      withTimeout(setDoc(doc(getDb(), 'dispatches', dispatch.id), { stockDeducted: true }, { merge: true }), 2500).catch((e) =>
        console.error('Error updating stockDeducted flag in Firebase:', e)
      );
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
  const localItems = getLocalItem<Payment[]>(STORAGE_KEYS.PAYMENTS, initialPayments);
  if (isLiveFirebaseConfigured && db) {
    try {
      const snap = await withTimeout(getDocs(collection(getDb(), 'payments')), 2000);
      if (snap && snap.docs.length > 0) {
        const remoteItems = snap.docs.map((d) => d.data() as Payment);
        const merged = mergeLocalAndRemote(localItems, remoteItems);
        setLocalItem(STORAGE_KEYS.PAYMENTS, merged);
        return merged;
      }
    } catch (e) {
      console.warn('Firebase getPayments failed or timed out, falling back to LocalStorage:', e);
    }
  }
  return localItems;
}

export async function addPayment(data: Omit<Payment, 'id' | 'receiptNumber'>): Promise<Payment> {
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

  const receiptNumber = `REC-${Math.floor(5000 + Math.random() * 5000)}`;
  const newPayment: Payment = {
    ...data,
    id: receiptNumber,
    receiptNumber
  };

  const list = getLocalItem<Payment[]>(STORAGE_KEYS.PAYMENTS, initialPayments);
  setLocalItem(STORAGE_KEYS.PAYMENTS, [newPayment, ...list]);

  if (shouldSyncToFirebase()) {
    withTimeout(setDoc(doc(getDb(), 'payments', newPayment.id), newPayment), 2500).catch((e) =>
      console.error('Error adding payment to Firebase:', e)
    );
  }

  const newPaid = targetOrder.paidAmount + data.amount;
  const newStatus: Order['paymentStatus'] = newPaid >= targetOrder.totalAmount ? 'paid' : 'partially_paid';
  await updateOrder(targetOrder.id, {
    paidAmount: newPaid,
    paymentStatus: newStatus
  });

  return newPayment;
}

// ================= EXPENSES =================
export async function getExpenses(): Promise<Expense[]> {
  const localItems = getLocalItem<Expense[]>(STORAGE_KEYS.EXPENSES, initialExpenses);
  let items: Expense[] = localItems;

  if (isLiveFirebaseConfigured && db) {
    try {
      const snap = await withTimeout(getDocs(collection(getDb(), 'expenses')), 2000);
      if (snap && snap.docs.length > 0) {
        const remoteItems = snap.docs.map((d) => d.data() as Expense);
        items = mergeLocalAndRemote(localItems, remoteItems);
      }
    } catch (e) {
      console.warn('Firebase getExpenses failed or timed out, falling back to LocalStorage:', e);
    }
  }

  // Specifically remove accidental test records EXP-664 ("something") and EXP-743 ("hi") if present
  const testIdsToRemove = items
    .filter(
      (e) =>
        e.id === 'EXP-664' ||
        e.id === 'EXP-743' ||
        e.description?.trim().toLowerCase() === 'something' ||
        e.description?.trim().toLowerCase() === 'hi'
    )
    .map((e) => e.id);

  if (testIdsToRemove.length > 0) {
    items = items.filter((e) => !testIdsToRemove.includes(e.id));
    setLocalItem(STORAGE_KEYS.EXPENSES, items);
    if (shouldSyncToFirebase()) {
      for (const tid of testIdsToRemove) {
        withTimeout(deleteDoc(doc(getDb(), 'expenses', tid)), 2500).catch((err) =>
          console.error(`Error purging test expense ${tid} from Firebase:`, err)
        );
      }
    }
  } else {
    setLocalItem(STORAGE_KEYS.EXPENSES, items);
  }

  return items;
}

export async function addExpense(data: Omit<Expense, 'id'>): Promise<Expense> {
  const id = `EXP-${Math.floor(300 + Math.random() * 700)}`;
  const newExpense: Expense = { ...data, id };

  const list = getLocalItem<Expense[]>(STORAGE_KEYS.EXPENSES, initialExpenses);
  const updatedList = [newExpense, ...list.filter((item) => item.id !== id)];
  setLocalItem(STORAGE_KEYS.EXPENSES, updatedList);

  if (shouldSyncToFirebase()) {
    withTimeout(setDoc(doc(getDb(), 'expenses', id), newExpense), 2500).catch((e) =>
      console.error('Error adding expense to Firebase:', e)
    );
  }

  return newExpense;
}

export async function deleteExpense(id: string): Promise<void> {
  const list = getLocalItem<Expense[]>(STORAGE_KEYS.EXPENSES, initialExpenses);
  const newList = list.filter((item) => item.id !== id);
  setLocalItem(STORAGE_KEYS.EXPENSES, newList);

  if (shouldSyncToFirebase()) {
    withTimeout(deleteDoc(doc(getDb(), 'expenses', id)), 2500).catch((e) =>
      console.error('Error deleting expense in Firebase:', e)
    );
  }
}

// ================= RAW MATERIALS & USAGE =================
export async function getRawMaterials(): Promise<RawMaterial[]> {
  const localItems = getLocalItem<RawMaterial[]>(STORAGE_KEYS.RAW_MATERIALS, initialRawMaterials);
  if (isLiveFirebaseConfigured && db) {
    try {
      const snap = await withTimeout(getDocs(collection(getDb(), 'rawMaterials')), 2000);
      if (snap && snap.docs.length > 0) {
        const remoteItems = snap.docs.map((d) => d.data() as RawMaterial);
        const merged = mergeLocalAndRemote(localItems, remoteItems);
        setLocalItem(STORAGE_KEYS.RAW_MATERIALS, merged);
        return merged;
      }
    } catch (e) {
      console.warn('Firebase getRawMaterials failed or timed out, falling back to LocalStorage:', e);
    }
  }
  return localItems;
}

export async function addRawMaterial(data: Omit<RawMaterial, 'id' | 'status' | 'lastRestocked'>): Promise<RawMaterial> {
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
    withTimeout(setDoc(doc(getDb(), 'rawMaterials', id), newMaterial), 2500).catch((e) =>
      console.error('Error adding raw material to Firebase:', e)
    );
  }

  return newMaterial;
}

export async function updateRawMaterial(id: string, updates: Partial<RawMaterial>): Promise<RawMaterial> {
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
  if (!found) {
    updated = { id, ...updates } as RawMaterial;
    newList.push(updated);
  }
  setLocalItem(STORAGE_KEYS.RAW_MATERIALS, newList);

  if (shouldSyncToFirebase() && updated) {
    withTimeout(setDoc(doc(getDb(), 'rawMaterials', id), updated, { merge: true }), 2500).catch((e) =>
      console.error('Error updating raw material in Firebase:', e)
    );
  }

  if (!updated) throw new Error('Raw material not found');
  return updated;
}

export async function deleteRawMaterial(id: string): Promise<void> {
  const list = getLocalItem<RawMaterial[]>(STORAGE_KEYS.RAW_MATERIALS, initialRawMaterials);
  setLocalItem(STORAGE_KEYS.RAW_MATERIALS, list.filter((item) => item.id !== id));

  if (shouldSyncToFirebase()) {
    withTimeout(deleteDoc(doc(getDb(), 'rawMaterials', id)), 2500).catch((e) =>
      console.error('Error deleting raw material in Firebase:', e)
    );
  }
}

export async function getRawMaterialUsage(): Promise<RawMaterialUsage[]> {
  const localItems = getLocalItem<RawMaterialUsage[]>(STORAGE_KEYS.RAW_MATERIAL_USAGE, initialRawMaterialUsage);
  if (isLiveFirebaseConfigured && db) {
    try {
      const snap = await withTimeout(getDocs(collection(getDb(), 'rawMaterialUsage')), 2000);
      if (snap && snap.docs.length > 0) {
        const remoteItems = snap.docs.map((d) => d.data() as RawMaterialUsage);
        const merged = mergeLocalAndRemote(localItems, remoteItems);
        setLocalItem(STORAGE_KEYS.RAW_MATERIAL_USAGE, merged);
        return merged;
      }
    } catch (e) {
      console.warn('Firebase getRawMaterialUsage failed or timed out, falling back to LocalStorage:', e);
    }
  }
  return localItems;
}

export async function recordRawMaterialUsage(data: Omit<RawMaterialUsage, 'id'>): Promise<RawMaterialUsage> {
  const id = `RMU-${Math.floor(1000 + Math.random() * 9000)}`;
  
  // Get material to handle unit conversion
  const materials = await getRawMaterials();
  const material = materials.find((m) => m.id === data.materialId);
  
  let baseQuantity = data.quantity;
  let baseUnit = data.unit;
  let equivalentPieces: number | undefined = undefined;
  
  // Calculate total deduction for stock (consumed + wastage1 + wastage2)
  const totalDeductionInput = data.totalDeduction || data.quantity;
  let baseTotalDeduction = totalDeductionInput;
  
  if (material) {
    // Convert to base unit if conversion factor is available
    if (material.conversionFactor && material.conversionFactor > 0) {
      // If unit is purchase unit, convert to base
      if (data.unit.toLowerCase() === material.purchaseUnit.toLowerCase()) {
        baseQuantity = data.quantity * material.conversionFactor;
        baseTotalDeduction = totalDeductionInput * material.conversionFactor;
        baseUnit = material.baseUnit;
      }
      // If unit is already base or consumption unit, no conversion needed
      else if (data.unit.toLowerCase() === material.baseUnit.toLowerCase() ||
               data.unit.toLowerCase() === material.consumptionUnit.toLowerCase()) {
        baseQuantity = data.quantity;
        baseTotalDeduction = totalDeductionInput;
        baseUnit = material.baseUnit;
      }
    }
    
    // Calculate equivalent pieces if conversion exists (based on total deduction)
    if (material.piecesPerBaseUnit && material.piecesPerBaseUnit > 0) {
      equivalentPieces = baseTotalDeduction * material.piecesPerBaseUnit;
    }
  }
  
  const newUsage: RawMaterialUsage = {
    ...data,
    id,
    baseQuantity,
    baseUnit,
    equivalentPieces,
    createdAt: new Date().toISOString()
  };

  const list = getLocalItem<RawMaterialUsage[]>(STORAGE_KEYS.RAW_MATERIAL_USAGE, initialRawMaterialUsage);
  setLocalItem(STORAGE_KEYS.RAW_MATERIAL_USAGE, [newUsage, ...list]);

  if (shouldSyncToFirebase()) {
    withTimeout(setDoc(doc(getDb(), 'rawMaterialUsage', id), newUsage), 2500).catch((e) =>
      console.error('Error adding raw material usage to Firebase:', e)
    );
  }

  // Deduct stock from target raw material (always in base unit using total deduction)
  if (material) {
    const newStock = Math.max(0, material.currentStock - baseTotalDeduction);
    await updateRawMaterial(material.id, { currentStock: newStock });
  }

  return newUsage;
}

// ================= PURCHASES =================
export async function getPurchases(): Promise<PurchaseOrder[]> {
  const localItems = getLocalItem<PurchaseOrder[]>(STORAGE_KEYS.PURCHASES, initialPurchases);
  if (isLiveFirebaseConfigured && db) {
    try {
      const snap = await withTimeout(getDocs(collection(getDb(), 'purchases')), 2000);
      if (snap && snap.docs.length > 0) {
        const remoteItems = snap.docs.map((d) => d.data() as PurchaseOrder);
        const merged = mergeLocalAndRemote(localItems, remoteItems);
        setLocalItem(STORAGE_KEYS.PURCHASES, merged);
        return merged;
      }
    } catch (e) {
      console.warn('Firebase getPurchases failed or timed out, falling back to LocalStorage:', e);
    }
  }
  return localItems;
}

export async function addPurchase(
  purchaseData: Omit<PurchaseOrder, 'id' | 'purchaseNumber' | 'paidAmount' | 'paymentStatus' | 'createdAt'> & {
    id?: string;
    purchaseNumber?: string;
    paidAmount?: number;
    paymentStatus?: PurchasePaymentStatus;
  }
): Promise<PurchaseOrder> {
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
    withTimeout(setDoc(doc(getDb(), 'purchases', newPurchase.id), newPurchase), 2500).catch((e) =>
      console.error('Error adding purchase to Firebase:', e)
    );
  }

  // Idempotent stock addition: if status is 'received' or 'completed', trigger stock increment once
  if (newPurchase.status === 'received' || newPurchase.status === 'completed') {
    return await processPurchaseStockAddition(newPurchase);
  }

  return newPurchase;
}

export async function updatePurchase(id: string, updates: Partial<PurchaseOrder>): Promise<PurchaseOrder> {
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
    withTimeout(setDoc(doc(getDb(), 'purchases', id), updates, { merge: true }), 2500).catch((e) =>
      console.error('Error updating purchase in Firebase:', { purchaseId: id, error: e })
    );
  }
  return updated;
}

export async function updatePurchaseStatus(id: string, newStatus: PurchaseStatus): Promise<PurchaseOrder> {
  const purchases = await getPurchases();
  const target = purchases.find((p) => p.id === id);

  if (!target) throw new Error('Purchase order not found');

  const updated: PurchaseOrder = { ...target, status: newStatus };

  const list = getLocalItem<PurchaseOrder[]>(STORAGE_KEYS.PURCHASES, initialPurchases);
  const newList = list.map((item) => (item.id === id ? updated : item));
  setLocalItem(STORAGE_KEYS.PURCHASES, newList);

  if (shouldSyncToFirebase()) {
    withTimeout(setDoc(doc(getDb(), 'purchases', id), { status: newStatus }, { merge: true }), 2500).catch((e) =>
      console.error('Error updating purchase status in Firebase:', e)
    );
  }

  // If transition to received or completed, apply stock addition idempotently
  if (newStatus === 'received' || newStatus === 'completed') {
    return await processPurchaseStockAddition(updated);
  }

  return updated;
}

export async function recordPurchasePayment(id: string, amount: number, paymentDate = new Date().toISOString().split('T')[0], notes = ''): Promise<PurchaseOrder> {
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
    withTimeout(
      setDoc(
        doc(getDb(), 'purchases', id),
        { paidAmount: newPaidAmount, paymentStatus: newPaymentStatus, paymentRecords: updated.paymentRecords },
        { merge: true }
      ),
      2500
    ).catch((e) => console.error('Error updating purchase payment in Firebase:', e));
  }

  return updated;
}

export async function deletePurchase(id: string): Promise<void> {
  const list = getLocalItem<PurchaseOrder[]>(STORAGE_KEYS.PURCHASES, initialPurchases);
  setLocalItem(
    STORAGE_KEYS.PURCHASES,
    list.filter((item) => item.id !== id)
  );

  if (shouldSyncToFirebase()) {
    withTimeout(deleteDoc(doc(getDb(), 'purchases', id)), 2500).catch((e) =>
      console.error('Error deleting purchase in Firebase:', e)
    );
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
      // Convert purchase quantity to base unit if conversion factor is available
      let quantityToAdd = item.quantity;
      if (material.conversionFactor && material.conversionFactor > 0) {
        // If purchase unit is different from base unit, convert
        if (item.unit.toLowerCase() === material.purchaseUnit.toLowerCase() &&
            item.unit.toLowerCase() !== material.baseUnit.toLowerCase()) {
          quantityToAdd = item.quantity * material.conversionFactor;
        }
      }
      
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
        supplier: purchase.supplierName || 'Direct Supplier'
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
    withTimeout(setDoc(doc(getDb(), 'purchases', purchase.id), { stockAdded: true }, { merge: true }), 2500).catch((e) =>
      console.error('Error updating stockAdded flag in Firebase:', e)
    );
  }

  return updatedPurchase;
}

// ================= FINISHED GOODS LOG =================
export async function getFinishedGoodsLogs(): Promise<FinishedGoodsLog[]> {
  const localItems = getLocalItem<FinishedGoodsLog[]>(STORAGE_KEYS.FINISHED_GOODS_LOGS, initialFinishedGoodsLogs);
  if (isLiveFirebaseConfigured && db) {
    try {
      const snap = await withTimeout(getDocs(collection(getDb(), 'finishedGoodsLogs')), 2000);
      if (snap && snap.docs.length > 0) {
        const remoteItems = snap.docs.map((d) => d.data() as FinishedGoodsLog);
        const merged = mergeLocalAndRemote(localItems, remoteItems);
        setLocalItem(STORAGE_KEYS.FINISHED_GOODS_LOGS, merged);
        return merged;
      }
    } catch (e) {
      console.warn('Firebase getFinishedGoodsLogs failed or timed out, falling back to LocalStorage:', e);
    }
  }
  return localItems;
}

export async function addFinishedGoodsLog(data: Omit<FinishedGoodsLog, 'id'>): Promise<FinishedGoodsLog> {
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
    withTimeout(setDoc(doc(getDb(), 'finishedGoodsLogs', id), newLog), 2500).catch((e) =>
      console.error('Error adding finished goods log to Firebase:', e)
    );
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
  const localItems = getLocalItem<DocumentItem[]>(STORAGE_KEYS.DOCUMENTS, initialDocuments);
  if (isLiveFirebaseConfigured && db) {
    try {
      const snap = await withTimeout(getDocs(collection(getDb(), 'documents')), 2000);
      if (snap && snap.docs.length > 0) {
        const remoteItems = snap.docs.map((d) => d.data() as DocumentItem);
        const merged = mergeLocalAndRemote(localItems, remoteItems);
        setLocalItem(STORAGE_KEYS.DOCUMENTS, merged);
        return merged;
      }
    } catch (e) {
      console.warn('Firebase getDocuments failed or timed out, falling back to LocalStorage:', e);
    }
  }
  return localItems;
}

export async function uploadDocument(file: File, category: DocumentItem['category']): Promise<DocumentItem> {
  const id = `DOC-${Math.floor(100 + Math.random() * 900)}`;
  let downloadUrl = '#';
  let storagePath = '';

  if (isLiveFirebaseConfigured && storage) {
    try {
      storagePath = `documents/${Date.now()}_${file.name}`;
      const fileRef = ref(storage, storagePath);
      await withTimeout(uploadBytes(fileRef, file), 3000);
      downloadUrl = await withTimeout(getDownloadURL(fileRef), 2000);
    } catch (e) {
      console.error('Error uploading file to Firebase Storage:', e);
      downloadUrl = URL.createObjectURL(file);
    }
  } else {
    downloadUrl = URL.createObjectURL(file);
  }

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
    withTimeout(setDoc(doc(getDb(), 'documents', id), newDoc), 2500).catch((e) =>
      console.error('Error adding document doc to Firebase:', e)
    );
  }

  return newDoc;
}

export async function deleteDocument(id: string, storagePath?: string): Promise<void> {
  if (isLiveFirebaseConfigured && storage && storagePath) {
    try {
      const fileRef = ref(storage, storagePath);
      await withTimeout(deleteObject(fileRef), 2500);
    } catch (e) {
      console.warn('Could not delete file from Firebase Storage:', e);
    }
  }

  if (shouldSyncToFirebase()) {
    withTimeout(deleteDoc(doc(getDb(), 'documents', id)), 2500).catch((e) =>
      console.error('Error deleting document from Firebase:', e)
    );
  }

  const list = getLocalItem<DocumentItem[]>(STORAGE_KEYS.DOCUMENTS, initialDocuments);
  setLocalItem(STORAGE_KEYS.DOCUMENTS, list.filter((d) => d.id !== id));
}

// ================= SETTINGS =================
export async function getSettings(): Promise<Settings> {
  if (isLiveFirebaseConfigured && db) {
    try {
      const snap = await withTimeout(getDoc(doc(getDb(), 'settings', 'company_settings')), 2000);
      if (snap && snap.exists()) return snap.data() as Settings;
    } catch (e) {
      console.warn('Firebase getSettings failed or timed out, falling back to LocalStorage:', e);
    }
  }
  return getLocalItem<Settings>(STORAGE_KEYS.SETTINGS, initialSettings);
}

export async function updateSettings(updates: Partial<Settings>): Promise<Settings> {
  const current = getLocalItem<Settings>(STORAGE_KEYS.SETTINGS, initialSettings);
  const newSettings = { ...current, ...updates };
  setLocalItem(STORAGE_KEYS.SETTINGS, newSettings);

  if (shouldSyncToFirebase()) {
    withTimeout(setDoc(doc(getDb(), 'settings', 'company_settings'), newSettings), 2500).catch((e) =>
      console.error('Error updating settings in Firebase:', e)
    );
  }
  return newSettings;
}

// ================= DASHBOARD & ANALYTICS METRICS =================
export async function getDashboardMetrics(): Promise<DashboardMetrics> {
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
