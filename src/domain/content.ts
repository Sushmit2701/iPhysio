// Clinical content ported from the v1 prototype and docs/protocol.md.
import type { ExKey, Mode, Phase } from './types';

export interface Variant {
  label: string;
  dose: string;
  note: string;
}

export interface PhaseInfo {
  name: string;
  tag: string;
  goal: string;
  intensity: string;
  volume: string;
  freq: string;
  variants: Partial<Record<Mode, Variant>>;
  advance: string;
}

export const PHASES: Record<Phase, PhaseInfo> = {
  reduce: {
    name: 'Reduce',
    tag: 'Calm the elbow and stabilise',
    goal: 'Bring pain down to about 3/10 and build a base to load from.',
    intensity: 'Low',
    volume: 'High',
    freq: 'Daily, 5 to 7 days a week',
    variants: {
      iso: {
        label: 'Isometric holds',
        dose: '3 to 5 sets of 30 to 45 s holds',
        note: 'Hold the working position still and rest between sets. Isometrics help calm tendon pain and are a safe starting point.',
      },
      pump: {
        label: 'Light pump work',
        dose: '2 to 3 sets of about 30 reps, very light',
        note: 'Very easy load, many reps, to bring blood flow to the area without overwhelming it.',
      },
    },
    advance:
      'Pain 3/10 or less through the day, no flare-ups with normal activity, morning pain easing, rehab tolerated without a spike afterwards.',
  },
  rebuild: {
    name: 'Rebuild',
    tag: 'Load the tendon more',
    goal: 'Raise the load gradually and rebuild strength without flare-ups.',
    intensity: 'Minimal to moderate',
    volume: 'Medium to high',
    freq: 'Daily, or alternate days if recovery is poor',
    variants: {
      full: {
        label: 'Full range, slow tempo',
        dose: '2 to 5 sets of 15 to 20 reps, 3 s down and 3 s up',
        note: 'Normal lifting and lowering through full range. Controlled tempo keeps stress on the injured fibres.',
      },
    },
    advance: 'Handling heavier sets with pain 3/10 or less during and for 48 h after, and everyday tasks (mug, door, jar) feel easy.',
  },
  return: {
    name: 'Return',
    tag: 'Back to normal training',
    goal: 'Resume full activity at your usual frequency while rehab continues.',
    intensity: 'Moderate',
    volume: 'Moderate',
    freq: 'Alternate days',
    variants: {
      full: { label: 'Full range, heavier', dose: '2 to 3 sets of 10 to 15 reps', note: 'Prioritise the most painful tests. Fewer reps, heavier load.' },
    },
    advance: 'Back to your usual training volume with no extra pain the next morning.',
  },
  reinforce: {
    name: 'Reinforce',
    tag: 'Keep it from coming back',
    goal: 'Build capacity so the tendon stays resilient.',
    intensity: 'Moderate to high',
    volume: 'Low to moderate',
    freq: '2 to 3 days a week',
    variants: {
      full: {
        label: 'Plyometrics or heavy slow resistance',
        dose: 'Plyometrics 2 to 3 sets of 8 to 15, or heavy slow resistance with 3 s down and 3 s up',
        note: 'Fast, lighter reps mimic sport loading. Heavy slow resistance builds capacity.',
      },
    },
    advance: 'Maintenance. Keep going 2 to 3 times a week.',
  },
};

export function variantFor(phase: Phase, mode: Mode): Variant {
  const p = PHASES[phase];
  return p.variants[mode] ?? (Object.values(p.variants)[0] as Variant);
}

/** Effective mode: only the Reduce phase offers iso/pump; other phases are full range. */
export function effectiveMode(phase: Phase, mode: Mode): Mode {
  if (phase !== 'reduce') return 'full';
  return mode === 'full' ? 'iso' : mode;
}

/** Default targets for the guided session, derived from the phase dose table. */
export interface SessionTarget {
  kind: 'hold' | 'reps' | 'tempo';
  sets: number;
  reps: number; // reps per set, or 0 for holds
  tempo: boolean;
}
export function sessionTarget(phase: Phase, mode: Mode, ex: ExKey, isoSets = 4): SessionTarget {
  const m = effectiveMode(phase, mode);
  if (ex === 'nerve') return { kind: 'reps', sets: 2, reps: 10, tempo: false };
  if (m === 'iso') return { kind: 'hold', sets: isoSets, reps: 0, tempo: false };
  if (m === 'pump') return { kind: 'reps', sets: 3, reps: 30, tempo: false };
  if (phase === 'rebuild') return { kind: 'tempo', sets: 3, reps: 15, tempo: true };
  if (phase === 'return') return { kind: 'tempo', sets: 3, reps: 12, tempo: true };
  return { kind: 'tempo', sets: 3, reps: 10, tempo: true };
}

export interface TestInfo {
  k: ExKey;
  name: string;
  short: string;
  setup: string;
  confirm?: string;
  life: string;
  finger?: boolean;
  optional?: boolean;
}

