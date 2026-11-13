// audit_live_erp.js
// This script uses Playwright to log into the live ERP (https://angel-pet-management.vercel.app)
// and verify the UI requirements listed in the audit request.
// It runs in a headless Chromium browser, captures screenshots, console logs, and
// produces a JSON report in the artifact directory.

import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

// Credentials (provided by user)
const EMAIL = 'angelpetcrm@gmail.com';
const PASSWORD = 'angel@123';

// Helper to safely check presence of text (returns true if found)
async function hasText(page, text) {
  const locator = page.locator(`text=${text}`);
  return await locator.count() > 0;
}

// Helper to capture screenshot with a deterministic name
async function capture(page, name, artifactDir) {
  const filePath = path.join(artifactDir, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage: true });
  return filePath;
}

async function runAudit() {
  const artifactDir = path.resolve(process.env.AGENT_ARTIFACT_DIR || '.', 'audit_report');
  fs.mkdirSync(artifactDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const report = {
    steps: [],
    screenshots: {},
    console: [],
    networkErrors: [],
    results: {},
  };

  // Capture console messages
  page.on('console', msg => {
    report.console.push({type: msg.type(), text: msg.text()});
  });
  // Capture failed network requests
  page.on('requestfailed', request => {
    report.networkErrors.push({url: request.url(), errorText: request.failure()?.errorText});
  });

  // 1. Open home page
  await page.goto('https://angel-pet-management.vercel.app', {waitUntil: 'networkidle'});
  report.steps.push('Opened home page');
  report.screenshots.home = await capture(page, 'home', artifactDir);

  // 2. Login
  // Assume there is a login button/link on the home page
  const loginBtn = page.locator('text=Login, text=Sign In, [data-test-id="login"]');
  if (await loginBtn.count() > 0) {
    await loginBtn.first().click();
    await page.waitForLoadState('networkidle');
  }
  // Fill credentials
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle' }),
    page.click('button:has-text("Sign In"), button:has-text("Login")'),
  ]);
  report.steps.push('Logged in');
  report.screenshots.afterLogin = await capture(page, 'afterLogin', artifactDir);

  // Helper to navigate via sidebar links (assuming they have recognizable text)
  async function navigateTo(section) {
    const link = page.locator(`nav >> text=${section}`);
    await link.click();
    await page.waitForLoadState('networkidle');
    report.screenshots[section] = await capture(page, section, artifactDir);
    report.steps.push(`Navigated to ${section}`);
  }

  // 3. Verify Purchase module UI (no write actions)
  await navigateTo('Purchases');
  // Check that error messages are not displayed by default
  const purchaseError = await hasText(page, 'Failed to record purchase entry');
  report.results.purchaseErrorMessageAbsent = !purchaseError;

  // 4. Verify Raw Materials inventory page
  await navigateTo('Raw Materials');
  // Simple check that a table of materials exists
  const rawTableExists = await page.locator('table').first().isVisible();
  report.results.rawMaterialsTableVisible = rawTableExists;

  // 5. Verify Finished Goods page
  await navigateTo('Finished Goods');
  const fgTableExists = await page.locator('table').first().isVisible();
  report.results.finishedGoodsTableVisible = fgTableExists;

  // 6. Verify Sales & Orders page
  await navigateTo('Sales & Orders');
  const ordersTable = await page.locator('table').first().isVisible();
  report.results.salesOrdersTableVisible = ordersTable;

  // 7. Verify Dispatch (Delivery Challan) page
  await navigateTo('Dispatch');
  const dispatchTable = await page.locator('table').first().isVisible();
  report.results.dispatchTableVisible = dispatchTable;

  // 8. Verify Finance page
  await navigateTo('Finance');
  const financeTable = await page.locator('table').first().isVisible();
  report.results.financeTableVisible = financeTable;

  // 9. Verify invoice print layout (Tax Invoice & Debit Memo)
  // Open a sample order's invoice preview if available.
  // We'll click the first order's "View" then "Print Invoice" button.
  await navigateTo('Sales & Orders');
  const firstOrderRow = page.locator('tbody tr').first();
  if (await firstOrderRow.count() > 0) {
    // Click a view/details button inside the row – look for a button/icon with "eye" or "details"
    const viewBtn = firstOrderRow.locator('button:has-text("View"), button:has-text("Details"), [aria-label="view"]');
    if (await viewBtn.count() > 0) {
      await viewBtn.click();
      await page.waitForLoadState('networkidle');
      // Now look for a Print Invoice button
      const printBtn = page.locator('button:has-text("Print Invoice"), button:has-text("Print")');
      if (await printBtn.count() > 0) {
        const [popup] = await Promise.all([
          context.waitForEvent('page'),
          printBtn.click(),
        ]);
        await popup.waitForLoadState('networkidle');
        // Capture screenshot of print preview
        report.screenshots.invoicePrint = await capture(popup, 'invoicePrint', artifactDir);
        // Verify removal of highlighted elements
        const companyHeader = await hasText(popup, 'Angel Pet Packaging Solutions Pvt Ltd');
        const taxInvoiceHeading = await hasText(popup, 'TAX INVOICE');
        const debitMemoHeading = await hasText(popup, 'DEBIT MEMO');
        const totalWeight = await hasText(popup, 'Total Weight');
        report.results.invoiceCompanyHeaderAbsent = !companyHeader;
        report.results.invoiceTaxInvoiceHeadingAbsent = !taxInvoiceHeading;
        report.results.invoiceDebitMemoHeadingAbsent = !debitMemoHeading;
        report.results.invoiceTotalWeightAbsent = !totalWeight;
        await popup.close();
      }
    }
  }

  // 10. Verify Finance ledger sorting (newest first)
  // On Finance page, locate ledger rows (assume they have a data-test-id or can be found by table rows)
  const ledgerRows = await page.locator('table tbody tr');
  const rowCount = await ledgerRows.count();
  const dates = [];
  for (let i = 0; i < Math.min(rowCount, 20); i++) { // sample first 20 rows
    const dateText = await ledgerRows.nth(i).locator('td').first().innerText();
    // Assume date format is YYYY-MM-DD or similar; parse into Date
    const parsed = new Date(dateText.trim());
    if (!isNaN(parsed)) dates.push(parsed.getTime());
  }
  // Check if array is strictly descending
  let sortedDesc = true;
  for (let i = 1; i < dates.length; i++) {
    if (dates[i] > dates[i - 1]) { sortedDesc = false; break; }
  }
  report.results.financeLedgerSortedDesc = sortedDesc;

  await browser.close();

  // Write JSON report
  const reportPath = path.join(artifactDir, 'audit_report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');
  console.log('Report written to', reportPath);
}

runAudit().catch(e => {
  console.error('Audit script failed:', e);
  process.exit(1);
});

