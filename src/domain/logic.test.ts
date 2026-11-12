import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as L from './logic';
import { addDays } from './dates';
import type { Days, DayData, ExKey } from './types';

const T = '2026-12-10';
const P: ExKey[] = ['ecrl', 'sup', 'ed'];
const done = (...k: ExKey[]): DayData => ({ done: Object.fromEntries(k.map((x) => [x, true])) });

describe('rankExercises', () => {
  it('ranks the seed screen: ECRL, supinator, finger extensors are priorities (tie broken by test order)', () => {
    const r = L.rankExercises({ scores: { ecrl: 8, ecrb: 4, ecu: 4, sup: 8, ed: 8, nerve: null } });
    expect(r.map((x) => x.k)).toEqual(['ecrl', 'sup', 'ed', 'ecrb', 'ecu']);
    expect(r.filter((x) => x.priority).map((x) => x.k)).toEqual(['ecrl', 'sup', 'ed']);
  });
  it('breaks ties by test order ecrl, ecrb, ecu, sup, ed, nerve', () => {
    const r = L.rankExercises({ scores: { nerve: 5, ed: 5, sup: 5, ecu: 5, ecrb: 5, ecrl: 5 } });
    expect(r.map((x) => x.k)).toEqual(['ecrl', 'ecrb', 'ecu', 'sup', 'ed', 'nerve']);
  });
  it('counts the radial nerve test only at 3 or more', () => {
    expect(L.rankExercises({ scores: { nerve: 2 } })).toEqual([]);
    expect(L.rankExercises({ scores: { nerve: 3 } })).toEqual([{ k: 'nerve', score: 3, priority: true }]);
  });
  it('drops zero and missing scores', () => {
    expect(L.rankExercises({ scores: { ecrl: 0, ecrb: null } })).toEqual([]);
    expect(L.rankExercises(null)).toEqual([]);
  });
});

describe('dayPeak and roll7', () => {
  it('takes the highest of the four readings', () => {
    expect(L.dayPeak({ painAM: 2, painRehab: 5, painWorst: 4, painPM: 0 })).toBe(5);
    expect(L.dayPeak({ painAM: 0 })).toBe(0);
    expect(L.dayPeak({})).toBeNull();
    expect(L.dayPeak(undefined)).toBeNull();
  });
  it('needs at least 3 readings in the 7-day window', () => {
    expect(L.roll7([4, 6])).toEqual([null, null]);
    expect(L.roll7([4, 6, 8])).toEqual([null, null, 6]);
    expect(L.roll7([4, null, 6, null, 8])).toEqual([null, null, null, null, 6]);
  });
  it('uses a trailing window of 7', () => {
    const r = L.roll7([10, 1, 1, 1, 1, 1, 1, 1]);
    expect(r[6]).toBeCloseTo(16 / 7);
    expect(r[7]).toBe(1);
  });
});

describe('prteeScore', () => {
  const all = (p: number, f: number) => ({ ...Object.fromEntries([0, 1, 2, 3, 4].map((i) => ['p' + i, p])), ...Object.fromEntries(Array.from({ length: 10 }, (_, i) => ['f' + i, f])) });
  it('is pain sum (0-50) plus function sum halved (0-50)', () => {
    expect(L.prteeScore(all(10, 10))).toEqual({ pain: 50, func: 50, total: 100 });
    expect(L.prteeScore(all(3, 3))).toEqual({ pain: 15, func: 15, total: 30 });
    expect(L.prteeScore({ ...all(2, 2), f0: 3 })).toEqual({ pain: 10, func: 10.5, total: 20.5 });
  });
  it('is null until all 15 items are answered', () => {
    const x: Record<string, number | undefined> = all(1, 1);
    delete x.f9;
    expect(L.prteeScore(x)).toBeNull();
  });
});

describe('adherence and streak', () => {
  it('computes percent of priorities ticked', () => {
    expect(L.adherence(done('ecrl', 'sup'), P)).toBe(67);
    expect(L.adherence(done('ecrl', 'sup', 'ed', 'ecrb'), P)).toBe(100);
    expect(L.adherence(undefined, P)).toBeNull();
    expect(L.adherence(done('ecrl'), [])).toBeNull();
  });
  it('counts back from today, or from yesterday if today is not finished', () => {
    const full = done(...P);
    const days: Days = { [addDays(T, -3)]: full, [addDays(T, -2)]: full, [addDays(T, -1)]: full, [T]: done('ecrl') };
    expect(L.streak(days, P, T)).toBe(3);
    days[T] = full;
    expect(L.streak(days, P, T)).toBe(4);
    delete days[addDays(T, -2)];
    expect(L.streak(days, P, T)).toBe(2);
  });
  it('finds the best streak', () => {
    const full = done(...P);
    const days: Days = { '2026-11-01': full, '2026-11-02': full, '2026-11-04': full, '2026-11-05': full, '2026-11-06': full };
    expect(L.bestStreak(days, P)).toBe(3);
  });
});

