import type { Assessment, Settings } from './types';
import { todayStr } from './dates';

/** First movement screen, from the brief. Radial nerve not tested. */
export const SEED_ASSESS: Assessment = {
  id: '2026-11-12',
  date: '2026-11-12',
  scores: { ecrl: 8, ecrb: 4, ecu: 4, sup: 8, ed: 8, nerve: null },
  finger: '3rd (middle)',
  ecrlBent: null,
  note: 'First screen from the video test',
  updatedAt: 0,
};

export function defaultSettings(): Settings {
  return {
    id: 'settings',
    side: 'Left',
    phase: 'reduce',
    mode: 'iso',
    start: '2026-11-12' <= todayStr() ? '2026-11-12' : todayStr(),
    remindOn: true,
    t1: '08:00',
    t2: '20:00',
    theme: 'system',
    sound: true,
    haptics: true,
    holdS: 40,
    restS: 60,
    isoSets: 4,
    updatedAt: 0,
  };
}
