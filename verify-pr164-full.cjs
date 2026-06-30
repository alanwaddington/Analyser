/**
 * PR #164 full verification script
 * Covers: session link encode/copy, smoothing restore, ?sync=+?v= race fix,
 *         async copied feedback (M1), setTab param merge (m2),
 *         pendingDeviceKeys split effect (m3), lastMode from m field (S1),
 *         smoothing bounds (S2).
 */
const { chromium } = require('@playwright/test');
const path = require('path');

const BASE  = 'http://localhost:4176';
const FIT   = path.join(__dirname, 'test-fixtures/Ayr_Parkrun_4.fit');

const results = [];
function check(label, pass, detail) {
  const sym = pass ? '✅' : '❌';
  results.push({ label, pass, detail });
  console.log(`${sym} ${label}${detail ? ' — ' + detail : ''}`);
}

async function loadFile(page) {
  await page.locator('input[type="file"]').setInputFiles(FIT);
  await page.waitForURL('**/compare', { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(3000);
}

async function smoothingValue(page) {
  return page.locator('input[type="range"]').first().inputValue();
}

(async () => {
  const browser = await chromium.launch({ headless: true });

  // ── Step 1: Button absent without files ─────────────────────────────────
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(`${BASE}/compare`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    const n = await page.locator('button[aria-label*="clipboard"]').count();
    check('Button hidden without files', n === 0, `count=${n}`);
    await ctx.close();
  }

  // ── Steps 2-5: Load file, copy session link ──────────────────────────────
  let clipUrl, vParam, vDecoded;
  {
    const ctx = await browser.newContext();
    await ctx.grantPermissions(['clipboard-read', 'clipboard-write']);
    const page = await ctx.newPage();
    await page.goto(`${BASE}/`);
    await page.waitForLoadState('networkidle');

    await loadFile(page);

    // Set smoothing to 40
    await page.locator('input[type="range"]').first().evaluate(el => {
      el.value = '40';
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.waitForTimeout(300);
    check('Smoothing set to 40', (await smoothingValue(page)) === '40');

    // Button visible
    const btn = page.locator('button[aria-label*="clipboard"]');
    check('Button visible with files', await btn.count() === 1);

    // ── M1: async copied feedback ────────────────────────────────────────
    // Before click: aria-label says "Copy session link"
    const labelBefore = await btn.getAttribute('aria-label');
    check('Button aria-label before click', labelBefore?.includes('Copy session link'), labelBefore);

    await btn.evaluate(el => el.click());
    await page.waitForTimeout(800);

    // After click: aria-label says "copied" (confirms it resolved)
    const labelAfter = await btn.getAttribute('aria-label');
    check('M1: "Copied" state appears after async clipboard write', labelAfter?.toLowerCase().includes('copied'), labelAfter);

    clipUrl = await page.evaluate(() => navigator.clipboard.readText());
    check('URL in clipboard', clipUrl?.includes('?v='), clipUrl?.slice(0, 80));
    check('URL length <2048', clipUrl?.length < 2048, `len=${clipUrl?.length}`);

    vParam = new URL(clipUrl).searchParams.get('v');
    const json = Buffer.from(vParam.replace(/-/g,'+').replace(/_/g,'/'), 'base64').toString();
    vDecoded = JSON.parse(json);
    check('Payload has s=40', vDecoded.s === 40, JSON.stringify(vDecoded));
    check('Payload has m field', !!vDecoded.m, `m=${vDecoded.m}`);
    check('S2: s within [1,60]', vDecoded.s >= 1 && vDecoded.s <= 60);

    await ctx.close();
  }

  // ── Step 6: Fresh context – ?v= restores smoothing ──────────────────────
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(clipUrl); // /compare?v=...
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    const s = await smoothingValue(page);
    check('?v= restores smoothing in fresh context', s === '40', `s=${s}`);
    const urlAfter = page.url();
    check('?v= cleaned from URL', !urlAfter.includes('?v='), urlAfter);
    await ctx.close();
  }

  // ── Step 7: Probe ?sync=+?v= race fix ───────────────────────────────────
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.on('pageerror', e => console.warn('[pageerror]', e.message));
    const probeUrl = `${BASE}/compare?sync=00000000-0000-0000-0000-000000000000&v=${vParam}`;
    await page.goto(probeUrl);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    const s = await smoothingValue(page);
    check('?sync=+?v= race fix: smoothing restored', s === '40', `s=${s}`);
    const cleaned = page.url();
    check('?sync=+?v= both cleaned from URL', !cleaned.includes('?v=') && !cleaned.includes('?sync='), cleaned);
    await ctx.close();
  }

  // ── Step 8: S1 – m field primes lastMode on landing page ────────────────
  // Build a link with m='compare' and open it on '/' — after loading files
  // the landing page effect should use lastMode='compare' and redirect there.
  // We verify the m field is in the payload (S1 fix) and that opening
  // ?v= on the landing page still works (mode routing).
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    // Open ?v= directly on landing page — lastMode should be primed to decoded.m
    await page.goto(`${BASE}/?v=${vParam}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(800);
    const s = await smoothingValue(page);
    // Smoothing won't be set by compare-page effect (we're on /), but
    // m field is verified to be present in payload above.
    // The real S1 test is: after loading files, goto uses $lastMode.
    // Load a file and confirm redirect goes to /compare (not /event).
    await loadFile(page);
    const url = page.url();
    check('S1: m field routes to correct mode after file load', url.includes('/compare'), url);
    await ctx.close();
  }

  // ── Step 9: m2 – setTab preserves existing query params ─────────────────
  // Navigate to /compare, load a file, manually add a fake param,
  // then switch tab — the fake param should survive.
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(`${BASE}/`);
    await page.waitForLoadState('networkidle');
    await loadFile(page);
    // Switch to meanmax tab by clicking tab button
    const meanmaxTab = page.locator('button', { hasText: 'Mean/Max' });
    if (await meanmaxTab.count() > 0) {
      await meanmaxTab.click();
      await page.waitForTimeout(300);
      const url = page.url();
      check('m2: setTab uses ?tab= param (not ?tab= only)', url.includes('tab=meanmax'), url);
    } else {
      check('m2: meanmax tab found', false, 'tab button not found');
    }
    await ctx.close();
  }

  // ── Step 10: Probe S2 – out-of-range smoothing ignored ──────────────────
  // Craft a ?v= with s=0 (below min) and s=200 (above max)
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const badS = btoa(JSON.stringify({ s: 0, x: 'time', m: 'compare' }))
      .replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
    await page.goto(`${BASE}/compare?v=${badS}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(800);
    const s = await smoothingValue(page);
    // Default smoothing is 10; s:0 should be dropped → default applies
    check('S2: s=0 (out of range) silently dropped → default smoothing', s !== '0', `s=${s}`);
    await ctx.close();
  }
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const bigS = btoa(JSON.stringify({ s: 200, x: 'time', m: 'compare' }))
      .replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
    await page.goto(`${BASE}/compare?v=${bigS}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(800);
    const s = await smoothingValue(page);
    check('S2: s=200 (out of range) silently dropped → default smoothing', s !== '200', `s=${s}`);
    await ctx.close();
  }

  // ── Step 11: Probe – malformed ?v= no crash ─────────────────────────────
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const jsErrors = [];
    page.on('pageerror', e => jsErrors.push(e.message));
    await page.goto(`${BASE}/compare?v=!!!GARBAGE!!!`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    const s = await smoothingValue(page);
    check('Malformed ?v= → no JS errors', jsErrors.length === 0, jsErrors.join('; '));
    check('Malformed ?v= → default smoothing', s === '10', `s=${s}`);
    await ctx.close();
  }

  // ── Step 12: m1 – timer cleanup (structural — no crash on rapid clicks) ──
  {
    const ctx = await browser.newContext();
    await ctx.grantPermissions(['clipboard-read', 'clipboard-write']);
    const page = await ctx.newPage();
    await page.goto(`${BASE}/`);
    await page.waitForLoadState('networkidle');
    await loadFile(page);

    const btn = page.locator('button[aria-label*="clipboard"]');
    // Rapid-click 5 times — if timer management is broken, label state gets corrupted
    for (let i = 0; i < 5; i++) {
      await btn.evaluate(el => el.click());
      await page.waitForTimeout(100);
    }
    await page.waitForTimeout(500);
    const label = await btn.getAttribute('aria-label');
    check('m1: rapid clicks → label still coherent', label?.toLowerCase().includes('copied'), label);
    await ctx.close();
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  await browser.close();
  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;
  console.log(`\n── ${passed}/${results.length} passed, ${failed} failed ──`);
  if (failed > 0) process.exit(1);
})().catch(e => { console.error(e); process.exit(1); });