describe('targetStatus', () => {
  it('uses rehab and worst pain over the date and the day before', () => {
    expect(L.targetStatus({}, T)).toEqual({ level: 'none' });
    expect(L.targetStatus({ [T]: { painRehab: 3 } }, T)).toEqual({ level: 'ok', max: 3 });
    expect(L.targetStatus({ [T]: { painRehab: 2 }, [addDays(T, -1)]: { painWorst: 5 } }, T)).toEqual({ level: 'mid', max: 5 });
    expect(L.targetStatus({ [addDays(T, -1)]: { painWorst: 6 } }, T)).toEqual({ level: 'hi', max: 6 });
    expect(L.targetStatus({ [T]: { painAM: 9, painPM: 9 } }, T)).toEqual({ level: 'none' });
    expect(L.targetStatus({ [addDays(T, -2)]: { painWorst: 9 } }, T)).toEqual({ level: 'none' });
  });
});

function goodWeek(): Days {
  const d: Days = {};
  for (let i = 0; i < 7; i++) d[addDays(T, -i)] = { ...done(...P), painRehab: 2, painWorst: 3 };
  return d;
}

describe('advanceCriteria and advice', () => {
  it('passes a good week', () => {
    expect(L.advanceCriteria(goodWeek(), P, T).every((c) => c.ok)).toBe(true);
  });
  it('fails each criterion independently', () => {
    const few = goodWeek();
    delete few[addDays(T, -1)];
    delete few[addDays(T, -2)];
    delete few[addDays(T, -3)];
    expect(L.advanceCriteria(few, P, T).find((c) => c.key === 'logged')!.ok).toBe(false);
    const sore = goodWeek();
    sore[T] = { ...sore[T], painWorst: 9 };
    sore[addDays(T, -1)] = { ...sore[addDays(T, -1)], painWorst: 9 };
    expect(L.advanceCriteria(sore, P, T).find((c) => c.key === 'avg')!.ok).toBe(false);
    const fl = goodWeek();
    fl[addDays(T, -6)] = { ...fl[addDays(T, -6)], flare: true };
    expect(L.advanceCriteria(fl, P, T).find((c) => c.key === 'flare')!.ok).toBe(false);
    const lazy = goodWeek();
    for (let i = 0; i < 4; i++) lazy[addDays(T, -i)] = { painRehab: 2 };
    expect(L.advanceCriteria(lazy, P, T).find((c) => c.key === 'adh')!.ok).toBe(false);
  });
  it('advises progress, hold, step back and log', () => {
    expect(L.todayAdvice(goodWeek(), P, T, 'reduce')).toMatchObject({ action: 'progress', suggestPhase: 'rebuild' });
    expect(L.todayAdvice(goodWeek(), P, T, 'reinforce').action).toBe('hold');
    const mid = goodWeek();
    mid[T] = { ...mid[T], painWorst: 4 };
    expect(L.todayAdvice(mid, P, T, 'reduce').action).toBe('hold');
    const hi = goodWeek();
    hi[T] = { ...hi[T], painWorst: 7 };
    expect(L.todayAdvice(hi, P, T, 'rebuild')).toMatchObject({ action: 'step-back', suggestPhase: 'reduce' });
    const fl = goodWeek();
    fl[addDays(T, -1)] = { ...fl[addDays(T, -1)], flare: true };
    expect(L.todayAdvice(fl, P, T, 'reduce')).toMatchObject({ action: 'step-back' });
    expect(L.todayAdvice({}, P, T, 'reduce').action).toBe('log');
  });
  it('suggests phases from the last 7 days', () => {
    expect(L.phaseSuggestion(goodWeek(), P, T, 'reduce')).toMatchObject({ phase: 'rebuild' });
    const fl = goodWeek();
    fl[T] = { ...fl[T], flare: true };
    expect(L.phaseSuggestion(fl, P, T, 'return')).toMatchObject({ phase: 'rebuild' });
    expect(L.phaseSuggestion(fl, P, T, 'reduce')).toBeNull();
  });
});

describe('gymImpact', () => {
  it('compares next-morning and 48 h peak after training vs rest days', () => {
    const days: Days = {
      '2026-12-01': { gym: true, gymElbow: 'High', painWorst: 4 },
      '2026-12-02': { painAM: 6, painWorst: 7 },
      '2026-12-03': { painAM: 2, painWorst: 3 },
      '2026-12-04': { gym: true, gymElbow: 'Low' },
      '2026-12-05': { painAM: 3 },
    };
    const im = L.gymImpact(days, T);
    expect(im.nT).toBe(2);
    expect(im.nR).toBe(1); // only 12-02 counts: 12-03 is followed by a day with no pain logged
    expect(im.tAM).toBeCloseTo((6 + 3) / 2);
    expect(im.byElb.High).toMatchObject({ n: 1, am: 6 });
    expect(im.byElb.Low).toMatchObject({ n: 1, am: 3 });
  });
  it('skips today and later, days with no next-day pain, and empty rest days', () => {
    const days: Days = { [T]: { gym: true }, [addDays(T, 1)]: { painAM: 5 }, '2026-12-01': {}, '2026-12-02': { painAM: 1 } };
    const im = L.gymImpact(days, T);
    expect(im.nT + im.nR).toBe(0);
  });
  it('words small samples honestly', () => {
    expect(L.gymVerdict(L.gymImpact({}, T)).title).toMatch(/Not enough/);
  });
});

