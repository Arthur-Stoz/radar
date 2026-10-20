import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// End-to-end checks on the real database (BUILD.md §9.4), at 1440 px and 390 px.

const isMobile = (page: Page) => (page.viewportSize()?.width ?? 1440) < 1024;

test('home shows real numbers and the design hero', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('New Zealand.');
  await expect(page.getByText(/[\d,]+ jobs from \d+ sources/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Fresh today' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Browse by type' })).toBeVisible();
});

test('type → autocomplete → results → preview → "View on …" link', async ({ page }) => {
  await page.goto('/');
  const box = page.getByRole('combobox', { name: 'Search every job in New Zealand' });
  await box.click();
  await box.pressSequentially('barist', { delay: 40 });
  const option = page.getByRole('option').first();
  await expect(option).toBeVisible();
  await option.click();
  await expect(page).toHaveURL(/\/search\?q=/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/jobs? for/i);

  const firstCard = page.locator('[data-job-id]').first();
  await expect(firstCard).toBeVisible();
  const id = await firstCard.getAttribute('data-job-id');
  await firstCard.click();
  const apply = isMobile(page) ? page.getByRole('dialog').locator('a[data-apply]') : page.locator('aside a[data-apply]');
  await expect(apply).toBeVisible();
  await expect(apply).toHaveText(/View on .+/);
  await expect(apply).toHaveAttribute('href', `/go/${id}`);
  await expect(apply).toHaveAttribute('target', '_blank');
});

test('/go redirects to the original ad on a known host', async ({ page, request }) => {
  await page.goto('/search?q=nurse');
  const id = await page.locator('[data-job-id]').first().getAttribute('data-job-id');
  const res = await request.get(`/go/${id}`, { maxRedirects: 0 });
  expect(res.status()).toBe(302);
  expect(res.headers()['location']).toMatch(/^https:\/\//);
  const bad = await request.get('/go/not-a-real-id', { maxRedirects: 0 });
  expect(bad.headers()['location']).toContain('/job/not-a-real-id');
});

test('filters update the URL and the results', async ({ page }) => {
  await page.goto('/search?q=chef');
  const heading = page.getByRole('heading', { level: 1 });
  const before = await heading.textContent();
  await page.getByRole('button', { name: 'Job type' }).click();
  await page.getByRole('dialog', { name: 'Job type' }).getByLabel(/Part time/).click();
  await expect(page).toHaveURL(/type=part-time/);
  await expect(heading).not.toHaveText(before || '');
});

/** Opens a filter pill, applies one option, checks the URL + removable chip, then removes it with the chip. */
async function checkFilter(page: Page, pill: string, option: RegExp, param: RegExp, chip: RegExp) {
  await page.getByRole('button', { name: pill, exact: true }).click();
  const dialog = page.getByRole('dialog', { name: pill });
  await expect(dialog).toBeVisible();
  await dialog.locator('label').filter({ hasText: option }).first().click();
  await expect(page).toHaveURL(param);
  await page.keyboard.press('Escape'); // checkbox filters stay open (and the pill, so the dialog, takes the new label)
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const remove = page.getByRole('button', { name: chip });
  await expect(remove).toBeVisible();
  await expect(page.locator('[data-job-id]').first()).toBeVisible();
  await remove.click();
  await expect(page).not.toHaveURL(param);
}

test('every filter: region, town, type, pay, posted, perks, source', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/search?q=barista');
  await checkFilter(page, 'Location', /^Auckland/, /loc=auckland(&|$)/, /^Remove filter Auckland$/);
  // A town: open its region, then pick the town.
  await page.getByRole('button', { name: 'Location', exact: true }).click();
  await page.getByRole('dialog', { name: 'Location' }).locator('label').filter({ hasText: /^Canterbury/ }).click();
  await expect(page).toHaveURL(/loc=canterbury/);
  await page.getByRole('dialog', { name: 'Canterbury' }).locator('label').filter({ hasText: /^Christchurch/ }).click();
  await expect(page).toHaveURL(/loc=christchurch(&|$)/);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /^Remove filter Christchurch$/ }).click();
  await expect(page).not.toHaveURL(/loc=/);

  await checkFilter(page, 'Job type', /^Full time/, /type=full-time/, /^Remove filter Full time$/);
  await checkFilter(page, 'Pay', /^\$25\+\/h/, /pay=25/, /^Remove filter \$25\+\/h$/);
  await checkFilter(page, 'Posted', /^Last 7 days/, /posted=7d/, /^Remove filter Last 7 days$/);
  await checkFilter(page, 'Perks', /^No experience/, /tags=no-experience/, /^Remove filter No experience$/);
  await checkFilter(page, 'Source', /^Trade Me/, /source=trademe/, /^Remove filter Trade Me$/);
});

