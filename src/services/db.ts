import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage, isLiveFirebaseConfigured } from '../firebase/config';
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
  DashboardMetrics
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
  initialSettings
} from '../data/seedData';

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
  INITIALIZED: 'angel_pet_seed_initialized_v1'
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

// Ensure database is seeded with initial data on first load
export async function seedDatabase(force = false): Promise<void> {
  const isAlreadyInitialized = localStorage.getItem(STORAGE_KEYS.INITIALIZED);

  if (isLiveFirebaseConfigured && db) {
    try {
      const customersSnap = await withTimeout(getDocs(collection(db, 'customers')), 2000);
      const isFirestoreEmpty = customersSnap.empty;

      if (isFirestoreEmpty || force) {
        console.info('Seeding Firestore with initial dataset...');
        // Seed Customers
        for (const item of initialCustomers) {
          await withTimeout(setDoc(doc(db, 'customers', item.id), item), 1500).catch(() => {});
        }
        // Seed Products
        for (const item of initialProducts) {
          await withTimeout(setDoc(doc(db, 'products', item.id), item), 1500).catch(() => {});
        }
        // Seed Orders
        for (const item of initialOrders) {
          await withTimeout(setDoc(doc(db, 'orders', item.id), item), 1500).catch(() => {});
        }
        // Seed Dispatches
        for (const item of initialDispatches) {
          await withTimeout(setDoc(doc(db, 'dispatches', item.id), item), 1500).catch(() => {});
        }
        // Seed Payments
        for (const item of initialPayments) {
          await withTimeout(setDoc(doc(db, 'payments', item.id), item), 1500).catch(() => {});
        }
        // Seed Expenses
        for (const item of initialExpenses) {
          await withTimeout(setDoc(doc(db, 'expenses', item.id), item), 1500).catch(() => {});
        }
        // Seed Raw Materials
        for (const item of initialRawMaterials) {
          await withTimeout(setDoc(doc(db, 'rawMaterials', item.id), item), 1500).catch(() => {});
        }
        // Seed Raw Material Usage
        for (const item of initialRawMaterialUsage) {
          await withTimeout(setDoc(doc(db, 'rawMaterialUsage', item.id), item), 1500).catch(() => {});
        }
        // Seed Finished Goods Logs
        for (const item of initialFinishedGoodsLogs) {
          await withTimeout(setDoc(doc(db, 'finishedGoodsLogs', item.id), item), 1500).catch(() => {});
        }
        // Seed Documents
        for (const item of initialDocuments) {
          await withTimeout(setDoc(doc(db, 'documents', item.id), item), 1500).catch(() => {});
        }
        // Seed Settings
        await withTimeout(setDoc(doc(db, 'settings', 'company_settings'), initialSettings), 1500).catch(() => {});
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
    localStorage.setItem(STORAGE_KEYS.INITIALIZED, 'true');
  }
}

// Run seed check immediately
seedDatabase().catch((err) => console.error('Seed check error:', err));

// ================= CUSTOMERS =================
export async function getCustomers(): Promise<Customer[]> {
  if (isLiveFirebaseConfigured && db) {
    try {
      const snap = await withTimeout(getDocs(collection(db, 'customers')), 2000);
      if (snap && snap.docs.length > 0) {
        const items = snap.docs.map((d) => d.data() as Customer);
        setLocalItem(STORAGE_KEYS.CUSTOMERS, items);
        return items;
      }
    } catch (e) {
      console.warn('Firebase getCustomers failed or timed out, falling back to LocalStorage:', e);
    }
  }
  return getLocalItem<Customer[]>(STORAGE_KEYS.CUSTOMERS, initialCustomers);
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
  if (isLiveFirebaseConfigured && db) {
    withTimeout(setDoc(doc(db, 'customers', newCustomer.id), newCustomer), 2500).catch((e) =>
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

  if (isLiveFirebaseConfigured && db) {
    withTimeout(setDoc(doc(db, 'customers', id), updates, { merge: true }), 2500).catch((e) =>
      console.error('Error updating customer in Firebase:', e)
    );
  }

  return updated!;
}

export async function deleteCustomer(id: string): Promise<void> {
  const list = getLocalItem<Customer[]>(STORAGE_KEYS.CUSTOMERS, initialCustomers);
  setLocalItem(STORAGE_KEYS.CUSTOMERS, list.filter((item) => item.id !== id));

  if (isLiveFirebaseConfigured && db) {
    withTimeout(deleteDoc(doc(db, 'customers', id)), 2500).catch((e) =>
      console.error('Error deleting customer in Firebase:', e)
    );
  }
}

// ================= PRODUCTS =================
export async function getProducts(): Promise<Product[]> {
  if (isLiveFirebaseConfigured && db) {
    try {
      const snap = await withTimeout(getDocs(collection(db, 'products')), 2000);
      if (snap && snap.docs.length > 0) {
        const items = snap.docs.map((d) => d.data() as Product);
        setLocalItem(STORAGE_KEYS.PRODUCTS, items);
        return items;
      }
    } catch (e) {
      console.warn('Firebase getProducts failed or timed out, falling back to LocalStorage:', e);
    }
  }
  return getLocalItem<Product[]>(STORAGE_KEYS.PRODUCTS, initialProducts);
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

  if (isLiveFirebaseConfigured && db) {
    withTimeout(setDoc(doc(db, 'products', newProduct.id), newProduct), 2500).catch((e) =>
      console.error('Error adding product to Firebase:', e)
    );
  }

  return newProduct;
}

export async function updateProduct(id: string, updates: Partial<Product>): Promise<Product> {
  let updated: Product | null = null;
  const list = getLocalItem<Product[]>(STORAGE_KEYS.PRODUCTS, initialProducts);
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
    updated = { id, ...updates } as Product;
    newList.push(updated);
  }
  setLocalItem(STORAGE_KEYS.PRODUCTS, newList);

  if (isLiveFirebaseConfigured && db) {
    withTimeout(setDoc(doc(db, 'products', id), updates, { merge: true }), 2500).catch((e) =>
      console.error('Error updating product in Firebase:', e)
    );
  }

  if (!updated) throw new Error('Product not found');
  return updated;
}

export async function deleteProduct(id: string): Promise<void> {
  const list = getLocalItem<Product[]>(STORAGE_KEYS.PRODUCTS, initialProducts);
  setLocalItem(STORAGE_KEYS.PRODUCTS, list.filter((item) => item.id !== id));

  if (isLiveFirebaseConfigured && db) {
    withTimeout(deleteDoc(doc(db, 'products', id)), 2500).catch((e) =>
      console.error('Error deleting product in Firebase:', e)
    );
  }
}

// ================= ORDERS =================
export async function getOrders(): Promise<Order[]> {
  if (isLiveFirebaseConfigured && db) {
    try {
      const snap = await withTimeout(getDocs(collection(db, 'orders')), 2000);
      if (snap && snap.docs.length > 0) {
        const items = snap.docs.map((d) => d.data() as Order);
        setLocalItem(STORAGE_KEYS.ORDERS, items);
        return items;
      }
    } catch (e) {
      console.warn('Firebase getOrders failed or timed out, falling back to LocalStorage:', e);
    }
  }
  return getLocalItem<Order[]>(STORAGE_KEYS.ORDERS, initialOrders);
}

export async function addOrder(orderData: Omit<Order, 'id' | 'orderNumber' | 'paidAmount' | 'paymentStatus' | 'orderStatus' | 'orderDate'>): Promise<Order> {
  const randomNum = Math.floor(10000 + Math.random() * 90000);
  const orderNumber = `ORD-${randomNum}`;
  const newOrder: Order = {
    ...orderData,
    id: orderNumber,
    orderNumber,
    orderStatus: 'pending',
    paymentStatus: 'pending',
    paidAmount: 0,
    orderDate: new Date().toISOString().split('T')[0]
  };

  const list = getLocalItem<Order[]>(STORAGE_KEYS.ORDERS, initialOrders);
  setLocalItem(STORAGE_KEYS.ORDERS, [newOrder, ...list]);

  if (isLiveFirebaseConfigured && db) {
    withTimeout(setDoc(doc(db, 'orders', newOrder.id), newOrder), 2500).catch((e) =>
      console.error('Error adding order to Firebase:', e)
    );
  }

  // Update Customer's total orders & total spent
  const customers = await getCustomers();
  const targetCustomer = customers.find((c) => c.id === newOrder.customerId);
  if (targetCustomer) {
    const updatedTotalOrders = (targetCustomer.totalOrders || 0) + 1;
    const updatedTotalSpent = (targetCustomer.totalSpent || 0) + newOrder.totalAmount;
    await updateCustomer(targetCustomer.id, {
      totalOrders: updatedTotalOrders,
      totalSpent: updatedTotalSpent
    });
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

  if (isLiveFirebaseConfigured && db) {
    withTimeout(setDoc(doc(db, 'orders', id), updates, { merge: true }), 2500).catch((e) =>
      console.error('Error updating order in Firebase:', e)
    );
  }

  if (!updated) throw new Error('Order not found');
  return updated;
}

export async function updateOrderStatus(id: string, newStatus: Order['orderStatus']): Promise<Order> {
  return updateOrder(id, { orderStatus: newStatus });
}

// ================= DISPATCHES =================
export async function getDispatches(): Promise<Dispatch[]> {
  if (isLiveFirebaseConfigured && db) {
    try {
      const snap = await withTimeout(getDocs(collection(db, 'dispatches')), 2000);
      if (snap && snap.docs.length > 0) {
        const items = snap.docs.map((d) => d.data() as Dispatch);
        setLocalItem(STORAGE_KEYS.DISPATCHES, items);
        return items;
      }
    } catch (e) {
      console.warn('Firebase getDispatches failed or timed out, falling back to LocalStorage:', e);
    }
  }
  return getLocalItem<Dispatch[]>(STORAGE_KEYS.DISPATCHES, initialDispatches);
}

export async function addDispatch(data: Omit<Dispatch, 'id' | 'dispatchNumber' | 'createdAt'>): Promise<Dispatch> {
  const dispatchNumber = `DSP-${Math.floor(8000 + Math.random() * 2000)}`;
  const newDispatch: Dispatch = {
    ...data,
    id: dispatchNumber,
    dispatchNumber,
    createdAt: new Date().toISOString().split('T')[0]
  };

  const list = getLocalItem<Dispatch[]>(STORAGE_KEYS.DISPATCHES, initialDispatches);
  setLocalItem(STORAGE_KEYS.DISPATCHES, [newDispatch, ...list]);

  if (isLiveFirebaseConfigured && db) {
    withTimeout(setDoc(doc(db, 'dispatches', newDispatch.id), newDispatch), 2500).catch((e) =>
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

  if (isLiveFirebaseConfigured && db) {
    withTimeout(setDoc(doc(db, 'dispatches', id), { status: newStatus }, { merge: true }), 2500).catch((e) =>
      console.error('Error updating dispatch in Firebase:', e)
    );
  }

  if (newStatus === 'dispatched' || newStatus === 'delivered') {
    await processDispatchStockDeduction(updatedDispatch);
  }

  return updatedDispatch;
}

async function processDispatchStockDeduction(dispatch: Dispatch): Promise<void> {
  if (dispatch.stockDeducted) {
    // Stock was already deducted for this dispatch; only sync order status
    const orders = await getOrders();
    const targetOrder = orders.find((o) => o.id === dispatch.orderId || o.orderNumber === dispatch.orderNumber);
    if (targetOrder) {
      const newOrderStatus = dispatch.status === 'delivered' ? 'completed' : 'dispatched';
      await updateOrderStatus(targetOrder.id, newOrderStatus);
    }
    return;
  }

  const products = await getProducts();
  for (const item of dispatch.items) {
    const product = products.find((p) => p.id === item.productId);
    if (product) {
      const newStock = Math.max(0, product.currentStock - item.quantity);
      await updateProduct(product.id, { currentStock: newStock });
    }
  }

  const orders = await getOrders();
  const targetOrder = orders.find((o) => o.id === dispatch.orderId || o.orderNumber === dispatch.orderNumber);
  if (targetOrder) {
    const newOrderStatus = dispatch.status === 'delivered' ? 'completed' : 'dispatched';
    await updateOrderStatus(targetOrder.id, newOrderStatus);
  }

  // Mark stock as deducted to avoid duplicate deductions
  const list = getLocalItem<Dispatch[]>(STORAGE_KEYS.DISPATCHES, initialDispatches);
  const newList = list.map((item) => (item.id === dispatch.id ? { ...item, stockDeducted: true } : item));
  setLocalItem(STORAGE_KEYS.DISPATCHES, newList);

  if (isLiveFirebaseConfigured && db) {
    withTimeout(setDoc(doc(db, 'dispatches', dispatch.id), { stockDeducted: true }, { merge: true }), 2500).catch((e) =>
      console.error('Error updating stockDeducted flag in Firebase:', e)
    );
  }
}

// ================= PAYMENTS =================
export async function getPayments(): Promise<Payment[]> {
  if (isLiveFirebaseConfigured && db) {
    try {
      const snap = await withTimeout(getDocs(collection(db, 'payments')), 2000);
      if (snap && snap.docs.length > 0) {
        const items = snap.docs.map((d) => d.data() as Payment);
        setLocalItem(STORAGE_KEYS.PAYMENTS, items);
        return items;
      }
    } catch (e) {
      console.warn('Firebase getPayments failed or timed out, falling back to LocalStorage:', e);
    }
  }
  return getLocalItem<Payment[]>(STORAGE_KEYS.PAYMENTS, initialPayments);
}

export async function addPayment(data: Omit<Payment, 'id' | 'receiptNumber'>): Promise<Payment> {
  const receiptNumber = `REC-${Math.floor(5000 + Math.random() * 5000)}`;
  const newPayment: Payment = {
    ...data,
    id: receiptNumber,
    receiptNumber
  };

  const list = getLocalItem<Payment[]>(STORAGE_KEYS.PAYMENTS, initialPayments);
  setLocalItem(STORAGE_KEYS.PAYMENTS, [newPayment, ...list]);

  if (isLiveFirebaseConfigured && db) {
    withTimeout(setDoc(doc(db, 'payments', newPayment.id), newPayment), 2500).catch((e) =>
      console.error('Error adding payment to Firebase:', e)
    );
  }

  // Update target Order's paidAmount & paymentStatus
  const orders = await getOrders();
  const targetOrder = orders.find((o) => o.id === data.orderId || o.orderNumber === data.orderNumber);
  if (targetOrder) {
    const newPaid = targetOrder.paidAmount + data.amount;
    const newStatus: Order['paymentStatus'] = newPaid >= targetOrder.totalAmount ? 'paid' : 'partially_paid';
    await updateOrder(targetOrder.id, {
      paidAmount: newPaid,
      paymentStatus: newStatus
    });
  }

  return newPayment;
}

// ================= EXPENSES =================
export async function getExpenses(): Promise<Expense[]> {
  if (isLiveFirebaseConfigured && db) {
    try {
      const snap = await withTimeout(getDocs(collection(db, 'expenses')), 2000);
      if (snap && snap.docs.length > 0) {
        const items = snap.docs.map((d) => d.data() as Expense);
        setLocalItem(STORAGE_KEYS.EXPENSES, items);
        return items;
      }
    } catch (e) {
      console.warn('Firebase getExpenses failed or timed out, falling back to LocalStorage:', e);
    }
  }
  return getLocalItem<Expense[]>(STORAGE_KEYS.EXPENSES, initialExpenses);
}

export async function addExpense(data: Omit<Expense, 'id'>): Promise<Expense> {
  const id = `EXP-${Math.floor(300 + Math.random() * 700)}`;
  const newExpense: Expense = { ...data, id };

  const list = getLocalItem<Expense[]>(STORAGE_KEYS.EXPENSES, initialExpenses);
  setLocalItem(STORAGE_KEYS.EXPENSES, [newExpense, ...list]);

  if (isLiveFirebaseConfigured && db) {
    withTimeout(setDoc(doc(db, 'expenses', id), newExpense), 2500).catch((e) =>
      console.error('Error adding expense to Firebase:', e)
    );
  }

  return newExpense;
}

// ================= RAW MATERIALS & USAGE =================
export async function getRawMaterials(): Promise<RawMaterial[]> {
  if (isLiveFirebaseConfigured && db) {
    try {
      const snap = await withTimeout(getDocs(collection(db, 'rawMaterials')), 2000);
      if (snap && snap.docs.length > 0) {
        const items = snap.docs.map((d) => d.data() as RawMaterial);
        setLocalItem(STORAGE_KEYS.RAW_MATERIALS, items);
        return items;
      }
    } catch (e) {
      console.warn('Firebase getRawMaterials failed or timed out, falling back to LocalStorage:', e);
    }
  }
  return getLocalItem<RawMaterial[]>(STORAGE_KEYS.RAW_MATERIALS, initialRawMaterials);
}

export async function addRawMaterial(data: Omit<RawMaterial, 'id' | 'status' | 'lastRestocked'>): Promise<RawMaterial> {
  const id = `RM-${Math.floor(100 + Math.random() * 900)}`;
  const status = data.currentStock <= data.minimumStock ? 'low_stock' : 'healthy';
  const newMaterial: RawMaterial = {
    ...data,
    id,
    status,
    lastRestocked: new Date().toISOString().split('T')[0]
  };

  const list = getLocalItem<RawMaterial[]>(STORAGE_KEYS.RAW_MATERIALS, initialRawMaterials);
  setLocalItem(STORAGE_KEYS.RAW_MATERIALS, [newMaterial, ...list]);

  if (isLiveFirebaseConfigured && db) {
    withTimeout(setDoc(doc(db, 'rawMaterials', id), newMaterial), 2500).catch((e) =>
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

  if (isLiveFirebaseConfigured && db) {
    withTimeout(setDoc(doc(db, 'rawMaterials', id), updates, { merge: true }), 2500).catch((e) =>
      console.error('Error updating raw material in Firebase:', e)
    );
  }

  if (!updated) throw new Error('Raw material not found');
  return updated;
}

export async function deleteRawMaterial(id: string): Promise<void> {
  const list = getLocalItem<RawMaterial[]>(STORAGE_KEYS.RAW_MATERIALS, initialRawMaterials);
  setLocalItem(STORAGE_KEYS.RAW_MATERIALS, list.filter((item) => item.id !== id));

  if (isLiveFirebaseConfigured && db) {
    withTimeout(deleteDoc(doc(db, 'rawMaterials', id)), 2500).catch((e) =>
      console.error('Error deleting raw material in Firebase:', e)
    );
  }
}

export async function getRawMaterialUsage(): Promise<RawMaterialUsage[]> {
  if (isLiveFirebaseConfigured && db) {
    try {
      const snap = await withTimeout(getDocs(collection(db, 'rawMaterialUsage')), 2000);
      if (snap && snap.docs.length > 0) {
        const items = snap.docs.map((d) => d.data() as RawMaterialUsage);
        setLocalItem(STORAGE_KEYS.RAW_MATERIAL_USAGE, items);
        return items;
      }
    } catch (e) {
      console.warn('Firebase getRawMaterialUsage failed or timed out, falling back to LocalStorage:', e);
    }
  }
  return getLocalItem<RawMaterialUsage[]>(STORAGE_KEYS.RAW_MATERIAL_USAGE, initialRawMaterialUsage);
}

export async function recordRawMaterialUsage(data: Omit<RawMaterialUsage, 'id'>): Promise<RawMaterialUsage> {
  const id = `RMU-${Math.floor(1000 + Math.random() * 9000)}`;
  const newUsage: RawMaterialUsage = { ...data, id };

  const list = getLocalItem<RawMaterialUsage[]>(STORAGE_KEYS.RAW_MATERIAL_USAGE, initialRawMaterialUsage);
  setLocalItem(STORAGE_KEYS.RAW_MATERIAL_USAGE, [newUsage, ...list]);

  if (isLiveFirebaseConfigured && db) {
    withTimeout(setDoc(doc(db, 'rawMaterialUsage', id), newUsage), 2500).catch((e) =>
      console.error('Error adding raw material usage to Firebase:', e)
    );
  }

  // Deduct stock from target raw material
  const materials = await getRawMaterials();
  const material = materials.find((m) => m.id === data.materialId);
  if (material) {
    const newStock = Math.max(0, material.currentStock - data.quantity);
    await updateRawMaterial(material.id, { currentStock: newStock });
  }

  return newUsage;
}

// ================= FINISHED GOODS LOG =================
export async function getFinishedGoodsLogs(): Promise<FinishedGoodsLog[]> {
  if (isLiveFirebaseConfigured && db) {
    try {
      const snap = await withTimeout(getDocs(collection(db, 'finishedGoodsLogs')), 2000);
      if (snap && snap.docs.length > 0) {
        const items = snap.docs.map((d) => d.data() as FinishedGoodsLog);
        setLocalItem(STORAGE_KEYS.FINISHED_GOODS_LOGS, items);
        return items;
      }
    } catch (e) {
      console.warn('Firebase getFinishedGoodsLogs failed or timed out, falling back to LocalStorage:', e);
    }
  }
  return getLocalItem<FinishedGoodsLog[]>(STORAGE_KEYS.FINISHED_GOODS_LOGS, initialFinishedGoodsLogs);
}

export async function addFinishedGoodsLog(data: Omit<FinishedGoodsLog, 'id'>): Promise<FinishedGoodsLog> {
  const id = `FGL-${Math.floor(9000 + Math.random() * 1000)}`;
  const newLog: FinishedGoodsLog = { ...data, id };

  const list = getLocalItem<FinishedGoodsLog[]>(STORAGE_KEYS.FINISHED_GOODS_LOGS, initialFinishedGoodsLogs);
  setLocalItem(STORAGE_KEYS.FINISHED_GOODS_LOGS, [newLog, ...list]);

  if (isLiveFirebaseConfigured && db) {
    withTimeout(setDoc(doc(db, 'finishedGoodsLogs', id), newLog), 2500).catch((e) =>
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
  if (isLiveFirebaseConfigured && db) {
    try {
      const snap = await withTimeout(getDocs(collection(db, 'documents')), 2000);
      if (snap && snap.docs.length > 0) {
        const items = snap.docs.map((d) => d.data() as DocumentItem);
        setLocalItem(STORAGE_KEYS.DOCUMENTS, items);
        return items;
      }
    } catch (e) {
      console.warn('Firebase getDocuments failed or timed out, falling back to LocalStorage:', e);
    }
  }
  return getLocalItem<DocumentItem[]>(STORAGE_KEYS.DOCUMENTS, initialDocuments);
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

  if (isLiveFirebaseConfigured && db) {
    withTimeout(setDoc(doc(db, 'documents', id), newDoc), 2500).catch((e) =>
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

  if (isLiveFirebaseConfigured && db) {
    withTimeout(deleteDoc(doc(db, 'documents', id)), 2500).catch((e) =>
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
      const snap = await withTimeout(getDoc(doc(db, 'settings', 'company_settings')), 2000);
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

  if (isLiveFirebaseConfigured && db) {
    withTimeout(setDoc(doc(db, 'settings', 'company_settings'), newSettings), 2500).catch((e) =>
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

  const totalSales = orders.reduce((sum, o) => sum + o.totalAmount, 0);
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
