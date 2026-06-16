/**
 * generate-docs.ts
 *
 * Converts three Markdown documentation files to both HTML and PDF:
 *   docs/user_guides/user-guide.md  →  user-guide.html  +  user-guide.pdf
 *   docs/api-reference.md           →  api-reference.html  +  api-reference.pdf
 *   docs/developer-guide.md         →  developer-guide.html  +  developer-guide.pdf
 *
 * Usage:
 *   npm run docs:build
 */

import { chromium } from '@playwright/test';
import { Marked } from 'marked';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// Docs registry
// ---------------------------------------------------------------------------

const DOCS = [
	{
		md:             path.join(ROOT, 'docs', 'user_guides', 'user-guide.md'),
		html:           path.join(ROOT, 'docs', 'user_guides', 'user-guide.html'),
		pdf:            path.join(ROOT, 'docs', 'user_guides', 'user-guide.pdf'),
		title:          'Analyser — User Guide',
		screenshotsDir: path.join(ROOT, 'docs', 'user_guides', 'screenshots'),
	},
	{
		md:             path.join(ROOT, 'docs', 'api-reference.md'),
		html:           path.join(ROOT, 'docs', 'api-reference.html'),
		pdf:            path.join(ROOT, 'docs', 'api-reference.pdf'),
		title:          'Analyser — API Reference',
		screenshotsDir: null,
	},
	{
		md:             path.join(ROOT, 'docs', 'developer-guide.md'),
		html:           path.join(ROOT, 'docs', 'developer-guide.html'),
		pdf:            path.join(ROOT, 'docs', 'developer-guide.pdf'),
		title:          'Analyser — Developer Guide',
		screenshotsDir: null,
	},
];

// ---------------------------------------------------------------------------
// Heading ID generation
// ---------------------------------------------------------------------------

// Mirrors GitHub's slug algorithm: lowercase, strip non-word/space/hyphen,
// replace each space with a hyphen (not collapsing — double spaces → "-- ").
function slugify(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^\w\s-]/g, '')
		.replace(/\s/g, '-');
}

// Returns a fresh marked renderer that adds id attributes to every heading.
// A new renderer is created per document so duplicate-ID tracking resets.
function buildRenderer(): object {
	const seen = new Map<string, number>();
	return {
		heading(token: { text: string; depth: number }): string {
			// token.text is already rendered HTML (inline code, links, etc.).
			// Strip tags and decode common entities to get plain text for the ID.
			const plain = token.text
				.replace(/<[^>]+>/g, '')
				.replace(/&amp;/g, '&')
				.replace(/&lt;/g, '<')
				.replace(/&gt;/g, '>');
			const base = slugify(plain);
			const count = seen.get(base) ?? 0;
			seen.set(base, count + 1);
			const id = count === 0 ? base : `${base}-${count}`;
			return `<h${token.depth} id="${id}">${token.text}</h${token.depth}>\n`;
		},
	};
}

// ---------------------------------------------------------------------------
// Shared CSS (works for both screen and print)
// ---------------------------------------------------------------------------

const CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  html {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
    font-size: 10.5pt;
    color: #1a1a2e;
    line-height: 1.65;
  }

  body {
    max-width: 900px;
    margin: 0 auto;
    padding: 2rem 2.5rem;
  }

  h1 { font-size: 22pt; margin-bottom: 6pt; padding-bottom: 6pt; border-bottom: 2px solid #3b82f6; color: #1e3a5f; }
  h2 { font-size: 15pt; margin-top: 22pt; margin-bottom: 8pt; padding-bottom: 4pt; border-bottom: 1px solid #d1d5db; color: #1e3a5f; }
  h3 { font-size: 12pt; margin-top: 16pt; margin-bottom: 6pt; color: #1e3a5f; }
  h4 { font-size: 10.5pt; margin-top: 12pt; margin-bottom: 4pt; color: #374151; }

  p  { margin-bottom: 8pt; }
  ul, ol { margin: 6pt 0 10pt 20pt; }
  li { margin-bottom: 3pt; }

  a { color: #2563eb; text-decoration: none; }
  a:hover { text-decoration: underline; }

  blockquote {
    margin: 10pt 0;
    padding: 8pt 12pt;
    border-left: 3px solid #3b82f6;
    background: #eff6ff;
    border-radius: 0 4px 4px 0;
    color: #374151;
  }
  blockquote p { margin: 0; }

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

  img {
    max-width: 100%;
    height: auto;
    display: block;
    margin: 12pt auto;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    box-shadow: 0 1px 4px rgba(0,0,0,0.10);
  }

  hr {
    border: none;
    border-top: 1px solid #e5e7eb;
    margin: 18pt 0;
  }

  @media print {
    body { max-width: 100%; padding: 20mm 22mm; }
    h2 { page-break-before: auto; }
    h2:first-of-type { page-break-before: avoid; }
    img, table, blockquote { page-break-inside: avoid; }
    a { color: #1e3a5f; }
  }
`;

// ---------------------------------------------------------------------------
// Helper: wrap parsed HTML in a full page
// ---------------------------------------------------------------------------

function buildPage(title: string, bodyHtml: string): string {
	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title>
<style>${CSS}</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Helper: replace image references with base64 data URIs (for PDF only)
// ---------------------------------------------------------------------------

function embedImages(markdown: string, screenshotsDir: string): string {
	return markdown.replace(
		/!\[([^\]]*)\]\(screenshots\/([^)]+)\)/g,
		(_, alt, filename) => {
			const imgPath = path.join(screenshotsDir, filename);
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
}

// ---------------------------------------------------------------------------
// Helper: copy a file from WSL /tmp to a Windows NTFS path via PowerShell.
// Playwright's Chromium subprocess cannot write directly to /mnt/c/... paths.
// ---------------------------------------------------------------------------

function wslCopyToWindows(tmpPath: string, destPath: string): void {
	const winDest = destPath.replace('/mnt/c/', 'C:\\').replace(/\//g, '\\');
	const tmpFilename = path.basename(tmpPath);
	const wslSrc = `\\\\wsl.localhost\\Ubuntu\\tmp\\${tmpFilename}`;

	spawnSync('powershell.exe', ['-Command', `attrib -r '${winDest}'`]);

	const result = spawnSync('powershell.exe', [
		'-Command',
		`Copy-Item -Path '${wslSrc}' -Destination '${winDest}' -Force`,
	]);

	if (result.status !== 0) {
		const stderr = result.stderr?.toString().trim();
		const isLocked = stderr?.includes('being used by another process');
		if (isLocked) {
			const filename = path.basename(destPath);
			throw new Error(
				`Cannot write ${filename} — the file is open in another application.\n` +
				`Close it and run 'npm run docs:build' again.`,
			);
		}
		throw new Error(`PowerShell Copy-Item failed (exit ${result.status}): ${stderr}`);
	}

	fs.unlinkSync(tmpPath);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

console.log('Launching Chromium…');
const browser = await chromium.launch();

for (const doc of DOCS) {
	const label = path.basename(doc.md);
	console.log(`\nProcessing ${label}…`);

	const markdown = fs.readFileSync(doc.md, 'utf-8');

	// Fresh Marked instance per document so the heading-ID seen-set resets.
	const md = new Marked({ gfm: true, renderer: buildRenderer() });

	// ── HTML output ────────────────────────────────────────────────────────
	// Relative image paths (e.g. screenshots/foo.png) work fine from disk
	// since the HTML file lives in the same directory as the screenshots folder.
	const htmlBody = await md.parse(markdown);
	const htmlPage = buildPage(doc.title, htmlBody);
	fs.writeFileSync(doc.html, htmlPage, 'utf-8');
	console.log(`  ✓ HTML → ${path.relative(ROOT, doc.html)}`);

	// ── PDF output ─────────────────────────────────────────────────────────
	// Images must be base64-embedded because page.setContent() has no file://
	// origin context for relative paths.
	const mdForPdf = doc.screenshotsDir ? embedImages(markdown, doc.screenshotsDir) : markdown;
	const pdfMd    = new Marked({ gfm: true, renderer: buildRenderer() });
	const pdfBody  = await pdfMd.parse(mdForPdf);
	const pdfPage  = buildPage(doc.title, pdfBody);

	const tmpPdf = `/tmp/${path.basename(doc.pdf)}`;
	const page   = await browser.newPage();
	await page.setContent(pdfPage, { waitUntil: 'networkidle' });
	await page.pdf({
		path: tmpPdf,
		format: 'A4',
		margin: { top: '0', right: '0', bottom: '0', left: '0' },
		printBackground: true,
		displayHeaderFooter: true,
		headerTemplate: '<div></div>',
		footerTemplate: `
			<div style="font-size:8pt; color:#9ca3af; width:100%; text-align:center; padding-bottom:4mm;">
				${doc.title} &nbsp;·&nbsp;
				<span class="pageNumber"></span> / <span class="totalPages"></span>
			</div>`,
	});
	await page.close();

	wslCopyToWindows(tmpPdf, doc.pdf);
	console.log(`  ✓ PDF  → ${path.relative(ROOT, doc.pdf)}`);
}

await browser.close();
console.log('\nDone.');
