// Supabase Edge Function (Deno). Runs every 5 minutes via pg_cron (see migrations/0002).
// For each push subscription it checks the user's own settings and today's log, and sends
//   - the rehab reminder at t1 if the priority exercises are not all ticked,
//   - the evening reminder at t2 if evening pain is not logged,
// at most once per day each. Secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, CRON_SECRET.
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const ORDER = ['ecrl', 'ecrb', 'ecu', 'sup', 'ed', 'nerve'];
// Same rule as the app: top 3 scores, ties by test order, nerve only at 3+.
function priorities(scores: Record<string, number | null>): string[] {
  return ORDER.map((k, i) => ({ k, i, s: scores?.[k] }))
    .filter((x) => typeof x.s === 'number' && x.s > 0 && (x.k !== 'nerve' || x.s >= 3))
    .sort((a, b) => (b.s as number) - (a.s as number) || a.i - b.i)
    .slice(0, 3)
    .map((x) => x.k);
}
const SEED = { ecrl: 8, ecrb: 4, ecu: 4, sup: 8, ed: 8, nerve: null };

function localParts(tz: string, d = new Date()) {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, minutes: (Number(p.hour) % 24) * 60 + Number(p.minute) };
}
const mins = (hm: string) => Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3, 5));
const due = (now: number, at: string) => now >= mins(at) && now < mins(at) + 60; // within the hour after the time

Deno.serve(async (req) => {
  if (req.headers.get('x-cron-secret') !== Deno.env.get('CRON_SECRET')) return new Response('forbidden', { status: 403 });
  webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT')!, Deno.env.get('VAPID_PUBLIC_KEY')!, Deno.env.get('VAPID_PRIVATE_KEY')!);
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: subs, error } = await db.from('push_subs').select('*').eq('enabled', true);
  if (error) return new Response(error.message, { status: 500 });
  let sent = 0;
  for (const s of subs ?? []) {
    const { date, minutes } = localParts(s.tz);
    const { data: recs } = await db
      .from('records')
      .select('kind,id,data,deleted')
      .eq('user_id', s.user_id)
      .or(`and(kind.eq.settings,id.eq.settings),and(kind.eq.days,id.eq.${date}),kind.eq.assess`);
    const settings = recs?.find((r) => r.kind === 'settings')?.data ?? { t1: '08:00', t2: '20:00', remindOn: true };
    const day = recs?.find((r) => r.kind === 'days' && !r.deleted)?.data ?? {};
    const assess = (recs ?? []).filter((r) => r.kind === 'assess' && !r.deleted).sort((a, b) => (a.id < b.id ? -1 : 1)).at(-1)?.data;
    const prio = priorities(assess?.scores ?? SEED);
    const jobs: { field: 'last_rehab' | 'last_evening'; title: string; body: string; url: string }[] = [];
    if (due(minutes, settings.t1) && s.last_rehab !== date && !prio.every((k) => day.done?.[k]))
      jobs.push({ field: 'last_rehab', title: 'Elbow rehab', body: 'Priority exercises not done yet. 15 to 25 minutes.', url: './#/session' });
    if (due(minutes, settings.t2) && s.last_evening !== date && day.painPM == null)
      jobs.push({ field: 'last_evening', title: 'Evening check-in', body: 'Log today’s pain, tasks and gym. Under 30 seconds.', url: './#/today' });
    for (const j of jobs) {
      try {
        await webpush.sendNotification(s.sub, JSON.stringify({ title: j.title, body: j.body, url: j.url, tag: j.field }), { TTL: 3600 });
        await db.from('push_subs').update({ [j.field]: date }).eq('endpoint', s.endpoint);
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) await db.from('push_subs').delete().eq('endpoint', s.endpoint); // subscription gone
      }
    }
  }
  return Response.json({ checked: subs?.length ?? 0, sent });
});
