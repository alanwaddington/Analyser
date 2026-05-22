/**
 * generate-docs-pdf.ts
 *
 * Converts docs/user_guides/user-guide.md to docs/user_guides/user-guide.pdf
 * using marked (Markdown → HTML) and Playwright (HTML → PDF via Chromium).
 *
 * Usage:
 *   npm run docs:pdf
 */

import { chromium } from '@playwright/test';
import { marked } from 'marked';
import fs from 'node:fs';
import { execSync, spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const MD_PATH = path.join(ROOT, 'docs', 'user_guides', 'user-guide.md');
const PDF_PATH = path.join(ROOT, 'docs', 'user_guides', 'user-guide.pdf');
const SCREENSHOTS_DIR = path.join(ROOT, 'docs', 'user_guides', 'screenshots');

// Playwright's Chromium subprocess cannot write directly to Windows filesystem
// paths via WSL. Write to /tmp first, then copy to the final destination.
const PDF_TMP = '/tmp/user-guide-generated.pdf';

// ---------------------------------------------------------------------------
// 1. Read and parse markdown
// ---------------------------------------------------------------------------

const markdown = fs.readFileSync(MD_PATH, 'utf-8');

// Embed screenshots as base64 data URIs so they load regardless of Chromium's
// file:// origin restrictions when HTML is loaded via page.setContent().
const markdownWithInlineImages = markdown.replace(
	/!\[([^\]]*)\]\(screenshots\/([^)]+)\)/g,
	(_, alt, filename) => {
		const imgPath = path.join(SCREENSHOTS_DIR, filename);
		if (!fs.existsSync(imgPath)) {
			console.warn(`  ⚠ Screenshot not found, skipping: ${filename}`);
			return `![${alt}]()`;
		}
		const ext = path.extname(filename).slice(1).toLowerCase();
		const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`;
		const b64 = fs.readFileSync(imgPath).toString('base64');
		return `![${alt}](data:${mime};base64,${b64})`;
	},
);

const bodyHtml = await marked(markdownWithInlineImages, { gfm: true });

// ---------------------------------------------------------------------------
// 2. Build full HTML page with print-friendly CSS
// ---------------------------------------------------------------------------

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Analyser — User Guide</title>
<style>
  /* ---- Reset & base ---- */
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  html {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
    font-size: 10.5pt;
    color: #1a1a2e;
    line-height: 1.65;
  }

  body {
    padding: 20mm 22mm 20mm 22mm;
    max-width: 100%;
  }

  /* ---- Headings ---- */
  h1 { font-size: 22pt; margin-bottom: 6pt; padding-bottom: 6pt; border-bottom: 2px solid #3b82f6; color: #1e3a5f; }
  h2 { font-size: 15pt; margin-top: 22pt; margin-bottom: 8pt; padding-bottom: 4pt; border-bottom: 1px solid #d1d5db; color: #1e3a5f; }
  h3 { font-size: 12pt; margin-top: 16pt; margin-bottom: 6pt; color: #1e3a5f; }
  h4 { font-size: 10.5pt; margin-top: 12pt; margin-bottom: 4pt; color: #374151; }

  /* ---- Paragraphs & lists ---- */
  p  { margin-bottom: 8pt; }
  ul, ol { margin: 6pt 0 10pt 20pt; }
  li { margin-bottom: 3pt; }

  /* ---- Links ---- */
  a { color: #2563eb; text-decoration: none; }

  /* ---- Blockquotes ---- */
  blockquote {
    margin: 10pt 0;
    padding: 8pt 12pt;
    border-left: 3px solid #3b82f6;
    background: #eff6ff;
    border-radius: 0 4px 4px 0;
    color: #374151;
  }
  blockquote p { margin: 0; }

  /* ---- Code ---- */
  code {
    font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
    font-size: 9pt;
    background: #f3f4f6;
    padding: 1pt 4pt;
    border-radius: 3px;
  }
  pre {
    background: #f3f4f6;
    padding: 10pt 14pt;
    border-radius: 6px;
    overflow-x: auto;
    margin: 10pt 0;
  }
  pre code { background: none; padding: 0; font-size: 9pt; }

  /* ---- Tables ---- */
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 10pt 0 14pt;
    font-size: 9.5pt;
  }
  th {
    background: #1e3a5f;
    color: #ffffff;
    text-align: left;
    padding: 5pt 8pt;
    font-weight: 600;
  }
  td {
    padding: 5pt 8pt;
    border-bottom: 1px solid #e5e7eb;
  }
  tr:nth-child(even) td { background: #f9fafb; }
  tr:last-child td { border-bottom: none; }

  /* ---- Images ---- */
  img {
    max-width: 100%;
    height: auto;
    display: block;
    margin: 12pt auto;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    box-shadow: 0 1px 4px rgba(0,0,0,0.10);
  }

  /* ---- Horizontal rule ---- */
  hr {
    border: none;
    border-top: 1px solid #e5e7eb;
    margin: 18pt 0;
  }

  /* ---- Page breaks ---- */
  h2 { page-break-before: auto; }
  h2:first-of-type { page-break-before: avoid; }
  img, table, blockquote { page-break-inside: avoid; }

  /* ---- TOC styling (unordered list at the top) ---- */
  /* The TOC renders as a plain <ul>; no special treatment needed */

  /* ---- Footer note (italics at the very bottom) ---- */
  em:only-child { color: #6b7280; }
</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;

// ---------------------------------------------------------------------------
// 3. Launch Chromium and print to PDF
// ---------------------------------------------------------------------------

console.log('Launching Chromium…');
const browser = await chromium.launch();
const page = await browser.newPage();

// Load the HTML directly as a string — no server needed.
await page.setContent(html, { waitUntil: 'networkidle' });

console.log(`Writing PDF to ${PDF_TMP}…`);
await page.pdf({
	path: PDF_TMP,
	format: 'A4',
	margin: { top: '0', right: '0', bottom: '0', left: '0' }, // margins are in the CSS body padding
	printBackground: true,
	displayHeaderFooter: true,
	headerTemplate: '<div></div>',
	footerTemplate: `
		<div style="font-size:8pt; color:#9ca3af; width:100%; text-align:center; padding-bottom:4mm;">
			Analyser User Guide &nbsp;·&nbsp;
			<span class="pageNumber"></span> / <span class="totalPages"></span>
		</div>`,
});

await browser.close();

// -------------------------------------------------------------------------
// Copy from /tmp to the final Windows-hosted destination.
//
// On WSL2, Node cannot write directly to /mnt/c paths from a subprocess
// (Playwright's Chromium), and fs.copyFileSync fails from /tmp → /mnt/c
// when a Windows read-only NTFS attribute is set.
//
// Solution:
//  1. Use spawnSync (args array — no shell, no backslash mangling) to call
//     PowerShell and clear the read-only attribute on the destination.
//  2. Use spawnSync again with Copy-Item, sourcing the tmp file via the
//     WSL UNC path (\\wsl.localhost\Ubuntu\tmp\...) so Windows can read it.
// -------------------------------------------------------------------------

// Windows-style destination path: /mnt/c/... → C:\...
const winDest = PDF_PATH.replace('/mnt/c/', 'C:\\').replace(/\//g, '\\');

// WSL UNC source path: /tmp/file → \\wsl.localhost\Ubuntu\tmp\file
// The filename component is everything after the last '/'.
const tmpFilename = path.basename(PDF_TMP);
const wslSrc = `\\\\wsl.localhost\\Ubuntu\\tmp\\${tmpFilename}`;

// Step 1 — clear read-only NTFS attribute (non-fatal if file doesn't exist yet)
spawnSync('powershell.exe', ['-Command', `attrib -r '${winDest}'`]);

// Step 2 — copy via PowerShell using args array (no shell escaping issues)
const result = spawnSync('powershell.exe', [
	'-Command',
	`Copy-Item -Path '${wslSrc}' -Destination '${winDest}' -Force`,
]);

if (result.status !== 0) {
	const stderr = result.stderr?.toString().trim();
	const isLocked = stderr?.includes('being used by another process');
	if (isLocked) {
		throw new Error(
			`Cannot write user-guide.pdf — the file is open in another application.\n` +
			`Close the PDF viewer and run 'npm run docs:pdf' again.`,
		);
	}
	throw new Error(`PowerShell Copy-Item failed (exit ${result.status}): ${stderr}`);
}

fs.unlinkSync(PDF_TMP);
console.log(`PDF written to ${PDF_PATH}`);
