// All writes go through here: each stamps updatedAt, and queues the record for sync.
import { db, type TableName } from './db';
import type { Appointment, Assessment, DayLog, PrteeRecord, Settings } from '../domain/types';
import { defaultSettings } from '../domain/seed';
import type { Snapshot } from '../domain/backup';
import { pickNewer } from '../domain/merge';

let lastT = 0;
/** Strictly increasing timestamp, so two quick edits never tie. */
export function stamp() {
  lastT = Math.max(Date.now(), lastT + 1);
  return lastT;
}

const listeners = new Set<() => void>();
export const onLocalWrite = (f: () => void) => {
  listeners.add(f);
  return () => listeners.delete(f);
};
const emit = () => listeners.forEach((f) => f());

function queue(table: TableName, id: string) {
  return db.outbox.put({ key: `${table}:${id}`, table, id });
}

/** Read-modify-write a day. Returns the previous record (or null) for undo. */
export async function updateDay(date: string, fn: (d: DayLog) => void): Promise<DayLog | null> {
  let prev: DayLog | null = null;
  await db.transaction('rw', db.days, db.outbox, async () => {
    const cur = await db.days.get(date);
    prev = cur ? structuredClone(cur) : null;
    const next: DayLog = cur && !cur.deleted ? structuredClone(cur) : { date, updatedAt: 0 };
    fn(next);
    delete next.deleted;
    next.updatedAt = stamp();
    await db.days.put(next);
    await queue('days', date);
  });
  emit();
  return prev;
}

/** Put a day back as it was (undo). Stamps a new time so the undo also wins on sync. */
export async function restoreDay(date: string, prev: DayLog | null) {
  await db.transaction('rw', db.days, db.outbox, async () => {
    const rec: DayLog = prev ? { ...structuredClone(prev), updatedAt: stamp() } : { date, updatedAt: stamp(), deleted: true };
    await db.days.put(rec);
    await queue('days', date);
  });
  emit();
}

export async function getSettings(): Promise<Settings> {
  const s = await db.settings.get('settings');
  return { ...defaultSettings(), ...(s ?? {}) };
}

export async function patchSettings(patch: Partial<Omit<Settings, 'id' | 'updatedAt'>>) {
  await db.transaction('rw', db.settings, db.outbox, async () => {
    const s = await getSettings();
    await db.settings.put({ ...s, ...patch, updatedAt: stamp() });
    await queue('settings', 'settings');
  });
  emit();
}

export async function saveAssessment(a: Omit<Assessment, 'updatedAt' | 'id'>) {
  await db.transaction('rw', db.assess, db.outbox, async () => {
    await db.assess.put({ ...a, id: a.date, updatedAt: stamp() });
    await queue('assess', a.date);
  });
  emit();
}

export async function savePrtee(p: Omit<PrteeRecord, 'updatedAt' | 'id'>) {
  await db.transaction('rw', db.prtee, db.outbox, async () => {
    await db.prtee.put({ ...p, id: p.date, updatedAt: stamp() });
    await queue('prtee', p.date);
  });
  emit();
}

export async function saveAppt(a: Omit<Appointment, 'updatedAt'>) {
  await db.transaction('rw', db.appts, db.outbox, async () => {
    await db.appts.put({ ...a, updatedAt: stamp() });
    await queue('appts', a.id);
  });
  emit();
}

export async function deleteAppt(id: string) {
  await db.transaction('rw', db.appts, db.outbox, async () => {
    const a = await db.appts.get(id);
    if (!a) return;
    await db.appts.put({ ...a, deleted: true, updatedAt: stamp() });
    await queue('appts', id);
  });
  emit();
}

export async function snapshot(): Promise<Snapshot> {
  const [days, assess, prtee, appts, settings] = await Promise.all([
    db.days.toArray(),
    db.assess.toArray(),
    db.prtee.toArray(),
    db.appts.toArray(),
    getSettings(),
  ]);
  return { days, assess, prtee, appts, settings };
}

/**
 * Import parsed backup data.
 * merge: each record replaces the local one only if newer (safe default).
 * replace: imported records overwrite local ones with a fresh timestamp.
 */
export async function importSnapshot(s: Partial<Snapshot>, mode: 'merge' | 'replace') {
  let written = 0;
  await db.transaction('rw', [db.days, db.assess, db.prtee, db.appts, db.settings, db.outbox], async () => {
    const put = async <T extends { updatedAt: number }>(table: TableName, t: import('dexie').Table<T, string>, recs: T[], idf: (r: T) => string) => {
      for (const r of recs) {
        const id = idf(r);
        const cur = await t.get(id);
        if (mode === 'replace' || pickNewer(cur, r) === 'remote') {
          await t.put(mode === 'replace' ? { ...r, updatedAt: stamp() } : r);
          await queue(table, id);
          written++;
        }
      }
    };
    await put('days', db.days, s.days ?? [], (r) => r.date);
    await put('assess', db.assess, s.assess ?? [], (r) => r.id);
    await put('prtee', db.prtee, s.prtee ?? [], (r) => r.id);
    await put('appts', db.appts, s.appts ?? [], (r) => r.id);
    if (s.settings) {
      const cur = await db.settings.get('settings');
      const merged = { ...defaultSettings(), ...(cur ?? {}), ...s.settings, id: 'settings' as const };
      if (mode === 'replace' || pickNewer(cur, merged) === 'remote') {
        await db.settings.put(mode === 'replace' ? { ...merged, updatedAt: stamp() } : merged);
        await queue('settings', 'settings');
      }
    }
  });
  emit();
  return written;
}

/** Delete everything on this device. Synced copies get tombstones so they are removed too. */
export async function resetAll() {
  await db.transaction('rw', [db.days, db.assess, db.prtee, db.appts, db.settings, db.outbox], async () => {
    const t = stamp();
    const tomb = async <T extends { updatedAt: number; deleted?: boolean }>(table: TableName, tb: import('dexie').Table<T, string>, idf: (r: T) => string) => {
      const all = await tb.toArray();
      for (const r of all) {
        await tb.put({ ...r, deleted: true, updatedAt: t });
        await queue(table, idf(r));
      }
    };
    await tomb('days', db.days, (r) => r.date);
    await tomb('assess', db.assess, (r) => r.id);
    await tomb('prtee', db.prtee, (r) => r.id);
    await tomb('appts', db.appts, (r) => r.id);
    await db.settings.put({ ...defaultSettings(), updatedAt: t });
    await queue('settings', 'settings');
  });
  emit();
}
