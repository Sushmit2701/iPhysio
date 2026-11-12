import { useEffect, useRef, useState, type ReactNode } from 'react';
import { PainScale, Seg, Sheet, Stepper, Toggle } from '../../ui/controls';
import { useApp } from '../../ui/app-context';
import { useDayEdit } from '../../ui/useEdit';
import { ADJ_LABEL } from '../../domain/content';
import { ADJUNCTS, ELBOW_LOADS, GYM_TYPES, PAIN_CHARS, type DayLog, type DayData } from '../../domain/types';
import { weekdayDate } from '../../domain/dates';
import { Icon } from '../../ui/Icon';

export type FlowKind = 'morning' | 'evening';

interface Step {
  key: string;
  title: string;
  hint?: string;
  body: (d: DayData, set: SetFn, next: () => void) => ReactNode;
  /** Auto-advance after a value is chosen. */
  auto?: boolean;
}
type SetFn = (fn: (d: DayLog) => void, msg?: string) => void;

const painStep = (key: 'painAM' | 'painRehab' | 'painWorst' | 'painPM', title: string, hint: string): Step => ({
  key,
  title,
  hint,
  auto: true,
  body: (d, set) => (
    <PainScale name={key} label={title} value={d[key]} onChange={(v) => set((x) => void (x[key] = v), `${title}: ${v}/10`)} />
  ),
});

const fnStep: Step = {
  key: 'fn',
  title: 'Daily tasks',
  hint: 'Pain with each task, 0 to 10. Skip any you did not do today.',
  body: (d, set) => (
    <div className="flex flex-col gap-5">
      {(
        [
          ['cap', 'Twisting a bottle cap'],
          ['mug', 'Gripping a mug'],
          ['door', 'Using a door handle'],
        ] as const
      ).map(([k, l]) => (
        <div key={k} className="flex flex-col gap-2">
          <div className="label">{l}</div>
          <PainScale name={`fn.${k}`} size="md" label={l} value={d.fn?.[k]} onChange={(v) => set((x) => void (x.fn = { ...x.fn, [k]: v }), `${l}: ${v}/10`)} />
        </div>
      ))}
    </div>
  ),
};

