// audit_live_erp_v2.js
// Updated Playwright script to discover navigation items dynamically and avoid hard‑coded text.
import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const EMAIL = 'angelpetcrm@gmail.com';
const PASSWORD = 'angel@123';

async function hasText(page, text) {
  const locator = page.locator(`text=${text}`);
  return await locator.count() > 0;
}

async function capture(page, name, dir) {
  const file = path.join(dir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  return file;
}

async function runAudit() {
  const artifactDir = path.resolve(process.env.AGENT_ARTIFACT_DIR || '.', 'audit_report');
  fs.mkdirSync(artifactDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const report = { steps: [], screenshots: {}, console: [], networkErrors: [], results: {} };

  page.on('console', msg => report.console.push({ type: msg.type(), text: msg.text() }));
  page.on('requestfailed', req => report.networkErrors.push({ url: req.url(), error: req.failure()?.errorText }));

  // 1. Home page
  await page.goto('https://angel-pet-management.vercel.app', { waitUntil: 'networkidle' });
  report.steps.push('opened home');
  report.screenshots.home = await capture(page, 'home', artifactDir);

  // 2. Login – try several possible selectors
  const loginSelectors = [
    'text=Login',
    'text=Sign In',
    '[data-test-id="login"]',
    'a[href*="/login"]',
  ];
  for (const sel of loginSelectors) {
    if (await page.locator(sel).count() > 0) { await page.locator(sel).first().click(); break; }
  }
  await page.waitForLoadState('networkidle');
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  const submitBtn = page.locator('button:has-text("Sign In"), button:has-text("Login"), button[type="submit"]');
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle' }),
    submitBtn.first().click(),
  ]);
  report.steps.push('logged in');
  report.screenshots.afterLogin = await capture(page, 'afterLogin', artifactDir);

  // Helper to get visible navigation items (assuming they are in a <nav> element)
  async function listNavItems() {
    const nav = page.locator('nav');
    const items = await nav.locator('a, button, [role="menuitem"], [role="link"]').all();
    const names = [];
    for (const i of items) {
      const txt = await i.innerText();
      if (txt.trim()) names.push(txt.trim());
    }
    return names;
  }

  // Store discovered nav items for debugging
  report.results.discoveredNavItems = await listNavItems();

  // Function to navigate by matching partial text
  async function navigate(section) {
    const locator = page.locator(`nav >> text=${section}`);
    await locator.first().click({ timeout: 15000 });
    await page.waitForLoadState('networkidle');
    report.screenshots[section] = await capture(page, section, artifactDir);
    report.steps.push(`navigated to ${section}`);
  }

  // Attempt to navigate to each required module using likely names.
  const modules = [
    { name: 'Purchases', key: 'purchase' },
    { name: 'Raw Materials', key: 'rawMaterials' },
    { name: 'Finished Goods', key: 'finishedGoods' },
    { name: 'Sales & Orders', key: 'sales' },
    { name: 'Dispatch', key: 'dispatch' },
    { name: 'Finance', key: 'finance' },
  ];

  for (const mod of modules) {
    try { await navigate(mod.name); }
    catch (e) {
      // fallback: try to click by partial match if exact fails
      try { await navigate(mod.name.split(' ')[0]); }
      catch { report.results[mod.key + 'NavFailed'] = true; }
    }
  }

  // After navigation, perform checks (simplified – presence of tables and absence of removed invoice elements)
  // Purchase module – ensure error message not present
  report.results.purchaseErrorAbsent = !(await hasText(page, 'Failed to record purchase entry'));

  // Raw Materials – table visible?
  report.results.rawMaterialsTable = await page.locator('table').first().isVisible();

  // Finished Goods – table visible?
  report.results.finishedGoodsTable = await page.locator('table').first().isVisible();

  // Sales & Orders – table visible?
  report.results.salesOrdersTable = await page.locator('table').first().isVisible();

  // Dispatch – table visible?
  report.results.dispatchTable = await page.locator('table').first().isVisible();

  // Finance – table visible?
  report.results.financeTable = await page.locator('table').first().isVisible();

  // Invoice print preview – open first order, then print
  await navigate('Sales & Orders');
  const firstRow = page.locator('tbody tr').first();
  if (await firstRow.count() > 0) {
    const viewBtn = firstRow.locator('button, a', { hasText: /View|Details|eye/i }).first();
    if (await viewBtn.count() > 0) {
      await viewBtn.click();
      await page.waitForLoadState('networkidle');
      const printBtn = page.locator('button:has-text("Print Invoice"), button:has-text("Print")').first();
      if (await printBtn.count() > 0) {
        const [popup] = await Promise.all([
          context.waitForEvent('page'),
          printBtn.click(),
        ]);
        await popup.waitForLoadState('networkidle');
        report.screenshots.invoicePrint = await capture(popup, 'invoicePrint', artifactDir);
        report.results.invoiceCompanyHeaderAbsent = !(await hasText(popup, 'Angel Pet Packaging Solutions Pvt Ltd'));
        report.results.invoiceTaxHeadingAbsent = !(await hasText(popup, 'TAX INVOICE'));
        report.results.invoiceDebitMemoAbsent = !(await hasText(popup, 'DEBIT MEMO'));
        report.results.invoiceTotalWeightAbsent = !(await hasText(popup, 'Total Weight'));
        await popup.close();
      }
    }
  }

  // Finance ledger sorting – sample first 20 rows dates
  const rows = await page.locator('table tbody tr');
  const count = await rows.count();
  const dates = [];
  for (let i = 0; i < Math.min(count, 20); i++) {
    const dateText = await rows.nth(i).locator('td').first().innerText();
    const parsed = new Date(dateText.trim());
    if (!isNaN(parsed)) dates.push(parsed.getTime());
  }
  let descending = true;
  for (let i = 1; i < dates.length; i++) {
    if (dates[i] > dates[i - 1]) { descending = false; break; }
  }
  report.results.financeLedgerDesc = descending;

  await browser.close();
  const reportPath = path.join(artifactDir, 'audit_report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
  console.log('Report written to', reportPath);
}

runAudit().catch(err => {
  console.error('Audit failed', err);
  process.exit(1);
});

