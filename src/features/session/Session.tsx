import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../../ui/app-context';
import { PainScale, Seg, Sheet, StatusBox } from '../../ui/controls';
import { Icon } from '../../ui/Icon';
import { go } from '../../ui/route';
import { useDayEdit } from '../../ui/useEdit';
import { beep, haptic, keepAwake, unlockAudio } from '../../ui/feedback';
import { EX, effectiveMode, sessionTarget } from '../../domain/content';
import { patchSettings } from '../../db/repo';
import type { ExKey, SetLog } from '../../domain/types';
import { ExerciseHowTo } from '../today/ExerciseHowTo';

type Stage = 'intro' | 'ready' | 'work' | 'rest' | 'pain' | 'finish';
const READY_S = 3;
const HALF_S = 3; // 3 s down, 3 s up

function useNow(active: boolean) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

export function Session({ date }: { date: string }) {
  const { prio, settings, days, dayList } = useApp();
  const edit = useDayEdit();
  const queue = prio;
  const [exIdx, setExIdx] = useState(0);
  const [stage, setStage] = useState<Stage>('intro');
  const [setNo, setSetNo] = useState(0); // sets completed for current exercise
  const [startAt, setStartAt] = useState(0);
  const [pausedAt, setPausedAt] = useState<number | null>(null);
  const [reps, setReps] = useState(0);
  const k: ExKey | undefined = queue[exIdx];
  const mode = effectiveMode(settings.phase, settings.mode);
  const target = k ? sessionTarget(settings.phase, settings.mode, k, settings.isoSets) : null;
  const holdS = settings.holdS;
  const restS = settings.restS;
  const day = days[date] ?? {};

  const lastLoad = useMemo(() => {
    if (!k) return '';
    const prev = [...dayList].filter((d) => d.date <= date && d.load?.[k]).sort((a, b) => (a.date < b.date ? 1 : -1))[0];
    return prev?.load?.[k] ?? '';
  }, [dayList, date, k]);
  const [load, setLoad] = useState('');
  useEffect(() => setLoad(lastLoad), [k, lastLoad]);

  useEffect(() => keepAwake(), []);

  const timed = stage === 'ready' || stage === 'work' || stage === 'rest';
  const now = useNow(timed && pausedAt === null);
  const elapsed = ((pausedAt ?? now) - startAt) / 1000;
  const fired = useRef('');

  const cue = (kind: 'start' | 'end' | 'tick-down' | 'tick-up' | 'count') => {
    const f = { start: 880, end: 660, 'tick-down': 440, 'tick-up': 620, count: 520 }[kind];
    beep(settings.sound, f, kind === 'end' ? 300 : 110);
    if (kind === 'start' || kind === 'end') haptic(settings.haptics, kind === 'end' ? [60, 60, 60] : 30);
  };

  const begin = (s: Stage) => {
    setStage(s);
    setStartAt(Date.now());
    setPausedAt(null);
    fired.current = '';
  };

  const saveSet = (s: Omit<SetLog, 'at'>) => {
    if (!k) return;
    const rec: SetLog = { ...s, load: load.trim() || undefined, at: Date.now() };
    void edit(date, (x) => {
      x.sets = { ...x.sets, [k]: [...(x.sets?.[k] ?? []), rec] };
      if (load.trim()) x.load = { ...x.load, [k]: load.trim() };
    });
  };

  const finishExercise = (markDone: boolean) => {
    if (k && markDone) void edit(date, (x) => void (x.done = { ...x.done, [k]: true }), `${EX[k].name}: done`);
    setSetNo(0);
    setReps(0);
    if (exIdx < queue.length - 1) {
      setExIdx(exIdx + 1);
      setStage('intro');
    } else setStage('pain');
  };

  const endSet = (log: Omit<SetLog, 'at'>) => {
    cue('end');
    saveSet(log);
    const n = setNo + 1;
    setSetNo(n);
    setReps(0);
    if (target && n >= target.sets) finishExercise(true);
    else begin('rest');
  };

  // Drive the timers from timestamps so they survive the page being paused in the background
  useEffect(() => {
    if (!target || pausedAt !== null) return;
    const once = (id: string, f: () => void) => {
      if (fired.current !== id) {
        fired.current = id;
        f();
      }
    };
    if (stage === 'ready') {
      const left = Math.ceil(READY_S - elapsed);
      if (left > 0) once(`ready${left}`, () => beep(settings.sound, 500, 80));
      else once('go', () => {
        cue('start');
        begin('work');
      });
    } else if (stage === 'rest' && elapsed >= restS) {
      once('rest-end', () => begin('ready'));
    } else if (stage === 'work' && target.kind === 'hold' && elapsed >= holdS) {
      once('hold-end', () => endSet({ holdS }));
    } else if (stage === 'work' && target.kind === 'tempo') {
      const half = Math.floor(elapsed / HALF_S);
      const done = Math.floor(half / 2);
      if (done >= target.reps) once('tempo-end', () => endSet({ reps: target.reps }));
      else once(`h${half}`, () => cue(half % 2 === 0 ? 'tick-down' : 'tick-up'));
    }
  });

  const pause = () => setPausedAt(Date.now());
  const resume = () => {
    if (pausedAt) setStartAt(startAt + (Date.now() - pausedAt));
    setPausedAt(null);
  };

  if (!queue.length)
    return (
      <Sheet title="Guided session" onClose={() => go('today', date)}>
        <StatusBox tone="none" title="No priority exercises yet">
          Score the movement screen on the Tests screen first. Your top three painful tests become the session.
        </StatusBox>
        <button type="button" className="btn btn-primary" onClick={() => go('tests', 'screen')}>
          Open movement screen
        </button>
      </Sheet>
    );

  const title = stage === 'pain' || stage === 'finish' ? 'Session complete' : `${exIdx + 1} of ${queue.length} · ${k ? EX[k].name : ''}`;
  const footerBtns = (
    <div className="flex gap-3">
      {(stage === 'work' || stage === 'rest') && (
        <button type="button" className="btn h-14 grow" onClick={pausedAt ? resume : pause}>
          <Icon name={pausedAt ? 'play' : 'pause'} /> {pausedAt ? 'Resume' : 'Pause'}
        </button>
      )}
      {stage === 'rest' && (
        <button type="button" className="btn btn-primary h-14 grow" onClick={() => begin('ready')}>
          <Icon name="skip" /> Skip rest
        </button>
      )}
      {stage === 'work' && target?.kind === 'hold' && (
        <button type="button" className="btn h-14 grow" onClick={() => endSet({ holdS: Math.round(elapsed) })}>
          End hold early
        </button>
      )}
      {stage === 'work' && target?.kind === 'tempo' && (
        <button type="button" className="btn h-14 grow" onClick={() => endSet({ reps: Math.floor(elapsed / (2 * HALF_S)) })}>
          End set
        </button>
      )}
    </div>
  );

  return (
    <Sheet title={title} onClose={() => go('today', date)} footer={stage === 'work' || stage === 'rest' ? footerBtns : undefined}>
      {k && target && stage === 'intro' && (
        <div className="anim-in flex flex-col gap-4">
          <div>
            <h3 className="text-2xl">{EX[k].name}</h3>
            <p className="hint">
              {EX[k].target} ·{' '}
              {target.kind === 'hold'
                ? `${target.sets} holds of ${holdS} s, ${restS} s rest`
                : target.kind === 'tempo'
                  ? `${target.sets} sets of ${target.reps}, 3 s down and 3 s up`
                  : `${target.sets} sets of about ${target.reps} reps`}
              {setNo > 0 && ` · ${setNo} done`}
            </p>
          </div>
          <ExerciseHowTo k={k} mode={mode} />
          {target.kind === 'hold' && (
            <div className="flex flex-col gap-2">
              <div className="label">Hold length</div>
              <Seg label="Hold length" options={[30, 35, 40, 45].map((s) => ({ v: String(s), label: `${s} s` }))} value={String(holdS)} onChange={(v) => void patchSettings({ holdS: Number(v) })} />
            </div>
          )}
          <label className="flex flex-col gap-1">
            <span className="label">Load</span>
            <input className="field-input" value={load} onChange={(e) => setLoad(e.target.value)} placeholder="e.g. 2 kg, or green band" />
          </label>
          <button
            type="button"
            className="btn btn-primary min-h-16 text-xl"
            onClick={() => {
              unlockAudio();
              if (target.kind === 'reps') begin('work');
              else begin('ready');
            }}
          >
            <Icon name="play" /> Start set {setNo + 1}
          </button>
          <div className="flex gap-3">
            <button type="button" className="btn grow" onClick={() => finishExercise(false)}>
              Skip exercise
            </button>
            {setNo > 0 && (
              <button type="button" className="btn grow" onClick={() => finishExercise(true)}>
                Finish with {setNo} set{setNo > 1 ? 's' : ''}
              </button>
            )}
          </div>
        </div>
      )}

      {stage === 'ready' && (
        <BigTimer label="Get into position" value={Math.max(1, Math.ceil(READY_S - elapsed))} frac={elapsed / READY_S} sub={`Set ${setNo + 1} of ${target?.sets}`} />
      )}

      {stage === 'work' && target?.kind === 'hold' && (
        <BigTimer label="Hold" value={Math.max(0, Math.ceil(holdS - elapsed))} frac={elapsed / holdS} sub={`Set ${setNo + 1} of ${target.sets}${pausedAt ? ' · paused' : ''}`} unit="s" />
      )}

      {stage === 'work' && target?.kind === 'tempo' && k && <Tempo elapsed={elapsed} reps={target.reps} cue={EX[k].cue} sub={`Set ${setNo + 1} of ${target.sets}${pausedAt ? ' · paused' : ''}`} />}

      {stage === 'work' && target?.kind === 'reps' && (
        <div className="flex flex-col items-center gap-4">
          <p className="text-sm font-semibold uppercase tracking-wide text-muted">
            Set {setNo + 1} of {target.sets} · target {target.reps}
          </p>
          <button
            type="button"
            aria-label={`Count a rep, ${reps} so far`}
            onClick={() => {
              haptic(settings.haptics);
              beep(settings.sound, 520, 50, 0.08);
              setReps(reps + 1);
            }}
            className="grid aspect-square w-full max-w-80 place-items-center rounded-full border-4 border-accent bg-accent-soft font-display text-8xl font-bold text-accent select-none"
          >
            <span className="tabular">{reps}</span>
          </button>
          <p className="hint">Tap the circle for each rep.</p>
          <div className="flex w-full gap-3">
            <button type="button" className="btn h-14 w-20" disabled={reps === 0} onClick={() => setReps(reps - 1)} aria-label="Remove a rep">
              <Icon name="minus" />
            </button>
            <button type="button" className="btn btn-primary h-14 grow" onClick={() => endSet({ reps })}>
              Set done ({reps} reps)
            </button>
          </div>
        </div>
      )}

      {stage === 'rest' && <BigTimer label="Rest" value={Math.max(0, Math.ceil(restS - elapsed))} frac={elapsed / restS} sub={`Next: set ${setNo + 1} of ${target?.sets}${pausedAt ? ' · paused' : ''}`} unit="s" tone="muted" />}

      {stage === 'pain' && (
        <div className="anim-in flex flex-col gap-4">
          <h3 className="text-2xl">Pain during rehab</h3>
          <p className="hint">The highest pain during the session. Target is 3/10 or less, and for 48 hours after.</p>
          <PainScale
            name="painRehab"
            label="Pain during rehab"
            value={day.painRehab}
            onChange={(v) => {
              void edit(date, (x) => void (x.painRehab = v), `Pain during rehab: ${v}/10`);
              window.setTimeout(() => setStage('finish'), 350);
            }}
          />
          <button type="button" className="btn" onClick={() => setStage('finish')}>
            Skip
          </button>
        </div>
      )}

      {stage === 'finish' && (
        <div className="anim-in flex flex-col gap-4">
          <StatusBox tone="ok" icon="check" title="Session saved">
            <ul className="mt-1 flex flex-col gap-1">
              {queue.map((q) => (
                <li key={q}>
                  {EX[q].name}: {day.done?.[q] ? `${day.sets?.[q]?.length ?? 0} sets` : 'skipped'}
                </li>
              ))}
            </ul>
          </StatusBox>
          {day.painRehab != null && day.painRehab > 3 && (
            <StatusBox tone="mid" icon="alert" title="Above the 3/10 target">
              Next time, lower the load or shorten the holds. Watch the next 48 hours.
            </StatusBox>
          )}
          <button type="button" className="btn btn-primary min-h-14" onClick={() => go('today', date)}>
            Back to today
          </button>
        </div>
      )}
    </Sheet>
  );
}

