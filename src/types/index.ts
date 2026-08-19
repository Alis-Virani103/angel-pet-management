export type PriceCategory = 'A' | 'B' | 'C';
export type CustomerType = 'Distributor' | 'Manufacturer' | 'Wholesaler' | 'Retailer' | 'Direct Customer';
export type CustomerStatus = 'active' | 'inactive';

export interface Customer {
  id: string;
  name: string;
  phone: string;
  company: string;
  address: string;
  customerType: CustomerType;
  priceCategory: PriceCategory;
  status: CustomerStatus;
  createdAt: string;
  totalOrders: number;
  totalSpent: number;
}

export type ProductType = 'bottle' | 'cap';
export type ProductStatus = 'active' | 'inactive';

export interface Product {
  id: string;
  name: string;
  sku: string;
  type: ProductType;
  sizeOrType: string;
  description?: string;
  priceA: number;
  priceB: number;
  priceC: number;
  currentStock: number;
  minimumStock: number;
  unit: string; // 'pcs', 'units', etc.
  status: ProductStatus;
  createdAt: string;
}

export type OrderStatus = 'pending' | 'confirmed' | 'dispatched' | 'completed' | 'cancelled';
export type PaymentStatus = 'pending' | 'partially_paid' | 'paid';

export interface OrderItem {
  productId: string;
  productName: string;
  productType: ProductType;
  priceCategory: PriceCategory;
  unitPrice: number;
  quantity: number;
  subtotal: number;
}

export interface Order {
  id: string;
  orderNumber: string; // e.g. ORD-10492
  customerId: string;
  customerName: string;
  companyName: string;
  items: OrderItem[];
  subtotal: number;
  gstAmount: number;
  gstRate: number; // e.g. 18
  totalAmount: number;
  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus;
  paidAmount: number;
  orderDate: string;
  notes?: string;
}

export type DispatchStatus = 'pending' | 'ready' | 'dispatched' | 'delivered';

export interface DispatchItem {
  productId: string;
  productName: string;
  quantity: number;
}

export interface Dispatch {
  id: string;
  dispatchNumber: string; // e.g. DSP-8821
  orderId: string;
  orderNumber: string;
  customerName: string;
  items: DispatchItem[];
  dispatchDate: string;
  vehicleNumber?: string;
  driverName?: string;
  driverPhone?: string;
  status: DispatchStatus;
  stockDeducted?: boolean;
  notes?: string;
  createdAt: string;
}

export type PaymentMethod = 'bank_transfer' | 'upi' | 'cheque' | 'cash';

export interface Payment {
  id: string;
  receiptNumber: string; // e.g. REC-5021
  orderId: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  amount: number;
  paymentMethod: PaymentMethod;
  paymentDate: string;
  notes?: string;
}

export interface Expense {
  id: string;
  category: 'raw_materials' | 'utilities' | 'salaries' | 'logistics' | 'maintenance' | 'office' | 'miscellaneous';
  amount: number;
  description: string;
  expenseDate: string;
  status: 'paid' | 'pending';
  paymentMethod: PaymentMethod;
}

export type RawMaterialCategory = 'granules' | 'masterbatch' | 'colour' | 'packaging';

export interface RawMaterial {
  id: string;
  name: string;
  code: string;
  category: RawMaterialCategory;
  currentStock: number;
  minimumStock: number;
  unit: string; // 'kg', 'bags', 'boxes'
  unitCost: number;
  supplier: string;
  status: 'healthy' | 'low_stock';
  lastRestocked: string;
}

export interface RawMaterialUsage {
  id: string;
  materialId: string;
  materialName: string;
  quantity: number;
  unit: string;
  date: string;
  productionBatch?: string;
  notes?: string;
}

export interface FinishedGoodsLog {
  id: string;
  productId: string;
  productName: string;
  type: ProductType;
  quantityProduced: number;
  unit: string;
  date: string;
  notes?: string;
}

export type DocumentCategory = 'gst' | 'invoice' | 'bill' | 'kyc' | 'contract' | 'general';

export interface DocumentItem {
  id: string;
  name: string;
  category: DocumentCategory;
  fileType: string;
  fileSize: number;
  downloadUrl: string;
  storagePath?: string;
  uploadDate: string;
}

export interface Settings {
  companyName: string;
  gstin: string;
  phone: string;
  email: string;
  address: string;
  logoUrl?: string;
  invoicePrefix: string;
  gstRate: number;
  defaultPriceCategory: PriceCategory;
  enableNotifications: boolean;
}

export interface DashboardMetrics {
  totalSales: number;
  totalOrders: number;
  pendingOrders: number;
  finishedGoodsCount: number;
  lowStockCount: number;
  outstandingPayments: number;
}