export const TESTS: TestInfo[] = [
  {
    k: 'ecrl',
    name: 'ECRL (extensor carpi radialis longus)',
    short: 'ECRL',
    setup:
      'Arm straight, grip a racket handle or broomstick. Push the handle away from you (wrist toward the thumb side) while the other hand resists. Pain is usually just above the bony point of the elbow.',
    confirm: 'Confirm: repeat with the elbow bent. Less pain suggests ECRL.',
    life: 'Hammer curls, lifting a mug with the arm straight, topspin forehand.',
  },
  {
    k: 'ecrb',
    name: 'ECRB (extensor carpi radialis brevis)',
    short: 'ECRB',
    setup: 'Hold the handle out with the wrist cocked back (the "motorcycle" position). With the other hand twist the handle away from you.',
    life: 'The classic tennis elbow tendon, on the outside bony point of the elbow.',
  },
  {
    k: 'ecu',
    name: 'ECU (extensor carpi ulnaris)',
    short: 'ECU',
    setup: 'Arm straight, grip firmly. Pull the handle toward you (wrist toward the little finger side) against the other hand.',
    life: 'Ulnar side wrist movements.',
  },
  {
    k: 'sup',
    name: 'Supinator',
    short: 'Supinator',
    setup: 'Elbow at 90 degrees. Turn the forearm outward (palm up, like holding a bowl of soup) against the other hand.',
    life: 'Opening jars and bottle caps, handshakes, twisting.',
  },
  {
    k: 'ed',
    name: 'Finger extensors (extensor digitorum)',
    short: 'Finger extensors',
    setup:
      'Arm straight, fingers extended and hand open. Push down on each finger in turn (2 to 5), trying to break the position. Score the most painful finger.',
    life: 'Gripping a racket, mug or handle.',
    finger: true,
  },
  {
    k: 'nerve',
    name: 'Radial nerve (radial tunnel)',
    short: 'Radial nerve',
    setup:
      'Make a fist with the thumb tucked across it, arm at your side, and curl the wrist fully. Turn the shoulder in so the knuckles face out. Press the shoulder down with the other hand and lift the arm out to the side until level with the shoulder. Shooting pain down the arm in the radial nerve pattern is positive.',
    life: 'Shooting pain down the forearm.',
    optional: true,
  },
];
export const TNAME = Object.fromEntries(TESTS.map((t) => [t.k, t.short])) as Record<ExKey, string>;

export interface ExerciseInfo {
  name: string;
  target: string;
  how: string[];
  iso: string;
  /** What the tempo cue says on each half of a rep. */
  cue: [string, string];
}

export const EX: Record<ExKey, ExerciseInfo> = {
  ecrl: {
    name: 'Hammer curl with radial deviation',
    target: 'ECRL',
    how: [
      'Hold a dumbbell by its far end so the weight hangs above your hand (this gives leverage).',
      'Hammer-curl grip, thumb up. Curl toward the shoulder while tilting the wrist toward the thumb side.',
      'Lower slowly. Use a light weight to start.',
    ],
    iso: 'Hold the half-way curl position with the wrist tilted toward the thumb side.',
    cue: ['Lower', 'Curl up'],
  },
  ecrb: {
    name: 'Wrist extension over a foam roller',
    target: 'ECRB',
    how: [
      'Rest the arm straight on a foam roller, roller just above the elbow, palm down, hand hanging off the end.',
      'Relax the wrist down, then lift all the way up.',
    ],
    iso: 'Hold the wrist slightly extended in the middle position.',
    cue: ['Lower', 'Lift'],
  },
  ecu: {
    name: 'Ulnar deviation',
    target: 'ECU',
    how: [
      'Hold the dumbbell at the top end so the weight hangs behind you, arm at your side.',
      'Bend the wrist toward the little finger, control up, squeeze, control down. Fine, slow movement.',
    ],
    iso: 'Hold the wrist half-way toward the little finger side.',
    cue: ['Lower', 'Lift'],
  },
  sup: {
    name: 'Supination with dumbbell',
    target: 'Supinator',
    how: [
      'Arm straight on the foam roller. Hold the dumbbell at the bottom end so the weight is on top (leverage).',
      'Rotate the forearm open (palm up) and closed, slowly. Hold it sideways or by the end, whichever is more comfortable.',
    ],
    iso: 'Hold the forearm half-way rotated with the weight balanced.',
    cue: ['Turn in', 'Turn out'],
  },
  ed: {
    name: 'Finger extension with a band',
    target: 'Finger extensors',
    how: ['Put the fingers through a loop band. Arm straight, resting on the foam roller.', 'Slowly open the hand against the band and close again.'],
    iso: 'Hold the fingers open against the band.',
    cue: ['Close', 'Open'],
  },
  nerve: {
    name: 'Radial nerve glide',
    target: 'Radial nerve',
    how: [
      'Take the test position (fist, wrist curled, shoulder turned in, arm out to the side).',
      'Tilt the head toward the same shoulder, then away to the other side, alternating. Glide, do not stretch.',
    ],
    iso: 'Nerve glides are not held.',
    cue: ['Tilt toward', 'Tilt away'],
  },
};

export const ITEMS_PAIN = [
  'Pain at rest',
  'Pain with repeated arm movement',
  'Pain carrying a plastic bag of groceries',
  'Pain when it is at its least',
  'Pain when it is at its worst',
];
export const ITEMS_FUNC = [
  'Turn a doorknob or key',
  'Carry a grocery bag or briefcase by the handle',
  'Lift a full coffee cup or glass to the mouth',
  'Open a jar',
  'Pull up trousers',
  'Wring out a wet cloth',
  'Personal care (dressing, washing)',
  'Household work',
  'Your usual work',
  'Recreation or sport, including the gym',
];

export const GYM_LETTER: Record<string, string> = { Legs: 'L', Push: 'Ps', Pull: 'Pl', Upper: 'U', 'Full body': 'F', Other: 'O' };

export const ADJ_LABEL = {
  strap: 'Used a strap',
  heat: 'Heat',
  massage: 'Massage or pin and stretch',
  pillow: 'Elbow on pillow at 90 degrees',
  collagen: 'Collagen 20 g with vitamin C',
} as const;

export const RED_FLAGS =
  'Seek review if pain is worsening, wakes you at night, or comes with numbness, tingling, weakness or shooting pain down the arm.';
export const SOURCE_NOTE =
  'Built from a coaching video (1:12:54 to 2:38:43). The numbers are practical guidance, not trial-derived thresholds, and this app is not a diagnosis.';
