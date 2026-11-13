import { PurchaseOrder, PurchaseStatus } from '../types';

export interface BulkPurchaseEditDraft {
  supplierId?: string;
  supplierName?: string;
  supplierPhone?: string;
  purchaseDate?: string;
  notes?: string;
}

const BULK_RECEIVABLE_STATUSES: PurchaseStatus[] = ['pending', 'ordered' as PurchaseStatus];

export function buildBulkPurchaseUpdates(
  purchase: PurchaseOrder,
  draft: BulkPurchaseEditDraft
): Partial<PurchaseOrder> {
  const updates: Partial<PurchaseOrder> = {};

  if (
    draft.supplierId !== undefined &&
    draft.supplierId !== purchase.supplierId
  ) {
    updates.supplierId = draft.supplierId;
    updates.supplierName = draft.supplierName ?? '';
    updates.supplierPhone = draft.supplierPhone ?? '';
  }

  if (draft.purchaseDate !== undefined && draft.purchaseDate !== purchase.purchaseDate) {
    updates.purchaseDate = draft.purchaseDate;
  }

  if (draft.notes !== undefined && draft.notes !== purchase.notes) {
    updates.notes = draft.notes;
  }

  return updates;
}

export function canBulkReceivePurchase(purchase: PurchaseOrder): boolean {
  return !purchase.stockAdded && BULK_RECEIVABLE_STATUSES.includes(purchase.status);
}
