// Runs Lighthouse (accessibility, best practices, performance) on each screen of a running preview.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
const base = process.argv[2] ?? 'http://localhost:4173/';
const screens = ['today', 'trends', 'gym', 'plan', 'tests', 'more', 'more/data', 'more/reminders'];
let fail = false;
for (const s of screens) {
  const out = `lighthouse-${s.replace('/', '_')}.json`;
  execFileSync('npx', ['lighthouse', `${base}#/${s}`, '--quiet', '--chrome-flags=--headless=new --no-sandbox', '--only-categories=accessibility,best-practices,performance', '--output=json', `--output-path=${out}`], { stdio: 'ignore' });
  const j = JSON.parse(readFileSync(out, 'utf8'));
  const sc = Object.fromEntries(Object.entries(j.categories).map(([k, v]) => [k, Math.round(v.score * 100)]));
  console.log(s.padEnd(16), sc);
  if (sc.accessibility < 100) fail = true;
}
process.exit(fail ? 1 : 0);
