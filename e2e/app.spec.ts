import { expect, test, type Page } from '@playwright/test';
import { spawn } from 'node:child_process';

// Taps go through the touchscreen on touch devices (iPhone 15 Pro / Pixel), mouse on desktop.
async function press(page: Page, loc: ReturnType<Page['locator']>) {
  const touch = await page.evaluate(() => matchMedia('(pointer: coarse)').matches);
  if (touch) await loc.tap();
  else await loc.click();
}

async function fresh(page: Page) {
  await page.goto('/#/today');
  await expect(page.getByRole('heading', { name: 'Elbow Rehab' })).toBeVisible();
}

const scale = (page: Page, name: string) => page.locator(`[data-scale="${name}"]`);

test('tap every pain number 0-10: each is selected, saved, and survives reload', async ({ page }) => {
  await fresh(page);
  for (let v = 0; v <= 10; v++) {
    await press(page, page.getByRole('button', { name: /Morning check-in/ }));
    // After the first pass the flow resumes at the first unanswered question; step back to pain
    if (v > 0) {
      await expect(page.getByRole('heading', { name: 'What does it feel like?' })).toBeVisible();
      await press(page, page.getByRole('button', { name: 'Previous question' }));
    }
    await expect(page.getByRole('heading', { name: 'Morning pain on waking' })).toBeVisible();
    await press(page, scale(page, 'painAM').getByRole('button', { name: `Morning pain on waking: ${v}`, exact: true }));
    // Auto-advances to the next question once saved
    await expect(page.getByRole('heading', { name: 'What does it feel like?' })).toBeVisible();
    await press(page, page.getByRole('button', { name: 'Previous question' }));
    const btns = scale(page, 'painAM').getByRole('button');
    await expect(btns).toHaveCount(11);
    for (let j = 0; j <= 10; j++) await expect(btns.nth(j)).toHaveAttribute('aria-pressed', j === v ? 'true' : 'false');
    await press(page, page.getByRole('button', { name: 'Close' }));
    await expect(page.getByRole('button', { name: /Morning check-in/ })).toContainText(`Pain ${v}/10`);
  }
  await page.reload();
  await expect(page.getByRole('button', { name: /Morning check-in/ })).toContainText('Pain 10/10');
});

test('evening flow: each pain step saves, undo works', async ({ page }) => {
  await fresh(page);
  await press(page, page.getByRole('button', { name: /Evening check-in/ }));
  await press(page, scale(page, 'painRehab').getByRole('button', { name: 'Pain during rehab: 2', exact: true }));
  await press(page, scale(page, 'painWorst').getByRole('button', { name: 'Worst pain today: 5', exact: true }));
  await press(page, scale(page, 'painPM').getByRole('button', { name: 'Evening pain: 3', exact: true }));
  await expect(page.getByRole('heading', { name: 'Daily tasks' })).toBeVisible();
  // Undo the last value from the toast
  await press(page, page.getByRole('button', { name: 'Undo' }));
  await press(page, page.getByRole('button', { name: 'Close' }));
  const card = page.getByRole('button', { name: /Evening check-in/ });
  await expect(card).toContainText('Rehab 2 · worst 5');
  await expect(card).not.toContainText('evening 3');
  // Status reflects the 48 h target
  await expect(page.getByText('Slightly above target (5/10). Hold')).toBeVisible();
});

test('a pain tap works right after typing in a text field (keyboard open on iPhone)', async ({ page }) => {
  await page.goto('/#/tests');
  const finger = page.getByLabel('Most painful finger');
  await press(page, finger);
  await finger.fill('4th (ring)');
  const b = scale(page, 'test.ecrb').getByRole('button', { name: 'ECRB pain: 7', exact: true });
  await press(page, b);
  await expect(b).toHaveAttribute('aria-pressed', 'true');
});

test('tick exercises and see adherence; persists after reload', async ({ page }) => {
  await fresh(page);
  for (const name of ['Hammer curl with radial deviation', 'Supination with dumbbell', 'Finger extension with a band']) {
    const box = page.getByRole('checkbox', { name: `Done: ${name}` });
    await press(page, box);
    await expect(box).toHaveAttribute('aria-checked', 'true');
  }
  await expect(page.getByText('100% of priority done')).toBeVisible();
  await page.reload();
  await expect(page.getByText('100% of priority done')).toBeVisible();
  await expect(page.getByRole('checkbox', { name: 'Done: Supination with dumbbell' })).toHaveAttribute('aria-checked', 'true');
});