test('sort is a real menu: keyboard, checked option, Esc, outside click, URL', async ({ page }) => {
  await page.goto('/search?q=chef');
  const button = page.getByRole('button', { name: /^Sort results: Best match$/ });
  await expect(button).toBeVisible();
  await button.focus();
  await page.keyboard.press('ArrowDown');
  const list = page.getByRole('listbox', { name: 'Sort results' });
  await expect(list).toBeVisible();
  await expect(list.getByRole('option', { name: 'Best match' })).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('Escape');
  await expect(list).toHaveCount(0);
  await button.click();
  await list.getByRole('option', { name: 'Newest' }).click();
  await expect(page).toHaveURL(/sort=new/);
  await expect(page.getByRole('button', { name: /^Sort results: Newest$/ })).toBeVisible();
  // Readable in both themes, and an outside click closes it.
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.getByRole('button', { name: /^Sort results/ }).click();
    await expect(list).toBeVisible();
    const [fg, bg] = await list.evaluate((el) => [getComputedStyle(el).color, getComputedStyle(el).backgroundColor]);
    expect(fg).not.toBe(bg);
    await page.getByRole('heading', { level: 1 }).click();
    await expect(list).toHaveCount(0);
  }
});

test('floating layers sit above the page and inside the viewport', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Match with your CV' }).click();
  const dialog = page.getByRole('dialog', { name: 'Match with your CV' });
  await expect(dialog).toBeVisible();
  await page.waitForTimeout(250);
  const covered = await dialog.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const pts = [
      [r.left + 20, r.top + 20],
      [r.right - 20, r.top + 20],
      [r.left + r.width / 2, r.bottom - 20],
    ];
    return pts.filter(([x, y]) => !el.contains(document.elementFromPoint(x, y))).length;
  });
  expect(covered).toBe(0);
  const box = await dialog.boundingBox();
  const vp = page.viewportSize()!;
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(vp.width);
  expect(box!.y + box!.height).toBeLessThanOrEqual(vp.height + 1);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
});

test('home: the search bar is fully visible near the middle of the first screen', async ({ page }) => {
  await page.goto('/');
  const bar = await page.locator('form[role=search]').first().boundingBox();
  const vp = page.viewportSize()!;
  expect(bar!.y).toBeGreaterThan(0);
  expect(bar!.y + bar!.height).toBeLessThan(vp.height);
  expect(Math.abs(bar!.y + bar!.height / 2 - vp.height / 2)).toBeLessThan(vp.height * 0.15);
  // No horizontal overflow on phones (the decorative radar used to widen the page).
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(vp.width);
});

test('typos are corrected and query chips can be removed', async ({ page }) => {
  await page.goto('/search?q=barrista%20auckand');
  await expect(page.getByText('Showing results for')).toBeVisible();
  await page.goto('/search?q=barista%20auckland');
  const chip = page.getByRole('button', { name: 'Remove Auckland' });
  await expect(chip).toBeVisible();
  await chip.click();
  await expect(page).toHaveURL(/q=barista$/);
});

test('CV upload (PDF) → match pills appear', async ({ page }) => {
  test.setTimeout(120_000);
  // Record everything the page sends: the CV text must never leave the device.
  const sent: string[] = [];
  page.on('request', (r) => {
    const body = r.postData();
    if (body) sent.push(`${r.url()} ${body}`);
  });
  await page.goto('/search');
  await page.getByRole('button', { name: 'Match with your CV' }).click();
  await page.getByTestId('cv-file').setInputFiles(join(__dirname, '..', 'fixtures', 'cv-hospitality.pdf'));
  const dialog = page.getByRole('dialog', { name: 'Match with your CV' });
  await expect(dialog.getByRole('button', { name: 'Remove Barista' })).toBeVisible({ timeout: 90_000 });
  await dialog.getByRole('button', { name: 'Show my matches' }).click();
  await expect(page).toHaveURL(/cv=1/);
  await expect(page.getByText('Matching your CV')).toBeVisible();
  await expect(page.locator('[data-job-id]').first()).toContainText(/\d+% match/);
  const match = sent.find((s) => s.includes('/api/match'));
  expect(match).toBeTruthy();
  expect(match).toContain('"vector"');
  for (const s of sent) expect(s).not.toMatch(/Camille|Brasserie|camille\.durand/);
  await page.getByRole('button', { name: 'Clear CV' }).first().click();
  await expect(page).not.toHaveURL(/cv=1/);
});

