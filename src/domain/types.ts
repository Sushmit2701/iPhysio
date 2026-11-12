export const TEST_KEYS = ['ecrl', 'ecrb', 'ecu', 'sup', 'ed', 'nerve'] as const;
export type ExKey = (typeof TEST_KEYS)[number];

export const PAIN_CHARS = ['Burning', 'Sharp', 'Dull ache', 'Sore', 'None'] as const;
export type PainChar = (typeof PAIN_CHARS)[number];

export const GYM_TYPES = ['Legs', 'Push', 'Pull', 'Upper', 'Full body', 'Other'] as const;
export type GymType = (typeof GYM_TYPES)[number];

export const ELBOW_LOADS = ['Low', 'Medium', 'High'] as const;
export type ElbowLoad = (typeof ELBOW_LOADS)[number];

export const PHASE_ORDER = ['reduce', 'rebuild', 'return', 'reinforce'] as const;
export type Phase = (typeof PHASE_ORDER)[number];
export type Mode = 'iso' | 'pump' | 'full';

export const ADJUNCTS = ['strap', 'heat', 'massage', 'pillow', 'collagen'] as const;
export type Adjunct = (typeof ADJUNCTS)[number];

/** One logged set inside a guided session. */
export interface SetLog {
  reps?: number;
  holdS?: number;
  load?: string;
  at: number;
}

/** Fields shared by every synced record. updatedAt is epoch ms of the last local edit. */
export interface SyncMeta {
  updatedAt: number;
  deleted?: boolean;
}

export interface DayData {
  done?: Partial<Record<ExKey, boolean>>;
  load?: Partial<Record<ExKey, string>>;
  sets?: Partial<Record<ExKey, SetLog[]>>;
  painAM?: number | null;
  painRehab?: number | null;
  painWorst?: number | null;
  painPM?: number | null;
  char?: PainChar | null;
  fn?: { cap?: number | null; mug?: number | null; door?: number | null };
  sleepH?: number | null;
  sleepQ?: number | null;
  wokePain?: boolean;
  flare?: boolean;
  gym?: boolean;
  gymType?: GymType | null;
  gymElbow?: ElbowLoad | null;
  adj?: Partial<Record<Adjunct, boolean>>;
  note?: string;
}

export interface DayLog extends DayData, SyncMeta {
  date: string;
}

/** Map of YYYY-MM-DD to day data, the shape all logic functions take. */
export type Days = Record<string, DayData | undefined>;

export type Scores = Partial<Record<ExKey, number | null>>;

export interface Assessment extends SyncMeta {
  id: string;
  date: string;
  scores: Scores;
  finger?: string;
  ecrlBent?: number | null;
  note?: string;
}

export interface PrteeRecord extends SyncMeta {
  id: string;
  date: string;
  pain: number;
  func: number;
  total: number;
  pfg: number | null;
  items: Record<string, number>;
}

export type Theme = 'system' | 'light' | 'dark';

export interface Settings extends SyncMeta {
  id: 'settings';
  side: 'Left' | 'Right' | 'Both';
  phase: Phase;
  mode: Mode;
  start: string;
  remindOn: boolean;
  t1: string;
  t2: string;
  theme: Theme;
  sound: boolean;
  haptics: boolean;
  holdS: number;
  restS: number;
  isoSets: number;
}

export const APPT_KINDS = ['Scan request', 'Scan result', 'Clinic', 'Physio', 'Other'] as const;
export type ApptKind = (typeof APPT_KINDS)[number];

export interface Appointment extends SyncMeta {
  id: string;
  date: string;
  kind: ApptKind;
  title: string;
  detail: string;
}
