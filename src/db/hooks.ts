import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { db } from './db';
import { defaultSettings, SEED_ASSESS } from '../domain/seed';
import type { Appointment, Assessment, DayLog, Days, PrteeRecord, Settings } from '../domain/types';
import { latestAssessment, priorityKeys, rankExercises } from '../domain/logic';

export interface RehabData {
  ready: boolean;
  settings: Settings;
  days: Days;
  dayList: DayLog[];
  assess: Assessment[];
  latest: Assessment;
  prtee: PrteeRecord[];
  appts: Appointment[];
  prio: ReturnType<typeof priorityKeys>;
  ranked: ReturnType<typeof rankExercises>;
}

const EMPTY: never[] = [];

/** Everything the screens need, live from IndexedDB. Deleted (tombstoned) records are hidden. */
export function useRehab(): RehabData {
  const dayList = useLiveQuery(() => db.days.filter((d) => !d.deleted).toArray(), []);
  const s = useLiveQuery(() => db.settings.get('settings'), []);
  const assessRaw = useLiveQuery(() => db.assess.orderBy('date').filter((a) => !a.deleted).toArray(), []);
  const prteeRaw = useLiveQuery(() => db.prtee.orderBy('date').filter((a) => !a.deleted).toArray(), []);
  const apptsRaw = useLiveQuery(() => db.appts.orderBy('date').filter((a) => !a.deleted).toArray(), []);

  return useMemo(() => {
    const settings = { ...defaultSettings(), ...(s ?? {}) };
    const days: Days = {};
    for (const d of dayList ?? EMPTY) days[d.date] = d;
    const assess = assessRaw ?? EMPTY;
    const latest = latestAssessment(assess, SEED_ASSESS);
    return {
      ready: dayList !== undefined && assessRaw !== undefined,
      settings,
      days,
      dayList: dayList ?? EMPTY,
      assess,
      latest,
      prtee: prteeRaw ?? EMPTY,
      appts: apptsRaw ?? EMPTY,
      prio: priorityKeys(latest),
      ranked: rankExercises(latest),
    };
  }, [dayList, s, assessRaw, prteeRaw, apptsRaw]);
}
