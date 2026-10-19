import { expect, test, type Page } from '@playwright/test';
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
  // Sort is in the URL too.
  await page.keyboard.press('Escape');
  await page.locator('select[aria-label="Sort results"]:visible').selectOption('new');
  await expect(page).toHaveURL(/sort=new/);
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
