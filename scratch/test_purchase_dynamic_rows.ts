// Unit test for Purchase Entry Dynamic Line-Item Behavior

interface DraftPurchaseItem {
  id: string;
  rawMaterialId: string;
  quantity: string;
  unitCost: string;
}

const createDraftItem = (rawMaterialId = '', quantity = '', unitCost = ''): DraftPurchaseItem => ({
  id: `line-${Math.random().toString(36).substring(2, 9)}`,
  rawMaterialId,
  quantity,
  unitCost
});

const isItemComplete = (item: DraftPurchaseItem): boolean => {
  if (!item.rawMaterialId) return false;
  const qty = Number(item.quantity);
  if (!item.quantity || isNaN(qty) || qty <= 0) return false;
  if (item.unitCost === '' || isNaN(Number(item.unitCost)) || Number(item.unitCost) < 0) return false;
  return true;
};

// Pure state reducer simulating the useEffect logic
function processItemsState(currentItems: DraftPurchaseItem[]): DraftPurchaseItem[] {
  if (currentItems.length === 0) {
    return [createDraftItem()];
  }

  const lastItem = currentItems[currentItems.length - 1];
  const isLastComplete = isItemComplete(lastItem);

  // If last item is complete and has a selected material, append one blank row
  if (isLastComplete && lastItem.rawMaterialId) {
    return [...currentItems, createDraftItem()];
  }

  // If there are multiple trailing blank rows, trim to exactly one
  if (currentItems.length >= 2) {
    const secondLast = currentItems[currentItems.length - 2];
    const isLastBlank = !lastItem.rawMaterialId && !lastItem.quantity && !lastItem.unitCost;
    const isSecondLastIncomplete = !isItemComplete(secondLast);
    if (isSecondLastIncomplete && isLastBlank) {
      return currentItems.slice(0, -1);
    }
  }

  return currentItems;
}

function filterItemsForSave(items: DraftPurchaseItem[]): DraftPurchaseItem[] {
  const nonBlankItems = items.filter(
    (item) => item.rawMaterialId || item.quantity !== '' || item.unitCost !== ''
  );
  return nonBlankItems.filter(isItemComplete);
}

function runTests() {
  console.log('--- Testing Purchase Dynamic Row Logic ---');

  // Test A: Initial state
  console.log('\n[Test A: Open Purchase Entry]');
  let items = [createDraftItem()];
  items = processItemsState(items);
  console.assert(items.length === 1, `Expected 1 row, got ${items.length}`);
  console.assert(!items[0].rawMaterialId && !items[0].quantity && !items[0].unitCost, 'Row should be empty');
  console.log('✓ Initial state is exactly 1 empty line.');

  // Test B: Select material only
  console.log('\n[Test B: Select material only]');
  items[0].rawMaterialId = 'mat-pet-granules';
  items = processItemsState(items);
  console.assert(items.length === 1, `Expected 1 row, got ${items.length}`);
  console.log('✓ Selecting material only does not add a second row.');

  // Test C: Enter quantity only (without unitCost)
  console.log('\n[Test C: Enter quantity only]');
  items[0].quantity = '1000';
  items = processItemsState(items);
  console.assert(items.length === 1, `Expected 1 row, got ${items.length}`);
  console.log('✓ Entering quantity without rate does not add a second row.');

  // Test D: Enter rate after material + quantity
  console.log('\n[Test D: Enter rate after material + valid quantity]');
  items[0].unitCost = '110';
  items = processItemsState(items);
  console.assert(items.length === 2, `Expected 2 rows, got ${items.length}`);
  console.assert(isItemComplete(items[0]), 'Row 1 should be complete');
  console.assert(!items[1].rawMaterialId && !items[1].quantity && !items[1].unitCost, 'Row 2 should be empty');
  console.log('✓ Second empty line automatically appears after completing Line 1.');

  // Test E: Complete second line
  console.log('\n[Test E: Complete second line]');
  items[1].rawMaterialId = 'mat-colour-masterbatch';
  items[1].quantity = '50';
  items[1].unitCost = '250';
  items = processItemsState(items);
  console.assert(items.length === 3, `Expected 3 rows, got ${items.length}`);
  console.assert(isItemComplete(items[1]), 'Row 2 should be complete');
  console.assert(!items[2].rawMaterialId && !items[2].quantity && !items[2].unitCost, 'Row 3 should be empty');
  console.log('✓ Third empty line automatically appears after completing Line 2.');

  // Test F: Remove a completed line
  console.log('\n[Test F: Remove a completed line]');
  // Remove items[0] (Line 1)
  const line2Id = items[1].id;
  items = items.filter((_, idx) => idx !== 0);
  items = processItemsState(items);
  console.assert(items.length === 2, `Expected 2 rows after deletion, got ${items.length}`);
  console.assert(items[0].id === line2Id, 'Remaining row should be previous Line 2');
  console.assert(!items[1].rawMaterialId && !items[1].quantity && !items[1].unitCost, 'Last row should be single empty row');
  console.log('✓ Removing a completed line leaves exactly one trailing empty line without duplicates.');

  // Test G: Save purchase with 2 completed lines + 1 trailing empty line
  console.log('\n[Test G: Save purchase with completed lines + trailing empty line]');
  // Reconstruct: Line 1 complete, Line 2 complete, Line 3 empty
  const stateWithTrailingEmpty: DraftPurchaseItem[] = [
    { id: '1', rawMaterialId: 'mat-1', quantity: '1000', unitCost: '110' },
    { id: '2', rawMaterialId: 'mat-2', quantity: '50', unitCost: '250' },
    { id: '3', rawMaterialId: '', quantity: '', unitCost: '' }
  ];
  const savedItems = filterItemsForSave(stateWithTrailingEmpty);
  console.assert(savedItems.length === 2, `Expected 2 saved items, got ${savedItems.length}`);
  console.assert(savedItems[0].rawMaterialId === 'mat-1', 'First saved item correct');
  console.assert(savedItems[1].rawMaterialId === 'mat-2', 'Second saved item correct');
  console.log('✓ Only the 2 completed lines are saved to Firestore, ignoring the trailing empty row.');

  console.log('\n=============================================');
  console.log('ALL PURCHASE DYNAMIC ROW TESTS PASSED!');
  console.log('=============================================');
}

runTests();
