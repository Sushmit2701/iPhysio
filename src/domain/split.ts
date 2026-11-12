// "Train around it": a simple weekly split that keeps gym going while avoiding the
// patterns that load the painful tests. Practical suggestions, not prescriptions.
import type { ExKey } from './types';

export const AVOID: Record<ExKey, { avoid: string; swap: string }> = {
  ecrl: { avoid: 'Hammer curls, neutral-grip rows and anything lifting with the wrist tilted to the thumb side', swap: 'Machine or cable curls with a supported wrist, light and slow' },
  ecrb: { avoid: 'Heavy gripping with the wrist cocked back: pronated rows, reverse curls, wrist extension under load', swap: 'Use lifting straps; chest-supported machine rows' },
  ecu: { avoid: 'Ulnar-side wrist loading: heavy single-arm carries, kettlebell work with the wrist bent', swap: 'Two-handed or machine versions' },
  sup: { avoid: 'Supinated curls, chin-ups and twisting under load', swap: 'Neutral-grip lat pulldown with straps, light; machine biceps work' },
  ed: { avoid: 'Heavy grip: deadlifts, heavy rows, farmer carries, pull-ups', swap: 'Straps for pulls, trap-bar or machine work, hip thrusts instead of heavy deadlifts' },
  nerve: { avoid: 'Long holds with the arm overhead or out to the side with the wrist flexed', swap: 'Keep shoulder work short and the wrist neutral' },
};

export interface SplitDay {
  day: string;
  focus: string;
  detail: string;
}

/** Five gym days at most, never two elbow-heavy days back to back. */
export function trainAroundSplit(prio: ExKey[]): { week: SplitDay[]; avoid: { k: ExKey; avoid: string; swap: string }[] } {
  const gripHeavy = prio.some((k) => k === 'ed' || k === 'ecrb' || k === 'ecrl');
  const week: SplitDay[] = [
    { day: 'Mon', focus: 'Legs', detail: 'Squat, leg press, lunges, hamstring curls. Use straps or a belt squat if holding the bar hurts.' },
    { day: 'Tue', focus: 'Push (light)', detail: 'Machine chest press, dumbbell press with a neutral wrist, lateral raises, triceps on cable with rope. Keep loads at about 3/10 elbow pain.' },
    { day: 'Wed', focus: 'Rehab and rest', detail: 'Rehab session only. Walk or cycle for conditioning.' },
    { day: 'Thu', focus: 'Legs and core', detail: 'Hip thrusts, split squats, leg extensions, calf raises, planks on forearms if comfortable.' },
    {
      day: 'Fri',
      focus: gripHeavy ? 'Pull (strapped, light)' : 'Pull (light)',
      detail: gripHeavy
        ? 'Chest-supported machine rows and lat pulldown with straps, rear delts on machine. Skip curls for now.'
        : 'Machine rows, lat pulldown, rear delts. Light curls only if pain stays at 3/10 or less.',
    },
    { day: 'Sat', focus: 'Rehab and rest', detail: 'Rehab session. Optional easy cardio.' },
    { day: 'Sun', focus: 'Rest', detail: 'Rehab if it is a daily phase. Check next-morning pain against the 48-hour rule.' },
  ];
  return { week, avoid: prio.map((k) => ({ k, ...AVOID[k] })) };
}
