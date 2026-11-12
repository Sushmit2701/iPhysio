// Two-way sync with the user's own Supabase project. Loaded only when sync is switched on.
import type { SupabaseClient } from '@supabase/supabase-js';
import { db, idOf, type TableName } from '../db/db';
import { onLocalWrite } from '../db/repo';
import { pickNewer } from '../domain/merge';
import type { SyncMeta } from '../domain/types';
import { loadConfig } from './config';
import { setSyncState } from './status';

let client: SupabaseClient | null = null;
let running: Promise<void> | null = null;
let again = false;
let started = false;

export async function getClient(): Promise<SupabaseClient | null> {
  if (client) return client;
  const cfg = loadConfig();
  if (!cfg) return null;
  const { createClient } = await import('@supabase/supabase-js');
  client = createClient(cfg.url, cfg.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce', storageKey: 'elbow-sync-auth' },
  });
  return client;
}
export function resetClient() {
  client = null;
}

export interface RemoteRow {
  kind: TableName;
  id: string;
  data: Record<string, unknown>;
  updated_at: number;
  deleted: boolean;
  seq: number;
}

const TABLES: TableName[] = ['days', 'assess', 'prtee', 'settings', 'appts'];
const table = (t: TableName) => db.table(t);

/** Send queued local edits. The server keeps a row only if our updatedAt is newer. */
async function push(sb: SupabaseClient) {
  const queued = await db.outbox.toArray();
  for (let i = 0; i < queued.length; i += 200) {
    const batch = queued.slice(i, i + 200);
    const recs = await Promise.all(batch.map((q) => table(q.table).get(q.id) as Promise<(SyncMeta & Record<string, unknown>) | undefined>));
    const rows = batch
      .map((q, j) => ({ q, r: recs[j] }))
      .filter((x) => x.r)
      .map(({ q, r }) => ({ kind: q.table, id: q.id, data: r, updated_at: r!.updatedAt, deleted: !!r!.deleted }));
    if (rows.length) {
      const { error } = await sb.rpc('push_records', { rows });
      if (error) throw error;
    }
    // Clear only entries whose record has not changed since we read it
    await db.transaction('rw', [db.outbox, ...TABLES.map(table)], async () => {
      for (let j = 0; j < batch.length; j++) {
        const now = (await table(batch[j].table).get(batch[j].id)) as SyncMeta | undefined;
        if (!now || !recs[j] || now.updatedAt === recs[j]!.updatedAt) await db.outbox.delete(batch[j].key);
      }
    });
  }
}

/**
 * Apply remote rows. The newer-wins comparison and the write happen inside one IndexedDB
 * transaction, so an edit made on this device while a pull is in flight can never be overwritten.
 */
export async function applyRemote(rows: RemoteRow[]) {
  let applied = 0;
  await db.transaction('rw', TABLES.map(table), async () => {
    for (const row of rows) {
      if (!TABLES.includes(row.kind)) continue;
      const t = table(row.kind);
      const local = (await t.get(row.id)) as SyncMeta | undefined;
      const remote = { ...row.data, updatedAt: Number(row.updated_at), deleted: row.deleted || undefined } as SyncMeta;
      if (pickNewer(local, remote) === 'remote') {
        const rec = { ...remote } as SyncMeta & Record<string, unknown>;
        if (!rec.deleted) delete rec.deleted;
        if (row.kind === 'days') rec.date = row.id;
        else rec.id = row.id;
        if (idOf(row.kind, rec as { date?: string; id?: string }) === row.id) {
          await t.put(rec);
          applied++;
        }
      }
    }
  });
  return applied;
}

async function pull(sb: SupabaseClient) {
  let cursor = Number((await db.meta.get('pullCursor'))?.value ?? 0);
  for (;;) {
    const { data, error } = await sb.from('records').select('kind,id,data,updated_at,deleted,seq').gt('seq', cursor).order('seq').limit(500);
    if (error) throw error;
    if (!data?.length) break;
    await applyRemote(data as RemoteRow[]);
    cursor = Number(data[data.length - 1].seq);
    await db.meta.put({ key: 'pullCursor', value: cursor });
    if (data.length < 500) break;
  }
}

export async function syncNow(): Promise<void> {
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    try {
      const sb = await getClient();
      if (!sb) return setSyncState('local');
      const { data } = await sb.auth.getSession();
      if (!data.session) return setSyncState('local', 'signed out');
      if (!navigator.onLine) return setSyncState('offline');
      setSyncState('syncing');
      await push(sb);
      await pull(sb);
      await db.meta.put({ key: 'lastSync', value: Date.now() });
      setSyncState('synced');
    } catch (e) {
      setSyncState(navigator.onLine ? 'error' : 'offline', (e as Error).message ?? String(e));
    } finally {
      running = null;
      if (again) {
        again = false;
        void syncNow();
      }
    }
  })();
  return running;
}

/** Sync on start, shortly after each local edit, on reconnect, on return to the app, and every 5 minutes. */
export async function startSync() {
  if (started) return;
  started = true;
  const sb = await getClient();
  if (!sb) return;
  let t: number | undefined;
  onLocalWrite(() => {
    clearTimeout(t);
    t = window.setTimeout(() => void syncNow(), 1500);
  });
  window.addEventListener('online', () => void syncNow());
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && void syncNow());
  window.setInterval(() => document.visibilityState === 'visible' && void syncNow(), 5 * 60_000);
  sb.auth.onAuthStateChange((ev) => {
    if (ev === 'SIGNED_IN') void syncNow();
  });
  void syncNow();
}

/** First sign-in on a device: queue every local record so existing logs are uploaded too. */
export async function queueEverything() {
  await db.transaction('rw', [db.outbox, ...TABLES.map(table)], async () => {
    for (const t of TABLES) {
      const all = (await table(t).toArray()) as { date?: string; id?: string }[];
      for (const r of all) await db.outbox.put({ key: `${t}:${idOf(t, r)}`, table: t, id: idOf(t, r) });
    }
  });
}
