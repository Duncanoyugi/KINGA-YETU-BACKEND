import { CoverageReportTemplate } from './coverage-report.template';
import { FacilityReportTemplate } from './facility-report.template';

/**
 * `CoverageReportRequestDto.county` (a free-form, content-unvalidated
 * string from an authenticated user's API request) flows into `title`,
 * which is rendered into raw HTML handed to an HTML-to-PDF renderer
 * (html-pdf / PhantomJS) with known, unpatched engine vulnerabilities and
 * the ability to fetch external resources referenced in the HTML it
 * renders. Unescaped input here is an injection vector and a potential
 * SSRF vector (e.g. an <iframe> pointed at a cloud metadata endpoint).
 *
 * These tests exist because the fix genuinely had gaps on the first
 * pass: a <title> tag interpolation and a duplicate table-cell rendering
 * of the same field were both missed by an earlier code-review sweep and
 * only caught by actually running payloads through the template and
 * checking the output — which is exactly what these tests do on every
 * run going forward.
 */
describe('CoverageReportTemplate HTML escaping', () => {
  const payloads = {
    script: '<script>alert(document.cookie)</script>',
    img: '<img src=x onerror=alert(1)>',
    ssrfIframe: '<iframe src="http://169.254.169.254/latest/meta-data/"></iframe>',
  };

  const html = new CoverageReportTemplate().generate({
    title: `Report - ${payloads.script}`,
    period: 'Jan 2026',
    generatedAt: new Date('2026-01-01'),
    overallCoverage: 82.5,
    targetCoverage: 90,
    coverageGap: 7.5,
    totalChildren: 1000,
    vaccinatedChildren: 825,
    byCounty: [{ county: payloads.img, coverage: 91, children: 100, vaccinated: 91 }],
    recommendations: [payloads.ssrfIframe],
  } as any);

  it('never contains the raw <script> payload anywhere in the output (including the <title> tag)', () => {
    expect(html).not.toContain(payloads.script);
  });

  it('never contains the raw <img onerror> payload from a county name', () => {
    expect(html).not.toContain(payloads.img);
  });

  it('never contains the raw SSRF-shaped <iframe> from a recommendation', () => {
    expect(html).not.toContain(payloads.ssrfIframe);
  });

  it('renders the escaped, inert form of each payload instead', () => {
    expect(html).toContain('&lt;script&gt;alert(document.cookie)');
    expect(html).toContain('&lt;img src=x onerror');
    expect(html).toContain('&lt;iframe src=&quot;http://169.254.169.254');
  });
});

describe('FacilityReportTemplate HTML escaping', () => {
  const html = new FacilityReportTemplate().generate({
    facilityName: '<script>alert(1)</script>',
    county: '<img src=x onerror=alert(2)>',
    subCounty: 'Test</title><script>alert(3)</script>',
    period: 'Jan 2026',
    generatedAt: new Date('2026-01-01'),
    totalImmunizations: 100,
    coverageRate: 80,
    timelinessRate: 70,
    dropoutRate: 5,
    performanceScore: 75,
    monthlyTrends: [{ month: '</script><script>alert(4)</script>', immunizations: 10, coverage: 80 }],
    vaccineBreakdown: [{ vaccineName: '<b>x</b>', count: 5, percentage: 50 }],
    growthRate: 2,
    recommendations: ['<iframe src="http://169.254.169.254/"></iframe>'],
  } as any);

  it('never contains any raw payload: facility name, county, sub-county', () => {
    expect(html).not.toContain('<script>alert(1)');
    expect(html).not.toContain('<img src=x onerror=alert(2)');
    expect(html).not.toContain('<script>alert(3)');
  });

  it('never contains the raw trend-chart month label, in either the table cell or the embedded JSON', () => {
    // Regression: this field is rendered in two separate places (an HTML
    // table cell AND an inline <script> JSON array for the chart) — an
    // earlier pass fixed only the JSON copy and missed the table cell.
    expect(html).not.toContain('<script>alert(4)</script>');
  });

  it('never contains the raw vaccine name or SSRF-shaped recommendation', () => {
    expect(html).not.toContain('<b>x</b>');
    expect(html).not.toContain('<iframe src="http://169.254.169.254');
  });

  it('the inline chart JSON is syntactically safe even though it contains a payload', () => {
    const match = html.match(/const months = (\[.*?\]);/);
    expect(match).not.toBeNull();
    // Must not contain a literal "</script>" that could break out of the
    // surrounding <script> tag.
    expect(match![1]).not.toContain('</script>');
  });
});