function BigTimer({ label, value, frac, sub, unit, tone = 'accent' }: { label: string; value: number; frac: number; sub: string; unit?: string; tone?: 'accent' | 'muted' }) {
  const r = 120;
  const c = 2 * Math.PI * r;
  const f = Math.min(1, Math.max(0, frac));
  const color = tone === 'accent' ? 'var(--accent)' : 'var(--muted)';
  return (
    <div className="flex flex-col items-center gap-3 py-2" role="timer" aria-live="off" aria-label={`${label}, ${value} ${unit === 's' ? 'seconds' : ''} left`}>
      <p className="text-sm font-semibold uppercase tracking-wide text-muted">{sub}</p>
      <div className="relative w-full max-w-80">
        <svg viewBox="0 0 280 280" className="w-full -rotate-90" aria-hidden>
          <circle cx={140} cy={140} r={r} fill="none" stroke="var(--line)" strokeWidth={16} />
          <circle cx={140} cy={140} r={r} fill="none" stroke={color} strokeWidth={16} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * f} style={{ transition: 'stroke-dashoffset 100ms linear' }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-2xl font-bold" style={{ color }}>
            {label}
          </span>
          <span className="tabular font-display text-8xl font-bold leading-none">{value}</span>
          {unit && <span className="text-lg text-muted">seconds</span>}
        </div>
      </div>
    </div>
  );
}