describe('flare runs and due checks', () => {
  it('groups consecutive flare days', () => {
    const days: Days = { '2026-11-20': { flare: true }, '2026-11-21': { flare: true }, '2026-11-25': { flare: true } };
    expect(L.flareRuns(days)).toEqual([
      { start: '2026-11-20', length: 2 },
      { start: '2026-11-25', length: 1 },
    ]);
  });
  it('flags weekly PRTEE and fortnightly screen', () => {
    const d = L.dueChecks([{ id: 'a', date: addDays(T, -8), pain: 0, func: 0, total: 0, pfg: null, items: {}, updatedAt: 1 }], [{ id: 'b', date: addDays(T, -3), scores: {}, updatedAt: 1 }], T);
    expect(d).toMatchObject({ prteeDue: true, screenDue: false });
  });
});

// ---------- Differential test against the prototype's own logic ----------
// Loads the /*LOGIC*/ block of docs/v1-prototype.html and compares outputs on random data.
const html = readFileSync(resolve(__dirname, '../../docs/v1-prototype.html'), 'utf8');
const src = html.slice(html.indexOf('/*LOGIC*/'), html.indexOf('/*ENDLOGIC*/'));
// eslint-disable-next-line @typescript-eslint/no-implied-eval
const proto = new Function(`${src}; return {rankExercises,dayPeak,roll7,prteeScore,adherence,streak,targetStatus,advanceCriteria,gymImpact};`)();

function rng(seed: number) {
  return () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
}

describe('matches the prototype on random data', () => {
  const R = rng(42);
  const pick = <X>(a: X[]) => a[Math.floor(R() * a.length)];
  const maybe = (p: number) => (R() < p ? Math.floor(R() * 11) : undefined);
  const keys: ExKey[] = ['ecrl', 'ecrb', 'ecu', 'sup', 'ed', 'nerve'];
  for (let trial = 0; trial < 300; trial++) {
    const days: Days = {};
    for (let i = -40; i <= 2; i++) {
      if (R() < 0.25) continue;
      const d: DayData = {};
      for (const f of ['painAM', 'painRehab', 'painWorst', 'painPM'] as const) {
        const v = maybe(0.6);
        if (v !== undefined) d[f] = v;
      }
      if (R() < 0.6) d.done = Object.fromEntries(keys.filter(() => R() < 0.7).map((k) => [k, true]));
      if (R() < 0.3) d.gym = true;
      if (d.gym && R() < 0.7) d.gymElbow = pick(['Low', 'Medium', 'High'] as const);
      if (R() < 0.1) d.flare = true;
      days[addDays(T, i)] = d;
    }
    const scores = Object.fromEntries(keys.map((k) => [k, R() < 0.8 ? Math.floor(R() * 11) : null]));
    const prio = L.priorityKeys({ scores });
    it(`trial ${trial}`, () => {
      expect(L.rankExercises({ scores })).toEqual(proto.rankExercises({ scores }));
      const peaks = Object.keys(days).sort().map((k) => L.dayPeak(days[k]));
      expect(peaks).toEqual(Object.keys(days).sort().map((k) => proto.dayPeak(days[k])));
      expect(L.roll7(peaks)).toEqual(proto.roll7(peaks));
      expect(L.streak(days, prio, T)).toBe(proto.streak(days, prio, T));
      expect(L.targetStatus(days, T)).toEqual(proto.targetStatus(days, T));
      expect(L.advanceCriteria(days, prio, T).map(({ ok, text }) => ({ ok, text }))).toEqual(proto.advanceCriteria(days, prio, T));
      expect(L.adherence(days[T], prio)).toBe(proto.adherence(days[T], prio));
      const a = L.gymImpact(days, T);
      const b = proto.gymImpact(days, T);
      const { byElb: be, ...ra } = a;
      const { byElb: bb, ...rb } = b;
      expect(ra).toEqual(rb);
      expect(Object.fromEntries(Object.entries(be).map(([k, v]) => [k, { n: v!.n, am: v!.am }]))).toEqual(bb);
    });
  }
  it('prteeScore matches', () => {
    for (let t = 0; t < 50; t++) {
      const items: Record<string, number> = {};
      for (let i = 0; i < 5; i++) if (R() < 0.97) items['p' + i] = Math.floor(R() * 11);
      for (let i = 0; i < 10; i++) if (R() < 0.97) items['f' + i] = Math.floor(R() * 11);
      expect(L.prteeScore(items)).toEqual(proto.prteeScore(items));
    }
  });
});
