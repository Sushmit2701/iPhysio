// Renders public/favicon.svg to the PNG icons the manifest and iOS need, using Playwright's Chromium.
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';

const svg = readFileSync('public/favicon.svg', 'utf8');
const maskable = svg.replace('rx="112"', 'rx="0"').replace(/(<path[\s\S]*)<\/svg>/, '<g transform="translate(51 51) scale(0.8)">$1</g></svg>');
const fullBleed = svg.replace('rx="112"', 'rx="0"'); // iOS rounds the corners itself
const jobs = [
  ['public/icon-192.png', svg, 192],
  ['public/icon-512.png', svg, 512],
  ['public/icon-maskable-512.png', maskable, 512],
  ['public/apple-touch-icon.png', fullBleed, 180],
];
const b = await chromium.launch();
const p = await b.newPage();
for (const [out, s, size] of jobs) {
  await p.setViewportSize({ width: size, height: size });
  await p.setContent(`<style>html,body{margin:0;background:transparent}</style>${s.replace('<svg ', `<svg width="${size}" height="${size}" `)}`);
  writeFileSync(out, await p.screenshot({ omitBackground: true }));
}
await b.close();
console.log('icons written');