function Tempo({ elapsed, reps, cue, sub }: { elapsed: number; reps: number; cue: [string, string]; sub: string }) {
  const half = Math.floor(elapsed / HALF_S);
  const inHalf = (elapsed % HALF_S) / HALF_S;
  const down = half % 2 === 0;
  const pos = down ? inHalf : 1 - inHalf; // 0 = top, 1 = bottom
  const rep = Math.min(reps, Math.floor(half / 2));
  const secs = Math.ceil(HALF_S - (elapsed % HALF_S));
  return (
    <div className="flex flex-col items-center gap-4" role="timer" aria-label={`${down ? cue[0] : cue[1]}, rep ${rep + 1} of ${reps}`}>
      <p className="text-sm font-semibold uppercase tracking-wide text-muted">{sub}</p>
      <div className="flex w-full items-stretch justify-center gap-6">
        <div className="relative h-72 w-16 rounded-full bg-surface-2" aria-hidden>
          <div className="absolute left-1/2 h-14 w-14 -translate-x-1/2 rounded-full bg-accent" style={{ top: `calc(${pos} * (100% - 3.5rem))`, transition: 'top 100ms linear' }} />
        </div>
        <div className="flex flex-col justify-center gap-2">
          <span className="flex items-center gap-2 font-display text-4xl font-bold text-accent">
            <Icon name={down ? 'down' : 'up'} size={36} /> {down ? cue[0] : cue[1]}
          </span>
          <span className="tabular font-display text-7xl font-bold leading-none">{secs}</span>
          <span className="tabular text-xl font-semibold">
            Rep {Math.min(rep + 1, reps)} <span className="text-muted">of {reps}</span>
          </span>
        </div>
      </div>
    </div>
  );
}
