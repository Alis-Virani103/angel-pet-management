export type PriceCategory = 'A' | 'B' | 'C' | 'D';
export type CustomerType = 'Distributor' | 'Manufacturer' | 'Wholesaler' | 'Retailer' | 'Direct Customer';
export type CustomerStatus = 'active' | 'inactive';

export type PaymentReminderFrequency = 'one_time' | 'weekly' | 'monthly';

export interface CustomerPaymentReminder {
  dueDate: string;
  frequency: PaymentReminderFrequency;
  status: 'active' | 'completed';
  dayOfMonth?: number;
  lastCompletedAt?: string;
}

export interface Customer {
  id: string;
  name: string;
  phone?: string;
  company?: string;
  address: string;
  customerType: CustomerType;
  priceCategory: PriceCategory;
  status: CustomerStatus;
  createdAt: string;
  totalOrders: number;
  totalSpent: number;
  gstin?: string;
  paymentReminder?: CustomerPaymentReminder;
}

export const AUTHORITY_MODULES = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'salesOrders', label: 'Sales & Orders' },
  { key: 'purchases', label: 'Purchases' },
  { key: 'purchasedMaterials', label: 'Purchased Materials' },
  { key: 'customers', label: 'Customers' },
  { key: 'suppliers', label: 'Suppliers' },
  { key: 'analytics', label: 'Analytics' },
  { key: 'productDirectory', label: 'Product Directory' },
  { key: 'finishedGoods', label: 'Finished Goods' },
  { key: 'rawMaterials', label: 'Raw Materials' },
  { key: 'finance', label: 'Finance' },
  { key: 'dispatch', label: 'Dispatch' },
  { key: 'documents', label: 'Documents' }
] as const;

export type AuthorityModule = typeof AUTHORITY_MODULES[number]['key'];
export type PermissionAction = 'view' | 'create' | 'edit' | 'delete' | 'approve';
export type ModulePermissions = Record<AuthorityModule, PermissionAction[]>;

export interface EmployeeProfile {
  uid: string;
  email: string;
  displayName: string;
  active: boolean;
  permissions: ModulePermissions;
  createdAt: string;
  updatedAt: string;
}

export type SupplierStatus = 'active' | 'inactive';

export interface Supplier {
  id: string;
  name: string;
  company?: string;
  phone?: string;
  address: string;
  status: SupplierStatus;
  createdAt: string;
  totalPurchases: number;
  totalPaid: number;
  totalOutstanding: number;
}

export type ProductType = 'bottle' | 'cap' | 'inner' | string;
export type ProductStatus = 'active' | 'inactive';

export type PackagingMode = 'bottle_only' | 'bottle_cap' | 'bottle_inner_cap';

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
  priceD?: number;
  currentStock: number;
  minimumStock: number;
  unit: string; // 'pcs', 'units', etc.
  unitsPerPacket?: number; // optional; positive whole units in one packet/box
  allowFractionalPackets?: boolean; // optional; whether decimal packets (e.g. 2.5 pkts) make business sense; if false, packets must be whole
  status: ProductStatus;
  createdAt: string;
  imageUrl?: string;
  cloudinaryPublicId?: string;
  category?: string;
  material?: string;
  gsm?: string | number;
  printing?: string;
  dimensions?: string;
  // Packaging compatibility & combo pricing fields (Bottle products)
  compatibleCapId?: string; // ID of the default compatible cap for bottles
  compatibleInnerId?: string; // ID of the default compatible inner for bottles
  comboPriceA?: number; // Final per-bottle combo price for Category A (Bottle + Inner + Cap)
  comboPriceB?: number; // Final per-bottle combo price for Category B (Bottle + Inner + Cap)
  comboPriceC?: number; // Final per-bottle combo price for Category C (Bottle + Inner + Cap)
  comboPriceD?: number; // Final per-bottle combo price for Category D
  // Physical Weight configuration
  weightPerPiece?: number; // Weight per individual piece/unit (e.g. 10)
  weightUnit?: 'g' | 'kg'; // 'g' (grams) or 'kg' (kilograms), defaults to 'g'
}

export type OrderStatus = 'pending' | 'confirmed' | 'dispatched' | 'completed' | 'cancelled';
export type PaymentStatus = 'pending' | 'partially_paid' | 'paid';

export interface OrderItem {
  id?: string;
  productId: string;
  productName: string;
  productType: ProductType;
  priceCategory: PriceCategory;
  unitPrice: number;
  quantity: number; // always total individual units (can be decimal)
  subtotal: number;
  soldByPacket?: boolean;
  packetCount?: number; // can be decimal for fractional packets
  loosePieces?: number;
  unitsPerPacket?: number;
  // Packaging & combo fields
  selectedInnerId?: string; // ID of the selected inner product
  selectedInnerName?: string; // Name of the selected inner product
  selectedCapId?: string; // ID of the selected cap product
  selectedCapName?: string; // Name of the selected cap product
  isCombo?: boolean; // True if inner and/or cap is selected with bottle
  comboRate?: number; // Unit combo rate
  packagingMode?: PackagingMode; // 'bottle_only' | 'bottle_cap' | 'bottle_inner_cap'
  // Weight fields
  weightPerPiece?: number; // Weight per piece of the main product
  weightUnit?: 'g' | 'kg';
  totalWeightGrams?: number; // Total weight in grams (including combo parts if any)
  totalWeightDisplay?: string; // e.g. "20 kg", "500 g"
  // Backward compatibility fields for legacy orders
  isAutoGenerated?: boolean; // True for auto-generated cap/inner items
  linkedToItemId?: string; // ID of the main bottle item this belongs to
  mainItemId?: string; // ID of the main bottle item (for linked items)
}

