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

// ---------- Morning pain (second coaching video, 0:39 to 6:25) ----------
export const MORNING_WHY: { title: string; body: string }[] = [
  {
    title: 'Delayed response',
    body: 'Tendon pain from an activity, like lifting or sport, can take up to 48 hours to show. A bad morning can be paying for something from a day or two ago.',
  },
  {
    title: 'Less blood flow overnight',
    body: 'Tendons rely on movement for blood flow. Hours of lying still leave the tendon stiff and irritable on waking.',
  },
  {
    title: 'Sleeping position',
    body: 'Sleeping on your side or front can press on the elbow. Support the arm on a pillow with the elbow at 90 degrees, like a sling, so the forearm muscles and tendons stay relaxed.',
  },
];

export const ROUTINE = {
  circlesS: 60, // per direction
  curlReps: 100,
  steps: [
    'Wrist circles: 1 minute one way, then 1 minute the other way.',
    'Hammer curls with a very light weight: one set of 100, for blood flow, not strength.',
  ],
  note: 'Do it at bedtime and again in the morning. Keep pain at 3/10 or less: if the curls hurt, go lighter or do fewer.',
  source: 'From a second coaching video on morning pain (0:39 to 6:25). Practical guidance, not trial evidence.',
};

// ---------- Neck and shoulder ----------
export const NECK_LINKS: { title: string; body: string; signs: string }[] = [
  {
    title: 'Neck joints and muscles (most likely for stiffness and painful end-range rotation)',
    body: 'Irritated facet joints around C4 to C6, or levator scapulae, upper trapezius and scalenes, can refer a deep ache over the shoulder and outer upper arm. Lateral elbow pain often has a neck contribution, and treating the neck alongside elbow rehab has modest evidence of helping.',
    signs: 'Stiffness, pain at end-range rotation, pressing on the neck or holding end-range rotation reproduces the arm symptom.',
  },
  {
    title: 'Nerve root (C5, C6)',
    body: 'The skin over the outer deltoid is C5, and C5 and C6 also refer to the lateral elbow. Burning that comes and goes is more typical of nerve pain.',
    signs: 'Positive Spurling, distraction eases it, tension test positive, hand on head eases it, any weakness or reflex change.',
  },
  {
    title: 'Shoulder (rotator cuff, subacromial)',
    body: 'Shoulder pain typically refers to the deltoid insertion. Guarding a painful elbow changes how you grip, push and pull, and the shoulder takes up the slack, as can extra pressing and lateral raises.',
    signs: 'Painful arc, Hawkins or Neer positive, pain on resisted abduction or external rotation, pain lying on that side.',
  },
  {
    title: 'Trigger points',
    body: 'Supraspinatus trigger points classically refer to both the lateral deltoid and the lateral epicondyle.',
    signs: 'A tender spot in supraspinatus or infraspinatus that recreates the burning.',
  },
  {
    title: 'The rehab itself',
    body: 'The radial nerve test and glide position loads the nerve all the way up the arm. Repeating it often can leave the arm irritable.',
    signs: 'Started after testing or gliding, or after particular arm positions.',
  },
];

export const SPURLING = {
  how: [
    'Sit upright, shoulders relaxed.',
    'Extend the neck slightly, side-bend toward the painful side and rotate a little toward it.',
    'An examiner presses gently straight down through the top of the head for a few seconds. Compare both sides.',
  ],
  positive: 'Positive only if it reproduces the arm symptom (the deltoid burning, or symptoms down the arm). Neck pain alone is not positive.',
  accuracy:
    'Specificity is high (about 85 to 95%), so a positive test makes a nerve root likely. Sensitivity is low to moderate (about 30 to 60%), so a negative test does not rule it out, and a self-test misses more.',
  cluster:
    'Wainner cluster: Spurling positive, distraction eases symptoms, upper limb tension test A positive, rotation to that side under 60 degrees. Three of four makes a root likely; four of four very likely.',
  avoid: 'Skip it after recent neck trauma or with possible instability, and stop if it causes dizziness, double vision, drop attacks, both-arm symptoms or sharp shooting pain.',
};

export const NECK_CHECKS = [
  'Rotation range, left against right (under 60 degrees counts toward the cluster).',
  'Distraction: someone lifts the head gently. Easing of the arm burning points to a root.',
  'Shoulder abduction relief: hand on head. Easing points to a root.',
  'Hold end-range rotation or extension for 20 to 30 seconds, and press over the C4 to C6 facets, levator scapulae and upper trapezius. Reproducing the deltoid burning points to the neck.',
  'Neuro screen: deltoid and biceps power, biceps and brachioradialis reflexes, light touch over the outer deltoid.',
  'Shoulder: painful arc, Hawkins, resisted abduction and external rotation.',
];

export const NECK_ROUTINE = [
  'Gentle rotation and side-bending through the pain-free range, 5 to 10 each way, several times a day.',
  'Chin tucks: slide the head straight back, hold 5 seconds, 10 times.',
  'Shoulder blade setting: draw the shoulder blades back and down, hold 5 seconds, 10 times. Light rows are fine.',
  'Heat over the neck and upper shoulder if stiff.',
  'Screen at eye level, and break up long spells looking down at a phone or laptop.',
  'For now, ease off heavy shrugs and overhead pressing, and anything that makes you crane or brace through the neck.',
];

export const NECK_FLAGS =
  'Get reviewed if you notice weakness, numbness or spreading tingling, symptoms in both arms, night pain that does not ease with position, worsening, dizziness or trouble with balance or fine hand control. Neck stiffness with fever, headache or light sensitivity needs urgent care. Most mechanical neck pain settles in 2 to 6 weeks.';