export const STEPS: Record<FlowKind, Step[]> = {
  morning: [
    painStep('painAM', 'Morning pain on waking', 'How does the elbow feel right now, 0 is none and 10 is the worst imaginable.'),
    {
      key: 'char',
      title: 'What does it feel like?',
      hint: 'Burning toward sharp, aching, sore and then none is progress even if the number is unchanged.',
      auto: true,
      body: (d, set) => (
        <div className="flex flex-col gap-2">
          {PAIN_CHARS.map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={d.char === c}
              onClick={() => set((x) => void (x.char = c), `Pain felt: ${c.toLowerCase()}`)}
              className={`chip min-h-14 rounded-xl border px-4 text-left text-lg font-semibold ${d.char === c ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-surface'}`}
            >
              {c}
            </button>
          ))}
        </div>
      ),
    },
    {
      key: 'sleep',
      title: 'Sleep',
      body: (d, set) => (
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <div className="label">Hours slept</div>
            <Stepper label="hours slept" value={d.sleepH} start={7} step={0.5} min={0} max={14} unit="h" onChange={(v) => set((x) => void (x.sleepH = v))} />
            <div className="grid grid-cols-5 gap-2">
              {[5, 6, 7, 8, 9].map((h) => (
                <button key={h} type="button" aria-pressed={d.sleepH === h} className={`chip h-12 rounded-xl border font-semibold ${d.sleepH === h ? 'border-accent bg-accent-soft text-accent' : 'border-line bg-surface'}`} onClick={() => set((x) => void (x.sleepH = h))}>
                  {h} h
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <div className="label">Quality, 1 poor to 5 great</div>
            <PainScale name="sleepQ" label="Sleep quality" ramp="quality" from={1} to={5} size="md" value={d.sleepQ} onChange={(v) => set((x) => void (x.sleepQ = v))} />
          </div>
          <Toggle on={!!d.wokePain} onChange={(v) => set((x) => void (x.wokePain = v))}>
            Woke up because of elbow pain
          </Toggle>
        </div>
      ),
    },
  ],
  evening: [
    painStep('painRehab', 'Pain during rehab', 'The highest pain during today’s exercises. Target: 3/10 or less.'),
    painStep('painWorst', 'Worst pain today', 'The worst moment of the day, at any time.'),
    painStep('painPM', 'Evening pain', 'How it feels now, before bed.'),
    fnStep,
    {
      key: 'gym',
      title: 'Gym',
      body: (d, set) => (
        <div className="flex flex-col gap-4">
          <Toggle on={!!d.gym} onChange={(v) => set((x) => void (x.gym = v), v ? 'Marked as a training day' : 'Marked as a rest day')}>
            Trained today
          </Toggle>
          {d.gym && (
            <>
              <div className="flex flex-col gap-2">
                <div className="label">What did you train?</div>
                <Seg label="Session type" options={GYM_TYPES} value={d.gymType} onChange={(v) => set((x) => void (x.gymType = v))} />
              </div>
              <div className="flex flex-col gap-2">
                <div className="label">How much did it load the elbow?</div>
                <Seg label="Elbow load" options={ELBOW_LOADS} value={d.gymElbow} onChange={(v) => set((x) => void (x.gymElbow = v))} />
              </div>
            </>
          )}
        </div>
      ),
    },
    {
      key: 'flags',
      title: 'Anything else today?',
      body: (d, set) => (
        <div className="flex flex-col gap-2">
          <Toggle tone="bad" on={!!d.flare} onChange={(v) => set((x) => void (x.flare = v), v ? 'Flare-up day logged' : 'Flare-up removed')}>
            Flare-up day
          </Toggle>
          {ADJUNCTS.map((a) => (
            <Toggle key={a} on={!!d.adj?.[a]} onChange={(v) => set((x) => void (x.adj = { ...x.adj, [a]: v }))}>
              {ADJ_LABEL[a]}
            </Toggle>
          ))}
        </div>
      ),
    },
    {
      key: 'note',
      title: 'Notes',
      hint: 'What you did, what set it off. Optional.',
      body: (d, set) => <NoteField value={d.note ?? ''} onSave={(v) => set((x) => void (x.note = v))} />,
    },
  ],
};

export function NoteField({ value, onSave, label = 'Notes' }: { value: string; onSave: (v: string) => void; label?: string }) {
  const [v, setV] = useState(value);
  const latest = useRef(v);
  const saved = useRef(value);
  const save = useRef(onSave);
  latest.current = v;
  save.current = onSave;
  const flush = () => {
    if (latest.current !== saved.current) {
      saved.current = latest.current;
      save.current(latest.current);
    }
  };
  // Save on blur and when the sheet closes, never per keystroke
  useEffect(() => flush, []);
  return (
    <textarea
      aria-label={label}
      className="field-input min-h-40"
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={flush}
      placeholder="e.g. heavy rows, carried shopping"
    />
  );
}

export function CheckInFlow({ kind, date, startAt = 0, onClose }: { kind: FlowKind; date: string; startAt?: number; onClose: () => void }) {
  const { days } = useApp();
  const edit = useDayEdit();
  const steps = STEPS[kind];
  const [i, setI] = useState(Math.min(startAt, steps.length - 1));
  const step = steps[i];
  const d: DayData = days[date] ?? {};
  const advanceT = useRef<number | undefined>(undefined);
  const touch = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => () => clearTimeout(advanceT.current), []);

  const next = () => {
    clearTimeout(advanceT.current);
    if (i < steps.length - 1) setI(i + 1);
    else onClose();
  };
  const back = () => {
    clearTimeout(advanceT.current);
    if (i > 0) setI(i - 1);
  };
  const set: SetFn = (fn, msg) => {
    void edit(date, fn, msg);
    if (step.auto) {
      clearTimeout(advanceT.current);
      // Short pause so the selected state is visible before moving on
      advanceT.current = window.setTimeout(() => setI((n) => Math.min(n + 1, steps.length - 1)), i < steps.length - 1 ? 350 : 0);
    }
  };

  return (
    <Sheet
      title={`${kind === 'morning' ? 'Morning' : 'Evening'} check-in · ${weekdayDate(date)}`}
      onClose={onClose}
      footer={
        <div className="flex items-center gap-3">
          <button type="button" className="btn h-14 w-14 p-0" onClick={back} disabled={i === 0} aria-label="Previous question">
            <Icon name="left" />
          </button>
          <div className="flex grow justify-center gap-1.5" aria-label={`Question ${i + 1} of ${steps.length}`} role="img">
            {steps.map((s, j) => (
              <span key={s.key} className="h-2 rounded-full transition-all" style={{ width: j === i ? 22 : 8, background: j <= i ? 'var(--accent)' : 'var(--line)' }} />
            ))}
          </div>
          <button type="button" className="btn btn-primary h-14 min-w-28" onClick={next}>
            {i === steps.length - 1 ? 'Done' : 'Next'}
          </button>
        </div>
      }
    >
      <div
        className="flex min-h-[60vh] flex-col gap-4"
        onTouchStart={(e) => (touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY })}
        onTouchEnd={(e) => {
          const t = touch.current;
          touch.current = null;
          if (!t) return;
          const dx = e.changedTouches[0].clientX - t.x;
          const dy = e.changedTouches[0].clientY - t.y;
          if (Math.abs(dx) > 70 && Math.abs(dx) > 2 * Math.abs(dy)) (dx < 0 ? next : back)();
        }}
      >
        <div key={step.key} className="anim-in flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <p className="text-sm font-semibold uppercase tracking-wide text-muted">
              {i + 1} of {steps.length}
            </p>
            <h3 className="text-2xl">{step.title}</h3>
            {step.hint && <p className="hint">{step.hint}</p>}
          </div>
          {step.body(d, set, next)}
        </div>
      </div>
    </Sheet>
  );
}

