/**
 * Report templates build raw HTML strings via template literals and hand
 * that HTML to an HTML-to-PDF renderer (see ReportGeneratorService). Any
 * dynamic string interpolated into that HTML *without* escaping is an
 * HTML/script-injection point into whatever engine renders it — and since
 * that engine (html-pdf, wrapping the long-unmaintained PhantomJS/WebKit)
 * has known, unpatched vulnerabilities and can fetch external resources
 * referenced in the HTML it renders, unescaped input here is both an
 * injection risk and a potential SSRF vector, not just a cosmetic bug.
 *
 * Some of these values come directly from API request bodies (e.g.
 * CoverageReportRequestDto.county is a free-form, format-unvalidated
 * string used to build the report title) rather than from trusted,
 * admin-curated reference data — so this needs to hold regardless of the
 * rendering engine used.
 */

/** Escapes a string for safe interpolation into HTML markup. */
export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * JSON.stringify's output can legally contain a `</script>` sequence
 * (inside a string value), which would prematurely close an inline
 * <script> tag the JSON is embedded in and let the rest of the string be
 * interpreted as markup/script. Escaping `<` inside the JSON output
 * (valid inside a JS string literal) neutralises that without changing
 * the decoded value.
 */
export function safeJsonForScript(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}