test('log a gym day from the calendar with type and elbow load', async ({ page }) => {
  await page.goto('/#/gym');
  const today = await page.evaluate(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const cell = page.locator(`[data-date="${today}"]`);
  await press(page, cell);
  await expect(cell).toHaveAttribute('aria-pressed', 'true');
  const pull = page.getByRole('group', { name: 'Session type' }).getByRole('button', { name: 'Pull' });
  const high = page.getByRole('group', { name: 'Elbow load' }).getByRole('button', { name: 'High' });
  await press(page, pull);
  await expect(pull).toHaveAttribute('aria-pressed', 'true');
  await press(page, high);
  // Selected state is rendered from IndexedDB, so this also proves the write committed
  await expect(high).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await expect(cell).toHaveAttribute('aria-pressed', 'true');
  await expect(cell).toContainText('Pl');
  await page.goto('/#/today');
  await expect(page.getByRole('switch', { name: /Trained today/ })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('group', { name: 'Elbow load' }).getByRole('button', { name: 'High' })).toHaveAttribute('aria-pressed', 'true');
});

test('guided session: hold timer, rest, set logged', async ({ page }) => {
  await page.clock.install();
  await fresh(page);
  await press(page, page.getByRole('button', { name: /Start guided session/ }));
  await expect(page.getByRole('heading', { name: 'Hammer curl with radial deviation', exact: true })).toBeVisible();
  await press(page, page.getByRole('button', { name: /Start set 1/ }));
  await expect(page.getByText('Get into position')).toBeVisible();
  await page.clock.runFor(3500);
  await expect(page.getByRole('timer', { name: /^Hold/ })).toBeVisible();
  await page.clock.runFor(41_000);
  await expect(page.getByRole('timer', { name: /^Rest/ })).toBeVisible();
  await press(page, page.getByRole('button', { name: 'Close' }));
  await expect(page.getByText('ECRL · 1 set')).toBeVisible();
});

test('offline: with the server gone, the app reloads from the service worker and still saves', async ({ page }, info) => {
  // A private server we can kill: a real "no network" for every engine. (Playwright's setOffline
  // in WebKit blocks navigations before the service worker can answer, so it can't test this.)
  const port = 4300 + info.workerIndex * 7 + (info.project.name.length % 7);
  const srv = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], { detached: true, stdio: 'ignore' });
  try {
    const url = `http://localhost:${port}/`;
    await expect.poll(async () => (await fetch(url).then((r) => r.ok).catch(() => false)), { timeout: 20_000 }).toBe(true);
    await page.goto(url + '#/today');
    await expect(page.getByRole('heading', { name: 'Elbow Rehab' })).toBeVisible();
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 15_000 });
    process.kill(-srv.pid!);
    await expect.poll(async () => (await fetch(url).then(() => true).catch(() => false)), { timeout: 10_000 }).toBe(false);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Elbow Rehab' })).toBeVisible();
    const box = page.getByRole('checkbox', { name: 'Done: Supination with dumbbell' });
    await press(page, box);
    await expect(box).toHaveAttribute('aria-checked', 'true');
    await page.goto(url + '#/trends');
    await expect(page.getByRole('heading', { name: 'Pain', exact: true })).toBeVisible();
    await page.goto(url + '#/today');
    await expect(box).toHaveAttribute('aria-checked', 'true');
  } finally {
    try {
      process.kill(-srv.pid!);
    } catch {
      /* already stopped */
    }
  }
});

test('import the prototype backup', async ({ page }) => {
  await page.goto('/#/more/data');
  const backup = {
    settings: { side: 'Left', phase: 'reduce', mode: 'iso', start: '2026-11-12', remindOn: true, t1: '08:00', t2: '20:00' },
    days: { '2026-11-10': { painAM: 6, painWorst: 8, flare: true, gym: true, gymType: 'Pull', gymElbow: 'High', _t: 1 } },
    assess: null,
    prtee: [],
  };
  await page.getByLabel('Or paste the backup text').fill(JSON.stringify(backup));
  await press(page, page.getByRole('button', { name: 'Import pasted text' }));
  await expect(page.getByText(/Read 1 days/)).toBeVisible();
  await page.goto('/#/today/2026-11-10');
  await expect(page.getByRole('button', { name: /Morning check-in/ })).toContainText('Pain 6/10');
});
