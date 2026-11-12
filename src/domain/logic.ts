// Pure rehab logic. Every function in the first block is a port of the v1 prototype's
// tested behaviour (see docs/v1-prototype.html, /*LOGIC*/ section) and is pinned by logic.test.ts.
import { addDays, diffDays } from './dates';
import { ITEMS_FUNC, ITEMS_PAIN, PHASES } from './content';
import type { Assessment, DayData, Days, ElbowLoad, ExKey, Phase, PrteeRecord, Scores } from './types';
import { PHASE_ORDER, TEST_KEYS } from './types';

export const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export interface Ranked {
  k: ExKey;
  score: number;
  priority: boolean;
}

/** Rank tests by pain score. Ties break by test order; nerve only counts at 3+; top 3 are priorities. */
export function rankExercises(a: { scores?: Scores } | null | undefined): Ranked[] {
  const sc = a?.scores ?? {};
  return TEST_KEYS.map((k, i) => ({ k, i, score: isNum(sc[k]) ? (sc[k] as number) : null }))
    .filter((x): x is { k: ExKey; i: number; score: number } => x.score !== null && x.score > 0 && (x.k !== 'nerve' || x.score >= 3))
    .sort((p, q) => q.score - p.score || p.i - q.i)
    .map((x, r) => ({ k: x.k, score: x.score, priority: r < 3 }));
}

export const priorityKeys = (a: { scores?: Scores } | null | undefined) =>
  rankExercises(a)
    .filter((x) => x.priority)
    .map((x) => x.k);

/** Highest of the four daily pain readings, or null. */
export function dayPeak(d: DayData | undefined | null): number | null {
  if (!d) return null;
  const v = [d.painAM, d.painRehab, d.painWorst, d.painPM].filter(isNum);
  return v.length ? Math.max(...v) : null;
}

/** Trailing 7-value mean; null until the window holds at least 3 readings. */
export function roll7(vals: (number | null | undefined)[]): (number | null)[] {
  return vals.map((_, i) => {
    const w = vals.slice(Math.max(0, i - 6), i + 1).filter(isNum);
    return w.length >= 3 ? w.reduce((a, b) => a + b, 0) / w.length : null;
  });
}

/** PRTEE: pain items summed (0-50) plus function items summed and halved (0-50). Null unless all 15 answered. */
export function prteeScore(items: Record<string, number | undefined | null>) {
  const p = ITEMS_PAIN.map((_, i) => items['p' + i]);
  const f = ITEMS_FUNC.map((_, i) => items['f' + i]);
  if (![...p, ...f].every(isNum)) return null;
  const pain = (p as number[]).reduce((a, b) => a + b, 0);
  const func = (f as number[]).reduce((a, b) => a + b, 0) / 2;
  return { pain, func, total: Math.round((pain + func) * 10) / 10 };
}

export function sessionDone(day: DayData | undefined, prio: ExKey[]) {
  return !!day && prio.length > 0 && prio.every((k) => day.done?.[k]);
}

/** Percent of priority exercises ticked, or null when there is no day or no priorities. */
export function adherence(day: DayData | undefined, prio: ExKey[]): number | null {
  if (!day || !prio.length) return null;
  return Math.round((100 * prio.filter((k) => day.done?.[k]).length) / prio.length);
}

