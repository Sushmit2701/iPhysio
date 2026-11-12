# Elbow Rehab

A personal, local-first app for rehabbing lateral elbow tendinopathy: quick morning and evening check-ins, guided exercise sessions, trends, gym impact, the movement screen and weekly PRTEE. It installs to the iPhone home screen and works offline.

It is for one person (me). It is guidance built from a coaching video, not a diagnosis. The numeric rules are practical guidance. Seek review for night pain, numbness, weakness, shooting pain or worsening.

**Privacy:** no analytics, no trackers, no third-party requests (an e2e test enforces this). Fonts are bundled. Data stays in the browser's IndexedDB on the device unless you switch on sync, which only talks to your own Supabase project.

---

## Run it

Needs Node 22.

```bash
npm install
```

```bash
npm run dev
```

Open the printed URL. To try it on your phone on the same Wi-Fi, run `npm run dev -- --host` and open the network URL (service worker and install need HTTPS, so use the deployed site for that).

## Test

| What | Command |
|---|---|
| Unit tests (logic, import/export, merge, storage, sync merge) | `npm test` |
| Typecheck | `npm run typecheck` |
| End-to-end, Chromium desktop + Android emulation + **WebKit as iPhone 15 Pro with touch** | `npm run e2e` |
| Sync SQL (RLS and newer-wins), needs a local Postgres | `npm run test:sql` |
| Lighthouse accessibility, best practices, performance (needs `npm run preview` running) | `npm run lighthouse` |
| PWA installability via Chromium's own check (needs `npm run preview` running) | `npm run check:pwa` |

First time on a new machine, install the Playwright browsers:

```bash
npx playwright install --with-deps chromium webkit
```

The unit tests include a differential test: it loads the `/*LOGIC*/` block straight out of `docs/v1-prototype.html` and checks that the new code gives identical answers on 300 random datasets (ranking, peaks, 7-day average, streaks, target status, advance criteria, gym impact, PRTEE).

The e2e suite covers: tapping every pain number 0 to 10 and seeing it selected and saved; the evening flow with undo; a tap straight after typing in a text field; ticking exercises; logging a gym day; persistence across reload; guided-session timers; offline reload with the server stopped; importing a prototype backup; and no foreign network requests.

## Deploy (GitHub Pages)

1. Create a GitHub repository, for example `elbow-rehab`. Only code goes in it, never your health data, so a public repo is fine (Pages on a free plan needs one).
2. Push this folder to it:

   ```bash
   git remote add origin git@github.com:<you>/elbow-rehab.git
   ```

   ```bash
   git push -u origin main
   ```

3. In the repo: **Settings → Pages → Source: GitHub Actions**.
4. The workflow in `.github/workflows/deploy.yml` runs typecheck, unit and e2e tests, then publishes to `https://<you>.github.io/elbow-rehab/`. It sets `BASE_PATH` to the repo name automatically.

Netlify or Vercel also work: build command `npm run build`, output `dist`, no `BASE_PATH` needed at a domain root.

## Install on your iPhone

1. Open the deployed URL in **Safari**.
2. Share button → **Add to Home Screen** (keep "Open as Web App" on).
3. Open it from the home screen icon and use it from there.

Safari tabs and the home-screen app have **separate storage** on iPhone. Log from the home-screen app. If you entered anything in a Safari tab, export it and import it in the app.

iPhone can clear data for sites not opened for a few weeks. Home-screen apps are treated better and the app asks for persistent storage, but export a backup now and then (More → Backup and data), or turn on sync.

## Import your prototype backup

In the prototype: Data tab → **Copy backup**. Then in the new app: **More → Backup and data → Import**, and either paste the text or choose a saved `.json` file.

- **Merge (default)** keeps whichever copy of each day was edited last, so it is safe to run more than once.
- **Overwrite** replaces anything in the backup even if this device has a newer edit.

All fields of the prototype format `{ settings, days, assess, prtee }` are mapped. Out-of-range values are dropped, not guessed. Export gives JSON (re-importable, same shape plus `appts`) and CSV (one row per day).

## Reminders

In order of reliability, all under **More → Reminders**:

1. **Calendar alerts (.ics):** two daily repeating events with alerts at your rehab and evening times. Tap "Add to Calendar", then "Add All". They work with the app closed and offline.
2. **In-app banners** on Today after each time, while the app is open.
3. **Web Push** for the installed app, only with sync on (setup below). iPhone web apps cannot schedule their own notifications, so a server has to send them, and only after the app is on the Home Screen and you allow notifications from inside it.

## Optional: account sync and push (Supabase)

Do this only once the local app is working for you. Takes about 10 minutes.

