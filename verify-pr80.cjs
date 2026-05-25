const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();

  const ss = (name) => `/mnt/c/Users/alan/Development/Analyser/verify-${name}.png`;

  // ── Step 1: Landing page — sidebar should be visible ──────────────────────
  await page.goto('http://localhost:5178/');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: ss('01-landing') });

  // ── Step 2: SyncPanel toggle button exists in footer ──────────────────────
  const toggleBtn = page.locator('button.toggle-row');
  const toggleCount = await toggleBtn.count();
  console.log('toggle-row buttons:', toggleCount);

  // ── Step 3: Click ☁ Sync button to open panel ─────────────────────────────
  if (toggleCount > 0) {
    await toggleBtn.first().click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: ss('02-sync-panel-open') });
    
    // Check panel content
    const shortcode = await page.locator('.shortcode').count();
    const qrWrapper = await page.locator('.qr-wrapper').count();
    const copyBtn = await page.locator('button.copy-btn').count();
    const codeInput = await page.locator('input.code-input').count();
    const resetBtn = await page.locator('button.reset-btn').count();
    const statusOk = await page.locator('.status.ok').count();
    const statusError = await page.locator('.status.error').count();
    const statusMuted = await page.locator('.status.muted').count();

    console.log('shortcode:', shortcode);
    console.log('qr-wrapper:', qrWrapper);
    console.log('copy-btn:', copyBtn);
    console.log('code-input:', codeInput);
    console.log('reset-btn:', resetBtn);
    console.log('status.ok:', statusOk, 'status.error:', statusError, 'status.muted:', statusMuted);

    // Get short code text
    if (shortcode > 0) {
      const codeText = await page.locator('.shortcode').first().innerText();
      console.log('short code text:', codeText);
      console.log('format ok:', /^[A-Z0-9]{3}-[A-Z0-9]{5}$/.test(codeText.trim()));
    }
  }

  // ── Step 4: Enter invalid code → error message ────────────────────────────
  const input = page.locator('input.code-input').first();
  if (await input.count() > 0) {
    await input.fill('BAD-CODE');
    await page.locator('button.code-submit').first().click();
    await page.waitForTimeout(1000);
    const errMsg = await page.locator('.code-error').first().innerText().catch(() => '');
    console.log('code-error text:', errMsg);
    await page.screenshot({ path: ss('03-code-error') });
  }

  // ── Step 5: Close panel ───────────────────────────────────────────────────
  await toggleBtn.first().click();
  await page.waitForTimeout(300);
  const panelVisible = await page.locator('.sync-panel').count();
  console.log('panel hidden after toggle close:', panelVisible === 0);
  await page.screenshot({ path: ss('04-panel-closed') });

  // ── Step 6: ?sync= URL param — page loads and param is cleaned ───────────────
  await page.goto('http://localhost:5178/?sync=efbe6aac-3910-4b87-8c03-eeb9ea6f0276');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
  const finalUrl = page.url();
  console.log('final URL after ?sync= param:', finalUrl);
  console.log('param cleaned:', !finalUrl.includes('sync='));
  await page.screenshot({ path: ss('05-sync-param-cleaned') });

  await browser.close();
  console.log('DONE');
})();