/** Consecutive full-session days ending today (or yesterday if today is not done yet). */
export function streak(days: Days, prio: ExKey[], today: string) {
  let d = sessionDone(days[today], prio) ? today : addDays(today, -1);
  let n = 0;
  while (sessionDone(days[d], prio)) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

export type TargetLevel = 'none' | 'ok' | 'mid' | 'hi';
/** Rehab and worst pain across the date and the day before (the 48 h rule). */
export function targetStatus(days: Days, date: string): { level: TargetLevel; max?: number } {
  const vals: number[] = [];
  [date, addDays(date, -1)].forEach((s) => {
    const d = days[s];
    if (d) [d.painRehab, d.painWorst].forEach((v) => isNum(v) && vals.push(v));
  });
  if (!vals.length) return { level: 'none' };
  const m = Math.max(...vals);
  return { level: m <= 3 ? 'ok' : m <= 5 ? 'mid' : 'hi', max: m };
}

export function mean(a: (number | null | undefined)[]): number | null {
  const n = a.filter(isNum);
  return n.length ? n.reduce((x, y) => x + y, 0) / n.length : null;
}

export function windowPeaks(days: Days, end: string, n: number) {
  const o: (number | null)[] = [];
  for (let i = 0; i < n; i++) o.push(dayPeak(days[addDays(end, -i)]));
  return o;
}

export interface Criterion {
  key: 'logged' | 'avg' | 'flare' | 'adh';
  ok: boolean;
  text: string;
}
/** Criteria to move to the next phase, checked over the last 7 days. */
export function advanceCriteria(days: Days, prio: ExKey[], today: string): Criterion[] {
  const dates = Array.from({ length: 7 }, (_, i) => addDays(today, -i));
  const logged = dates.filter((s) => dayPeak(days[s]) !== null).length;
  const avg = mean(dates.map((s) => dayPeak(days[s])));
  const flares = dates.filter((s) => days[s]?.flare).length;
  const adh = mean(dates.map((s) => adherence(days[s], prio)));
  return [
    { key: 'logged', ok: logged >= 5, text: `Pain logged on at least 5 of the last 7 days (${logged})` },
    { key: 'avg', ok: avg !== null && avg <= 3, text: `Average daily peak pain 3/10 or less (${avg === null ? 'no data' : avg.toFixed(1)})` },
    { key: 'flare', ok: flares === 0, text: `No flare-up in the last 7 days (${flares})` },
    {
      key: 'adh',
      ok: adh !== null && adh >= 70,
      text: `Rehab done on most days, 70% or more of priority exercises (${adh === null ? 'no data' : Math.round(adh) + '%'})`,
    },
  ];
}

const maxOf = (a: (number | null)[]) => {
  const n = a.filter(isNum);
  return n.length ? Math.max(...n) : null;
};

/** True when a day record holds no user data (the prototype's `!Object.keys(d).length`). */
export function isEmptyDay(d: DayData | undefined): boolean {
  if (!d) return true;
  return Object.keys(d).filter((k) => !['date', 'updatedAt', 'deleted'].includes(k)).length === 0;
}

export interface GymImpact {
  nT: number;
  nR: number;
  tAM: number | null;
  rAM: number | null;
  tP: number | null;
  rP: number | null;
  tOwn: number | null;
  rOwn: number | null;
  byElb: Partial<Record<ElbowLoad, { n: number; am: number | null; p48: number | null }>>;
}
/** Next-morning pain and 48 h peak after training days vs rest days, and by elbow load. */
export function gymImpact(days: Days, today: string): GymImpact {
  type Rec = { am: number | null; p48: number | null; own: number | null; elb: ElbowLoad | null };
  const T: Rec[] = [];
  const R: Rec[] = [];
  Object.keys(days).forEach((s) => {
    if (s >= today) return;
    const d = days[s];
    const n1 = days[addDays(s, 1)];
    const n2 = days[addDays(s, 2)];
    if (!d || dayPeak(n1) === null) return;
    if (!d.gym && isEmptyDay(d)) return;
    const rec: Rec = {
      am: isNum(n1!.painAM) ? n1!.painAM : null,
      p48: maxOf([dayPeak(n1), dayPeak(n2)]),
      own: dayPeak(d),
      elb: d.gymElbow ?? null,
    };
    (d.gym ? T : R).push(rec);
  });
  const m = (a: Rec[], f: 'am' | 'p48' | 'own') => mean(a.map((x) => x[f]));
  const byElb: GymImpact['byElb'] = {};
  (['Low', 'Medium', 'High'] as const).forEach((e) => {
    const g = T.filter((x) => x.elb === e);
    if (g.length) byElb[e] = { n: g.length, am: m(g, 'am'), p48: m(g, 'p48') };
  });
  return { nT: T.length, nR: R.length, tAM: m(T, 'am'), rAM: m(R, 'am'), tP: m(T, 'p48'), rP: m(R, 'p48'), tOwn: m(T, 'own'), rOwn: m(R, 'own'), byElb };
}

/** Honest wording for the gym comparison. */
export function gymVerdict(im: GymImpact): { level: 'none' | 'ok' | 'hi'; title: string; body: string } {
  const f = (v: number) => v.toFixed(1);
  if (!(im.nT >= 3 && im.nR >= 3 && im.tP !== null && im.rP !== null))
    return {
      level: 'none',
      title: 'Not enough data yet',
      body: `Needs at least 3 training days and 3 rest days with pain logged the next day (now ${im.nT} and ${im.nR}).`,
    };
  const diff = im.tP - im.rP;
  const small = im.nT < 8 || im.nR < 8 ? ' With this few days, one bad night can swing it, so treat it as a hint.' : '';
  const base = `Peak pain over the next 48 h averages ${f(im.tP)} after training and ${f(im.rP)} after rest (${diff > 0 ? '+' : ''}${f(diff)}).`;
  if (diff >= 1)
    return { level: 'hi', title: 'Training days are followed by more pain', body: `${base} Try lighter loads or fewer elbow-heavy lifts, and check the elbow-load table.${small}` };
  if (diff <= -1) return { level: 'ok', title: 'Training days are followed by less pain', body: base + small };
  return { level: 'none', title: 'No clear difference yet', body: base + small };
}

// ---------- Additions in v2 ----------

export interface Advice {
  action: 'log' | 'step-back' | 'hold' | 'progress';
  title: string;
  body: string;
  suggestPhase?: Phase;
}

export function nextPhase(p: Phase): Phase | null {
  const i = PHASE_ORDER.indexOf(p);
  return i < PHASE_ORDER.length - 1 ? PHASE_ORDER[i + 1] : null;
}
export function prevPhase(p: Phase): Phase | null {
  const i = PHASE_ORDER.indexOf(p);
  return i > 0 ? PHASE_ORDER[i - 1] : null;
}

/** What to do today: combines the 48 h target status, recent flares and the advance criteria. */
export function todayAdvice(days: Days, prio: ExKey[], today: string, phase: Phase): Advice {
  const st = targetStatus(days, today);
  const flare = !!(days[today]?.flare || days[addDays(today, -1)]?.flare);
  if (st.level === 'hi' || flare) {
    const back = prevPhase(phase);
    return {
      action: 'step-back',
      title: st.level === 'hi' ? `Above target (${st.max}/10). Step back` : 'Flare-up logged. Step back',
      body: 'Halve the load and the session time until pain stays 3/10 or less for 48 hours. Keep moving: light rehab beats a day off. Heat and massage are fine.',
      suggestPhase: back ?? undefined,
    };
  }
  if (st.level === 'none')
    return {
      action: 'log',
      title: 'No rehab or worst pain logged for the last 48 h',
      body: 'Log pain during rehab and the worst pain of the day. The target is 3/10 or less during, and for 48 hours after.',
    };
  if (st.level === 'mid')
    return {
      action: 'hold',
      title: `Slightly above target (${st.max}/10). Hold`,
      body: 'Keep the same load, do not progress, and keep reps slow and controlled. If it climbs further, follow the flare steps.',
    };
  const crit = advanceCriteria(days, prio, today);
  const nxt = nextPhase(phase);
  if (crit.every((c) => c.ok))
    return nxt
      ? {
          action: 'progress',
          title: `Within target (${st.max}/10). Ready to progress`,
          body: `Your last 7 days meet the criteria for ${PHASES[nxt].name}. Raise the load a little at a time and keep the 48-hour rule.`,
          suggestPhase: nxt,
        }
      : { action: 'hold', title: `Within target (${st.max}/10)`, body: 'Stay in Reinforce, 2 to 3 sessions a week.' };
  return {
    action: 'hold',
    title: `Within target (${st.max}/10). Hold`,
    body: 'Stay at this load. Progress once a full week holds inside the target (see Plan).',
  };
}

/** Phase suggestion from the last 7 days, for the Plan screen. */
export function phaseSuggestion(days: Days, prio: ExKey[], today: string, phase: Phase): { phase: Phase; reason: string } | null {
  const recentFlare = Array.from({ length: 3 }, (_, i) => days[addDays(today, -i)]?.flare).some(Boolean);
  const st = targetStatus(days, today);
  if ((recentFlare || st.level === 'hi') && prevPhase(phase))
    return { phase: prevPhase(phase)!, reason: 'A recent flare or pain above 5/10. Drop back a phase until pain settles for 48 hours.' };
  if (advanceCriteria(days, prio, today).every((c) => c.ok) && nextPhase(phase))
    return { phase: nextPhase(phase)!, reason: 'All criteria met over the last 7 days.' };
  return null;
}

export function latestAssessment(list: Assessment[], seed: Assessment): Assessment {
  const live = list.filter((a) => !a.deleted).sort((a, b) => (a.date < b.date ? -1 : 1));
  return live.length ? live[live.length - 1] : seed;
}

export function firstAssessment(list: Assessment[], seed: Assessment): Assessment {
  const live = list.filter((a) => !a.deleted).sort((a, b) => (a.date < b.date ? -1 : 1));
  return live.length ? live[0] : seed;
}

/** Worst single test score in an assessment (the prototype's baseline). */
export function screenMax(a: Assessment): number {
  return Math.max(0, ...TEST_KEYS.map((k) => a.scores[k]).filter(isNum));
}

export function changeFromBaseline(now7: number | null, baseline: number): number | null {
  if (now7 === null || baseline <= 0) return null;
  return Math.round((100 * (baseline - now7)) / baseline);
}

export function daysSince(dates: string[], today: string): number | null {
  if (!dates.length) return null;
  const last = [...dates].sort().at(-1)!;
  return diffDays(last, today);
}

/** PRTEE is weekly; movement screen every 2 weeks. */
export function dueChecks(prtee: PrteeRecord[], assess: Assessment[], today: string) {
  const p = daysSince(prtee.filter((x) => !x.deleted).map((x) => x.date), today);
  const a = daysSince(assess.filter((x) => !x.deleted).map((x) => x.date), today);
  return { prteeDue: p === null || p >= 7, screenDue: a !== null && a >= 14, daysSincePrtee: p, daysSinceScreen: a };
}

/** Flare episodes: runs of consecutive flare days, newest last. Shorter runs over time are a progress sign. */
export function flareRuns(days: Days): { start: string; length: number }[] {
  const flareDates = Object.keys(days)
    .filter((k) => days[k]?.flare)
    .sort();
  const runs: { start: string; length: number }[] = [];
  for (const d of flareDates) {
    const last = runs.at(-1);
    if (last && addDays(last.start, last.length) === d) last.length++;
    else runs.push({ start: d, length: 1 });
  }
  return runs;
}

/** Best streak ever, for the trends tiles. */
export function bestStreak(days: Days, prio: ExKey[]): number {
  const ds = Object.keys(days).sort();
  let best = 0;
  let cur = 0;
  let prev: string | null = null;
  for (const d of ds) {
    if (sessionDone(days[d], prio)) {
      cur = prev && addDays(prev, 1) === d ? cur + 1 : 1;
      prev = d;
      best = Math.max(best, cur);
    } else {
      cur = 0;
      prev = null;
    }
  }
  return best;
}
