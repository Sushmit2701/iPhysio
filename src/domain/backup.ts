// Import (prototype v1 backups and v2 exports) and export (JSON, CSV). Pure functions.
import { isDate } from './dates';
import { isNum, dayPeak } from './logic';
import type { Appointment, Assessment, DayLog, ExKey, PrteeRecord, Settings, SetLog } from './types';
import { ADJUNCTS, APPT_KINDS, ELBOW_LOADS, GYM_TYPES, PAIN_CHARS, PHASE_ORDER, TEST_KEYS } from './types';

export interface Snapshot {
  settings: Settings;
  days: DayLog[];
  assess: Assessment[];
  prtee: PrteeRecord[];
  appts: Appointment[];
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const inRange = (v: unknown, lo: number, hi: number) => (isNum(v) && v >= lo && v <= hi ? v : undefined);
const oneOf = <T extends string>(list: readonly T[], v: unknown) => (list.includes(v as T) ? (v as T) : undefined);
const str = (v: unknown, max = 5000) => (typeof v === 'string' ? v.slice(0, max) : undefined);
const timeHM = (v: unknown) => (typeof v === 'string' && /^\d{2}:\d{2}$/.test(v) ? v : undefined);

function clean<T extends object>(o: T): T {
  const r = o as Record<string, unknown>;
  for (const k of Object.keys(r)) if (r[k] === undefined) delete r[k];
  return o;
}

export class ImportError extends Error {}

/** Normalise one day from either format. `fallbackT` is used when no timestamp exists. */
export function sanitizeDay(date: string, raw: unknown, fallbackT: number): DayLog | null {
  if (!isDate(date) || !isObj(raw)) return null;
  const d = raw;
  const exMap = <V>(v: unknown, f: (x: unknown) => V | undefined) => {
    if (!isObj(v)) return undefined;
    const out: Partial<Record<ExKey, V>> = {};
    for (const k of TEST_KEYS) {
      const x = f(v[k]);
      if (x !== undefined) out[k] = x;
    }
    return Object.keys(out).length ? out : undefined;
  };
  const fn = isObj(d.fn)
    ? clean({ cap: inRange(d.fn.cap, 0, 10), mug: inRange(d.fn.mug, 0, 10), door: inRange(d.fn.door, 0, 10) })
    : undefined;
  const adj = isObj(d.adj)
    ? (Object.fromEntries(ADJUNCTS.filter((k) => typeof (d.adj as Obj)[k] === 'boolean').map((k) => [k, (d.adj as Obj)[k]])) as DayLog['adj'])
    : undefined;
  const sets = exMap<SetLog[]>(d.sets, (v) =>
    Array.isArray(v)
      ? v.filter(isObj).map((s) => clean({ reps: inRange(s.reps, 0, 500), holdS: inRange(s.holdS, 0, 600), load: str(s.load, 60), at: isNum(s.at) ? s.at : fallbackT }) as SetLog)
      : undefined,
  );
  const t = isNum(d.updatedAt) ? d.updatedAt : isNum(d._t) ? d._t : fallbackT;
  const day: DayLog = clean({
    date,
    done: exMap(d.done, (v) => (typeof v === 'boolean' ? v : undefined)),
    load: exMap(d.load, (v) => str(v, 60)),
    sets,
    painAM: inRange(d.painAM, 0, 10),
    painRehab: inRange(d.painRehab, 0, 10),
    painWorst: inRange(d.painWorst, 0, 10),
    painPM: inRange(d.painPM, 0, 10),
    char: oneOf(PAIN_CHARS, d.char),
    fn: fn && Object.keys(fn).length ? fn : undefined,
    sleepH: inRange(d.sleepH, 0, 24),
    sleepQ: inRange(d.sleepQ, 1, 5),
    wokePain: typeof d.wokePain === 'boolean' ? d.wokePain : undefined,
    flare: typeof d.flare === 'boolean' ? d.flare : undefined,
    gym: typeof d.gym === 'boolean' ? d.gym : undefined,
    gymType: oneOf(GYM_TYPES, d.gymType),
    gymElbow: oneOf(ELBOW_LOADS, d.gymElbow),
    adj: adj && Object.keys(adj).length ? adj : undefined,
    note: str(d.note),
    updatedAt: t,
  } as DayLog);
  return day;
}

/**
 * Parse a backup. Accepts the prototype format `{ settings, days, assess, prtee }` and the v2
 * export (same keys plus `appts`). Records without a timestamp get `fallbackT`.
 */
export function parseBackup(text: string, fallbackT: number): Partial<Snapshot> & { counts: Record<string, number> } {
  let j: unknown;
  try {
    j = JSON.parse(text);
  } catch {
    throw new ImportError('That is not valid JSON.');
  }
  if (!isObj(j) || !isObj(j.days)) throw new ImportError('That file does not look like an Elbow Rehab backup (no "days").');
  const days = Object.entries(j.days)
    .map(([k, v]) => sanitizeDay(k, v, fallbackT))
    .filter((d): d is DayLog => !!d);

  const assess: Assessment[] = (Array.isArray(j.assess) ? j.assess : [])
    .filter(isObj)
    .filter((a) => isDate(a.date) && isObj(a.scores))
    .map((a) => {
      const sc = a.scores as Obj;
      return clean({
        id: a.date as string,
        date: a.date as string,
        scores: Object.fromEntries(TEST_KEYS.map((k) => [k, inRange(sc[k], 0, 10) ?? null])),
        finger: str(a.finger, 60),
        ecrlBent: inRange(a.ecrlBent, 0, 10) ?? null,
        note: str(a.note, 1000),
        updatedAt: isNum(a.updatedAt) ? a.updatedAt : fallbackT,
      }) as Assessment;
    });

  const prtee: PrteeRecord[] = (Array.isArray(j.prtee) ? j.prtee : [])
    .filter(isObj)
    .filter((p) => isDate(p.date) && isNum(p.total))
    .map((p) => ({
      id: p.date as string,
      date: p.date as string,
      pain: isNum(p.pain) ? p.pain : 0,
      func: isNum(p.func) ? p.func : 0,
      total: p.total as number,
      pfg: isNum(p.pfg) ? p.pfg : null,
      items: isObj(p.items) ? (Object.fromEntries(Object.entries(p.items).filter(([, v]) => isNum(v))) as Record<string, number>) : {},
      updatedAt: isNum(p.updatedAt) ? p.updatedAt : fallbackT,
    }));

  const appts: Appointment[] = (Array.isArray(j.appts) ? j.appts : [])
    .filter(isObj)
    .filter((a) => typeof a.id === 'string' && isDate(a.date))
    .map((a) => ({
      id: a.id as string,
      date: a.date as string,
      kind: oneOf(APPT_KINDS, a.kind) ?? 'Other',
      title: str(a.title, 200) ?? '',
      detail: str(a.detail) ?? '',
      updatedAt: isNum(a.updatedAt) ? a.updatedAt : fallbackT,
      deleted: a.deleted === true ? true : undefined,
    }));

  let settings: Settings | undefined;
  if (isObj(j.settings)) {
    const s = j.settings;
    settings = clean({
      side: oneOf(['Left', 'Right', 'Both'] as const, s.side),
      phase: oneOf(PHASE_ORDER, s.phase),
      mode: oneOf(['iso', 'pump', 'full'] as const, s.mode),
      start: isDate(s.start) ? s.start : undefined,
      remindOn: typeof s.remindOn === 'boolean' ? s.remindOn : undefined,
      t1: timeHM(s.t1),
      t2: timeHM(s.t2),
      theme: oneOf(['system', 'light', 'dark'] as const, s.theme),
      sound: typeof s.sound === 'boolean' ? s.sound : undefined,
      haptics: typeof s.haptics === 'boolean' ? s.haptics : undefined,
      holdS: inRange(s.holdS, 10, 120),
      restS: inRange(s.restS, 0, 300),
      isoSets: inRange(s.isoSets, 1, 8),
      updatedAt: isNum(s.updatedAt) ? s.updatedAt : fallbackT,
    }) as Settings;
  }
  return {
    settings,
    days,
    assess,
    prtee,
    appts,
    counts: { days: days.length, assess: assess.length, prtee: prtee.length, appts: appts.length },
  };
}

/** v2 export. `days` stays a date-keyed map so the prototype could read it back too. */
export function toBackupJSON(s: Snapshot): string {
  const days: Record<string, Omit<DayLog, 'date'>> = {};
  for (const d of s.days) {
    if (d.deleted) continue;
    const { date, ...rest } = d;
    days[date] = rest;
  }
  return JSON.stringify(
    {
      format: 'elbow-rehab',
      version: 2,
      exportedAt: new Date().toISOString(),
      settings: s.settings,
      days,
      assess: s.assess.filter((a) => !a.deleted),
      prtee: s.prtee.filter((p) => !p.deleted),
      appts: s.appts.filter((a) => !a.deleted),
    },
    null,
    1,
  );
}

const csvCell = (v: unknown) => {
  if (v === undefined || v === null) return '';
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function toCSV(days: DayLog[]): string {
  const head = [
    'date', 'painAM', 'painRehab', 'painWorst', 'painPM', 'peak', 'char', 'fnCap', 'fnMug', 'fnDoor',
    'sleepH', 'sleepQ', 'wokePain', 'flare', 'gym', 'gymType', 'gymElbow',
    ...TEST_KEYS.flatMap((k) => [`done_${k}`, `load_${k}`, `sets_${k}`]),
    ...ADJUNCTS.map((a) => `adj_${a}`),
    'note',
  ];
  const rows = days
    .filter((d) => !d.deleted)
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map((d) => [
      d.date, d.painAM, d.painRehab, d.painWorst, d.painPM, dayPeak(d), d.char, d.fn?.cap, d.fn?.mug, d.fn?.door,
      d.sleepH, d.sleepQ, d.wokePain ? 1 : d.wokePain === false ? 0 : '', d.flare ? 1 : '', d.gym ? 1 : '', d.gymType, d.gymElbow,
      ...TEST_KEYS.flatMap((k) => [
        d.done?.[k] ? 1 : '',
        d.load?.[k],
        (d.sets?.[k] ?? []).map((s) => (s.holdS ? `${s.holdS}s` : `${s.reps ?? 0}r`) + (s.load ? `@${s.load}` : '')).join(' '),
      ]),
      ...ADJUNCTS.map((a) => (d.adj?.[a] ? 1 : '')),
      d.note,
    ]);
  return [head, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
