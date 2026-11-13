import { describe, expect, it } from 'vitest';
import { buildBulkPurchaseUpdates, canBulkReceivePurchase } from '../../src/utils/purchaseBulkUtils';
import { PurchaseOrder } from '../../src/types';

const basePurchase: PurchaseOrder = {
  id: 'PO-1',
  purchaseNumber: 'PO-10001',
  supplierId: 'SUP-1',
  supplierName: 'Supplier One',
  supplierPhone: '999',
  items: [
    {
      rawMaterialId: 'MAT-1',
      rawMaterialName: 'Material One',
      category: 'granules',
      unit: 'kg',
      unitCost: 10,
      quantity: 5,
      subtotal: 50,
      wastage1Pieces: 1,
      netAvailablePieces: 99,
      pieceRate: 0.5
    }
  ],
  subtotal: 50,
  gstAmount: 0,
  gstRate: 0,
  totalAmount: 50,
  totalQuantity: 5,
  status: 'pending',
  paymentStatus: 'pending',
  paidAmount: 0,
  purchaseDate: '2026-11-01',
  stockAdded: false,
  notes: 'old note',
  createdAt: '2026-11-01'
};

describe('bulk purchase edit helpers', () => {
  it('builds only explicitly changed header fields and never touches items or stock fields', () => {
    const updates = buildBulkPurchaseUpdates(basePurchase, {
      supplierId: 'SUP-2',
      supplierName: 'Supplier Two',
      supplierPhone: '888',
      purchaseDate: '2026-11-10',
      notes: 'new note'
    });

    expect(updates).toEqual({
      supplierId: 'SUP-2',
      supplierName: 'Supplier Two',
      supplierPhone: '888',
      purchaseDate: '2026-11-10',
      notes: 'new note'
    });
    expect(updates.items).toBeUndefined();
    expect(updates.stockAdded).toBeUndefined();
    expect(updates.paymentStatus).toBeUndefined();
    expect(updates.totalAmount).toBeUndefined();
  });

  it('returns an empty update when values are unchanged', () => {
    expect(
      buildBulkPurchaseUpdates(basePurchase, {
        supplierId: 'SUP-1',
        supplierName: 'Supplier One',
        supplierPhone: '999',
        purchaseDate: '2026-11-01',
        notes: 'old note'
      })
    ).toEqual({});
  });

  it('marks only pending non-stock-added purchases as bulk receivable', () => {
    expect(canBulkReceivePurchase(basePurchase)).toBe(true);
    expect(canBulkReceivePurchase({ ...basePurchase, stockAdded: true })).toBe(false);
    expect(canBulkReceivePurchase({ ...basePurchase, status: 'received' })).toBe(false);
    expect(canBulkReceivePurchase({ ...basePurchase, status: 'cancelled' })).toBe(false);
  });
});