1. Create a free project at supabase.com.
2. **SQL Editor:** paste and run `supabase/migrations/0001_records.sql`. This creates the `records` table with row-level security (only your account can read or write your rows) and the newer-wins `push_records` function.
3. **Authentication → Emails → Magic Link template:** make sure it includes the code, for example add `Your code: {{ .Token }}`. On iPhone you type the 6-digit code into the app, because the link would open Safari, not the home-screen app.
4. **Authentication → URL Configuration:** set Site URL to your deployed URL.
5. **Authentication → Sign In / Providers:** after you have signed up once, turn off "Allow new users to sign up" so nobody else can create an account in your project.
6. In the app: **More → Account sync**, paste the Project URL and the anon public key (Project Settings → API), then sign in with your email and code. Existing local logs upload on first sign-in.

Alternatively bake the URL and key into the build with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (GitHub repo variables are already wired into the workflow). The anon key is designed to be public. RLS is what protects the data.

**How merging works:** every record carries `updatedAt` (time of the last edit on the device that made it). The server only accepts a write if it is newer than what it has. The app applies pulled rows inside one IndexedDB transaction that re-reads the local row first, so a late or slow sync can never overwrite a newer local edit. Deletes are tombstones, so they sync too. Conflicts resolve per record (a whole day), last edit wins. Device clocks should be roughly right.

### Push reminders (needs sync)

1. Generate VAPID keys:

   ```bash
   npx web-push generate-vapid-keys
   ```

2. Deploy the function with the Supabase CLI:

   ```bash
   supabase functions deploy send-reminders --no-verify-jwt
   ```

3. Set its secrets:

   ```bash
   supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:you@example.com CRON_SECRET=<long random string>
   ```

4. Enable the `pg_cron` and `pg_net` extensions, edit `<PROJECT_REF>` and `<CRON_SECRET>` in `supabase/migrations/0002_push_cron.sql`, and run it. It calls the function every 5 minutes.
5. In the app, add the VAPID **public** key in sync settings, then **More → Reminders → Turn on push reminders**, from the home-screen app.

The function sends the rehab reminder only if your priority exercises are not all ticked, and the evening one only if evening pain is not logged, each at most once a day, within an hour after your set time, in your phone's time zone.

---

## Architecture

```
src/
  domain/      pure logic and content, no UI (ported from the prototype; unit tested)
    logic.ts     ranking, peaks, roll7, PRTEE, adherence, streaks, target status,
                 advance criteria, gym impact, plus advice, phase suggestion, flare runs
    content.ts   phases, tests, exercises, PRTEE items, red-flag text
    backup.ts    import (prototype + v2) and export (JSON, CSV)
    merge.ts     newer-wins merge;  ics.ts  calendar file;  split.ts  train-around week
  db/          Dexie (IndexedDB) schema, write helpers (stamp, outbox, undo), live hooks
  ui/          controls (PainScale, Seg, Toggle, Stepper, Sheet), Chart, toast, haptics
  features/    today (check-in flows), session (guided mode), trends, gym, plan, tests, more
  sync/        Supabase engine, settings, push (lazy-loaded only when sync is on)
  sw.ts        service worker: precache app shell, push, notification click
supabase/      SQL migrations, SQL tests, send-reminders Edge Function
e2e/           Playwright tests
```

**Stack:** Vite 8, React 19, TypeScript, Tailwind CSS 4, Dexie 4, vite-plugin-pwa (injectManifest), Vitest, Playwright. Supabase JS only when sync is on.

**Choices that differ from the brief:**

- **Look:** a soft neumorphic, music-player style (raised and pressed surfaces, violet accent, round controls, the hold timer drawn as a record) in place of the brief's teal accent, as requested later. The green-to-red ramp is still used only for pain values, and every screen scores 100 on Lighthouse accessibility.

- **Hand-written SVG charts instead of Recharts or visx.** A few KB instead of roughly 100 KB, and full control of tap-and-drag inspection on touch, a keyboard path, and a data-table fallback.
- **Hash routing, no router library.** Works on GitHub Pages without rewrites and offline.
- **Email code alongside the magic link,** because the link would sign in Safari, not the home-screen app.
- **The 7-day average on Trends** uses the six days before the visible range, so its left edge is correct. The prototype started the average fresh at the range edge.

**The iPhone tap bug:** I ran the prototype in Playwright's WebKit as an iPhone 15 Pro with real touch events, including tapping right after typing in a field, and every tap registered. So the failure most likely came from the hosted sandbox it ran in (the Claude app or a sandboxed iframe in Safari), possibly combined with the prototype re-rendering the whole page when its cloud data arrived. The new app removes every suspect: each pain value is its own stable `<button>` that React updates in place, `touch-action: manipulation` is set on all controls, nothing re-renders on a timer, and it runs as its own page. Please still confirm on the phone.

**Known limits:**

- Haptics on iPhone use the Safari 18 switch-control trick (there is no vibration API). They need iOS 18+ and System Haptics on, and may not fire on every tap.
- Screen wake lock in home-screen apps needs a recent iOS (18.4+). If the screen dims during a hold, raise auto-lock time.
- Sound cues follow the silent switch.
- Lighthouse 12 has no PWA category any more, so `npm run check:pwa` asks Chromium directly for installability errors.
- The push Edge Function is written for Supabase's Deno runtime but was not run here (no Supabase account in the build environment). The SQL it depends on is tested.
