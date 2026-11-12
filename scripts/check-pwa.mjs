// Installability check (Lighthouse 12 removed its PWA category): asks Chromium directly.
import { chromium } from '@playwright/test';
const url = process.argv[2] ?? 'http://localhost:4173/';
const b = await chromium.launch();
const p = await b.newPage();
await p.goto(url);
await p.evaluate(() => navigator.serviceWorker.ready);
await p.waitForTimeout(1000);
const cdp = await p.context().newCDPSession(p);
const inst = await cdp.send('Page.getInstallabilityErrors');
const man = await cdp.send('Page.getAppManifest');
const info = await p.evaluate(() => ({ controlled: !!navigator.serviceWorker.controller, themeColor: !!document.querySelector('meta[name=theme-color]'), appleIcon: !!document.querySelector('link[rel=apple-touch-icon]'), viewport: document.querySelector('meta[name=viewport]')?.getAttribute('content') }));
console.log({ installabilityErrors: inst.installabilityErrors, manifestErrors: man.errors, manifestUrl: man.url, ...info });
await b.close();
process.exit(inst.installabilityErrors.length || man.errors.length ? 1 : 0);
