/**
 * Client-side download utilities.
 *
 * triggerDownload — creates a Blob + object URL, simulates an anchor click,
 *   then revokes the URL to avoid memory leaks.
 *
 * downloadPng — converts an ECharts base64 data URL to a Blob download.
 */

/**
 * Trigger a browser file-download from an ArrayBuffer or Blob.
 *
 * @param data     The file contents.
 * @param filename The suggested filename presented to the browser.
 * @param mime     The MIME type (e.g. 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').
 */
export function triggerDownload(data: ArrayBuffer | Blob, filename: string, mime: string): void {
	const blob = data instanceof Blob ? data : new Blob([data], { type: mime });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	a.style.display = 'none';
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}

/**
 * Return the current date in YYYY-MM-DD format using the user's **local** timezone.
 *
 * `new Date().toISOString()` returns UTC — for users in UTC−N timezones this
 * rolls over to tomorrow's date before midnight local time.  This helper uses
 * `toLocaleDateString('en-CA')` which produces the ISO-format local date.
 */
export function localDateString(): string {
	return new Date().toLocaleDateString('en-CA'); // en-CA locale → YYYY-MM-DD
}

/**
 * Trigger a browser PNG download from an ECharts `getDataURL()` base64 string.
 *
 * @param dataUrl  The base64 PNG data URL returned by `chart.getDataURL()`.
 * @param filename The suggested filename (e.g. 'heart-rate-2026-05-26.png').
 */
export function downloadPng(dataUrl: string, filename: string): void {
	// Convert base64 data URL to Blob
	const [header, base64] = dataUrl.split(',');
	const mime = header.match(/:(.*?);/)?.[1] ?? 'image/png';
	const binary = atob(base64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	const blob = new Blob([bytes], { type: mime });
	triggerDownload(blob, filename, mime);
}