export interface SignedOrderCopy {
  downloadUrl: string;
  storagePath: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  uploadedAt: string;
}

export type OrderType = 'REGULAR' | 'AS';

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
  totalQuantity?: number;
  totalWeightGrams?: number;
  totalWeightDisplay?: string; // e.g. "30 kg", "750 g"
  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus;
  paidAmount: number;
  orderDate: string;
  dueDate?: string;
  paymentTerms?: string;
  signedCopy?: SignedOrderCopy;
  notes?: string;
  gstApplied?: boolean;
  billType?: 'kachha' | 'pakka';
  paymentType?: 'cash_memo' | 'debit_memo' | 'delivery_challan';
  orderType?: OrderType; // 'REGULAR' by default for backward compatibility
  createdAt?: string; // ISO timestamp for 24-hour visibility rule
}

export type PaymentDocumentType = 'cash_memo' | 'debit_memo' | 'delivery_challan';

export type DispatchStatus = 'pending' | 'ready' | 'dispatched' | 'delivered';

export interface DispatchItem {
  productId: string;
  productName: string;
  quantity: number;
  deliveryUnit?: 'pieces' | 'packets';
  packetQuantity?: number;
  loosePieces?: number;
  unitsPerPacket?: number;
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

export interface PaymentReminder {
  id: string;
  orderId: string;
  customerId: string;
  customerName: string;
  phone: string;
  dueDate?: string;
  followUpDate?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
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
  unit: string; // 'kg', 'bags', 'boxes' - deprecated, use baseUnit
  baseUnit: string; // 'kg', 'g', 'pcs'
  purchaseUnit: string; // 'Bag', 'Carton', 'kg', 'g', 'pcs'
  consumptionUnit: string; // 'kg', 'g', 'pcs'
  conversionFactor: number; // how many base units per purchase unit (e.g., 50 kg per Bag)
  piecesPerBaseUnit?: number; // how many pieces per base unit (e.g., 20 pcs per kg)
  unitCost: number;
  supplier: string;
  status: 'healthy' | 'low_stock';
  lastRestocked: string;
}

export interface PurchasedMaterial {
  id: string;
  materialName: string;
  supplier: string;
  conversionMode?: 'bags' | 'piece_count' | 'pieces' | 'packets';
  packetQuantity?: number;
  packetWeightKg?: number;
  unitsPerPacket?: number;
  totalPieces?: number;
  numberOfBags?: number;
  weightPerBagKg?: number;
  totalWeightKg: number;
  weightPerPieceGrams?: number;
  equivalentPieces?: number;
  createdAt: string;
  updatedAt?: string;
}

export interface RawMaterialUsage {
  id: string;
  materialId: string;
  materialName: string;
  quantity: number;
  unit: string;
  baseQuantity?: number; // net consumed quantity converted to base unit
  baseTotalDeduction?: number; // total consumption including wastage, converted to base unit
  baseUnit?: string;
  equivalentPieces?: number; // equivalent pieces calculated from net consumption
  wastage1?: number; // first wastage amount
  wastage2?: number; // second wastage amount
  totalDeduction?: number; // total amount deducted from stock, including wastage
  date: string;
  productionBatch?: string;
  notes?: string;
  createdAt?: string;
}

export type PurchaseStatus = 'pending' | 'received' | 'completed' | 'cancelled';
export type PurchasePaymentStatus = 'pending' | 'partially_paid' | 'paid';

export interface PurchasePayment {
  id: string;
  purchaseId: string;
  purchaseNumber: string;
  supplierName: string;
  amount: number;
  paymentDate: string;
  paymentMethod?: PaymentMethod;
  notes?: string;
}

export interface PurchaseItem {
  rawMaterialId: string;
  rawMaterialName: string;
  hsnSac?: string;
  category: RawMaterialCategory;
  unit: string;
  unitCost: number;
  quantity: number;
  subtotal: number;
  taxRate?: number;
  numberOfBags?: number;
  weightPerBagKg?: number;
  weightPerPieceGrams?: number;
  totalWeightGrams?: number;
  calculatedPieces?: number;
}

export interface PurchaseOrder {
  id: string;
  purchaseNumber: string; // e.g. PO-10021
  supplierId?: string;
  supplierName: string;
  supplierPhone?: string;
  items: PurchaseItem[];
  subtotal: number;
  gstAmount: number;
  gstRate: number; // e.g. 18
  totalAmount: number;
  totalQuantity: number;
  status: PurchaseStatus;
  paymentStatus: PurchasePaymentStatus;
  paidAmount: number;
  paymentRecords?: PurchasePayment[];
  purchaseDate: string;
  stockAdded?: boolean;
  notes?: string;
  createdAt: string;
}

export interface FinishedGoodsLog {
  id: string;
  productId: string;
  productName: string;
  type: ProductType;
  quantityProduced: number;
  quantityAdded?: number;
  unit: string;
  date: string;
  source?: string;
  createdAt?: string;
  notes?: string;
  wastagePieces?: number; // Number of wasted finished-product pieces
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