for (const file of ['cv-hospitality.docx', 'cv-hospitality.txt']) {
  test(`CV upload (${file.split('.').pop()!.toUpperCase()}) → chips`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('/search');
    await page.getByRole('button', { name: 'Match with your CV' }).click();
    await page.getByTestId('cv-file').setInputFiles(join(__dirname, '..', 'fixtures', file));
    await expect(page.getByRole('dialog', { name: 'Match with your CV' }).getByRole('button', { name: 'Remove Barista' })).toBeVisible({ timeout: 90_000 });
  });
}

test('CV pasted while the matcher model is unavailable → keyword matching still works', async ({ page }) => {
  test.setTimeout(120_000);
  await page.route('**/cv-assets/models/**', (r) => r.abort());
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('/search');
  await page.getByRole('button', { name: 'Match with your CV' }).click();
  const dialog = page.getByRole('dialog', { name: 'Match with your CV' });
  await dialog.getByRole('button', { name: 'or paste it' }).click();
  await dialog.getByLabel('Paste your CV').fill(readFileSync(join(__dirname, '..', 'fixtures', 'cv-hospitality.txt'), 'utf8'));
  await dialog.getByRole('button', { name: 'Use this text' }).click();
  await expect(dialog.getByText(/matched on these skills and titles only/)).toBeVisible({ timeout: 90_000 });
  await dialog.getByRole('button', { name: 'Show my matches' }).click();
  await expect(page.locator('[data-job-id]').first()).toContainText(/\d+% match/);
  expect(errors.some((e) => e.includes('[cv]'))).toBe(true); // the real cause is logged
});

test('CV errors are specific (too big, unsupported type)', async ({ page }) => {
  await page.goto('/search');
  await page.getByRole('button', { name: 'Match with your CV' }).click();
  const input = page.getByTestId('cv-file');
  await input.setInputFiles({ name: 'big.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(6 * 1024 * 1024, 32) });
  const dialog = page.getByRole('dialog', { name: 'Match with your CV' });
  await expect(dialog.getByRole('alert')).toContainText('the limit is 5 MB');
  await input.setInputFiles({ name: 'cv.odt', mimeType: 'application/vnd.oasis.opendocument.text', buffer: Buffer.from('hello') });
  await expect(dialog.getByRole('alert')).toContainText('PDF, DOCX and TXT');
});

test('mobile bottom sheet closes with the back button', async ({ page }) => {
  test.skip(!isMobile(page), 'mobile only');
  await page.goto('/search?q=barista');
  await page.locator('[data-job-id]').first().click();
  const sheet = page.getByRole('dialog').filter({ has: page.locator('a[data-apply]') });
  await expect(sheet).toBeVisible();
  await page.goBack();
  await expect(sheet).toHaveCount(0);
  await expect(page).toHaveURL(/q=barista/);
});

test('dark mode follows the system and the toggle', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bg).toBe('rgb(11, 11, 10)');
  await page.getByRole('button', { name: /Theme: system/ }).click(); // → light
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('job page and closed / unknown jobs', async ({ page }) => {
  await page.goto('/search?q=electrician');
  const id = await page.locator('[data-job-id]').first().getAttribute('data-job-id');
  await page.goto(`/job/${id}`);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.locator('a[data-apply]')).toHaveAttribute('href', `/go/${id}`);
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', /opengraph-image/);
  const res = await page.goto('/job/does-not-exist');
  expect(res?.status()).toBe(404);
  await expect(page.getByText('This page went off the radar.')).toBeVisible();
});

test('status page lists every source with live counts', async ({ page }) => {
  await page.goto('/status');
  await expect(page.getByRole('heading', { name: 'Status' })).toBeVisible();
  for (const name of ['Seek', 'Trade Me', 'NZ Government Jobs']) await expect(page.getByRole('link', { name, exact: true })).toBeVisible();
  await expect(page.getByText(/live jobs · database built/)).toBeVisible();
});

test('health endpoint', async ({ request }) => {
  const r = await request.get('/api/health');
  expect(r.ok()).toBe(true);
  const j = await r.json();
  expect(j.ok).toBe(true);
  expect(j.jobs).toBeGreaterThan(1000);
});