/** One-line summaries of what a flow has captured, for the Today cards. */
export function flowSummary(kind: FlowKind, d: DayData): { done: number; total: number; text: string } {
  const parts: string[] = [];
  let done = 0;
  if (kind === 'morning') {
    if (d.painAM != null) (parts.push(`Pain ${d.painAM}/10`), done++);
    if (d.char) (parts.push(d.char.toLowerCase()), done++);
    if (d.sleepH != null || d.sleepQ != null) {
      parts.push([d.sleepH != null ? `${d.sleepH} h` : '', d.sleepQ != null ? `quality ${d.sleepQ}/5` : ''].filter(Boolean).join(', '));
      done++;
    }
    return { done, total: 3, text: parts.join(' · ') };
  }
  if (d.painRehab != null) (parts.push(`Rehab ${d.painRehab}`), done++);
  if (d.painWorst != null) (parts.push(`worst ${d.painWorst}`), done++);
  if (d.painPM != null) (parts.push(`evening ${d.painPM}`), done++);
  if (d.fn && Object.values(d.fn).some((v) => v != null)) done++;
  if (d.gym != null) (parts.push(d.gym ? `gym${d.gymType ? ' (' + d.gymType + ')' : ''}` : 'rest day'), done++);
  if (d.flare) parts.push('flare-up');
  return { done, total: 5, text: parts.join(' · ') };
}

/** Index of the first unanswered step, so reopening a flow resumes where it was left. */
export function firstOpenStep(kind: FlowKind, d: DayData): number {
  const answered: Record<string, boolean> = {
    painAM: d.painAM != null,
    char: !!d.char,
    sleep: d.sleepH != null || d.sleepQ != null,
    painRehab: d.painRehab != null,
    painWorst: d.painWorst != null,
    painPM: d.painPM != null,
    fn: !!d.fn && Object.values(d.fn).some((v) => v != null),
    gym: d.gym != null,
  };
  const i = STEPS[kind].findIndex((s) => s.key in answered && !answered[s.key]);
  return i < 0 ? 0 : i;
}
