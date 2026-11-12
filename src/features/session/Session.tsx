import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../../ui/app-context';
import { Disclosure, PainScale, Seg, Sheet, StatusBox } from '../../ui/controls';
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

export function Session({ date, startEx }: { date: string; startEx?: string }) {
  const { prio, settings, days, dayList } = useApp();
  const edit = useDayEdit();
  // Start at a chosen exercise; a non-priority exercise gets a session of its own
  const queue: ExKey[] = startEx && !prio.includes(startEx as ExKey) && startEx in EX ? [startEx as ExKey] : prio;
  const [exIdx, setExIdx] = useState(() => Math.max(0, queue.indexOf(startEx as ExKey)));
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

  const jump = (i: number) => {
    if (i < 0 || i >= queue.length) return;
    setExIdx(i);
    setSetNo(0);
    setReps(0);
    setPausedAt(null);
    setStage('intro');
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

  const title = stage === 'pain' || stage === 'finish' ? 'Session complete' : `Exercise ${exIdx + 1} of ${queue.length}`;
  const playing = (stage === 'ready' || stage === 'work' || stage === 'rest') && pausedAt === null;
  const inSet = stage === 'ready' || stage === 'work' || stage === 'rest';
  const total = stage === 'ready' ? READY_S : stage === 'rest' ? restS : target?.kind === 'hold' ? holdS : target?.kind === 'tempo' ? target.reps * 2 * HALF_S : 0;
  const mainAction = () => {
    if (!target) return;
    unlockAudio();
    if (stage === 'intro') return target.kind === 'reps' ? begin('work') : begin('ready');
    if (stage === 'work' && target.kind === 'reps') return endSet({ reps });
    return pausedAt ? resume() : pause();
  };
  const mainLabel =
    stage === 'intro' ? `Start set ${setNo + 1}` : stage === 'work' && target?.kind === 'reps' ? `Set done (${reps} reps)` : pausedAt ? 'Resume' : 'Pause';
  const mainIcon = stage === 'intro' || pausedAt ? 'play' : stage === 'work' && target?.kind === 'reps' ? 'check' : 'pause';

  const showPlayer = k && target && stage !== 'pain' && stage !== 'finish';

  return (
    <Sheet title={title} onClose={() => go('today', date)}>
      {showPlayer && (
        <div className="anim-in flex flex-col items-center gap-5">
          <div className="text-center">
            <h3 className="text-2xl">{EX[k].name}</h3>
            <p className="hint mt-1">
              {EX[k].target} ·{' '}
              {target.kind === 'hold'
                ? `${target.sets} holds of ${holdS} s`
                : target.kind === 'tempo'
                  ? `${target.sets} × ${target.reps}, 3 s down, 3 s up`
                  : `${target.sets} × about ${target.reps} reps`}
            </p>
          </div>

          {stage === 'work' && target.kind === 'reps' ? (
            <button
              type="button"
              aria-label={`Count a rep, ${reps} so far`}
              onClick={() => {
                haptic(settings.haptics);
                beep(settings.sound, 520, 50, 0.08);
                setReps(reps + 1);
              }}
              className="w-full max-w-[19rem] select-none"
            >
              <Vinyl frac={Math.min(1, reps / target.reps)} big={String(reps)} label="Tap per rep" sub={`target ${target.reps}`} spinning={false} />
            </button>
          ) : stage === 'work' && target.kind === 'tempo' ? (
            <Tempo elapsed={elapsed} reps={target.reps} cue={EX[k].cue} sub="" />
          ) : (
            <div className="w-full max-w-[19rem]" role="timer" aria-label={stage === 'intro' ? 'Ready' : `${stage === 'rest' ? 'Rest' : stage === 'ready' ? 'Get into position' : 'Hold'}, ${Math.max(0, Math.ceil(total - elapsed))} seconds left`}>
              <Vinyl
                frac={stage === 'intro' ? 0 : elapsed / total}
                big={stage === 'intro' ? `${setNo}/${target.sets}` : String(Math.max(stage === 'ready' ? 1 : 0, Math.ceil(total - elapsed)))}
                label={stage === 'intro' ? 'Sets done' : stage === 'rest' ? 'Rest' : stage === 'ready' ? 'Get into position' : 'Hold'}
                sub={stage === 'intro' ? 'Press play' : 'seconds'}
                spinning={playing && stage === 'work'}
              />
            </div>
          )}

          <SetWave frac={inSet && total ? elapsed / total : stage === 'intro' ? 0 : reps / (target.reps || 1)} left={inSet ? fmtS(elapsed) : `Set ${setNo + 1}`} right={inSet ? fmtS(total) : `of ${target.sets}`} />

          <div className="flex w-full items-center justify-center gap-5">
            <button type="button" className="orb h-14 w-14" aria-label="Previous exercise" disabled={exIdx === 0 || inSet} onClick={() => jump(exIdx - 1)}>
              <Icon name="skip" size={20} className="rotate-180" />
            </button>
            <button type="button" className="orb orb-ring h-24 w-24 text-accent" aria-label={mainLabel} onClick={mainAction}>
              <Icon name={mainIcon} size={34} />
            </button>
            <button type="button" className="orb h-14 w-14" aria-label="Next exercise" disabled={inSet} onClick={() => (exIdx < queue.length - 1 ? jump(exIdx + 1) : finishExercise(setNo > 0))}>
              <Icon name="skip" size={20} />
            </button>
          </div>
          <p className="-mt-2 text-sm font-semibold text-muted" aria-hidden>
            {mainLabel}
          </p>

          <div className="flex w-full flex-wrap justify-center gap-3">
            {stage === 'rest' && (
              <button type="button" className="btn" onClick={() => begin('ready')}>
                Skip rest
              </button>
            )}
            {stage === 'work' && target.kind === 'hold' && (
              <button type="button" className="btn" onClick={() => endSet({ holdS: Math.round(elapsed) })}>
                End hold early
              </button>
            )}
            {stage === 'work' && target.kind === 'tempo' && (
              <button type="button" className="btn" onClick={() => endSet({ reps: Math.floor(elapsed / (2 * HALF_S)) })}>
                End set
              </button>
            )}
            {stage === 'work' && target.kind === 'reps' && reps > 0 && (
              <button type="button" className="btn" onClick={() => setReps(reps - 1)}>
                Remove a rep
              </button>
            )}
            {stage === 'intro' && setNo > 0 && (
              <button type="button" className="btn" onClick={() => finishExercise(true)}>
                Finish with {setNo} set{setNo > 1 ? 's' : ''}
              </button>
            )}
            {stage === 'intro' && (
              <button type="button" className="btn" onClick={() => finishExercise(false)}>
                Skip exercise
              </button>
            )}
          </div>

          {stage === 'intro' && (
            <div className="flex w-full flex-col gap-3">
              {target.kind === 'hold' && (
                <div className="flex flex-col gap-2">
                  <div className="label">Hold length</div>
                  <Seg label="Hold length" options={[30, 35, 40, 45].map((x) => ({ v: String(x), label: `${x} s` }))} value={String(holdS)} onChange={(v) => void patchSettings({ holdS: Number(v) })} />
                </div>
              )}
              <label className="flex flex-col gap-1">
                <span className="label">Load</span>
                <input className="field-input" value={load} onChange={(e) => setLoad(e.target.value)} placeholder="e.g. 2 kg, or green band" />
              </label>
              <Disclosure summary="How to do it">
                <ExerciseHowTo k={k} mode={mode} />
              </Disclosure>
            </div>
          )}

          <div className="grad-panel w-full rounded-[26px] p-2">
            <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wider text-white/85">Up next</p>
            <ul>
              {queue.map((q, i) => {
                const cur = i === exIdx;
                const n = day.sets?.[q]?.length ?? 0;
                return (
                  <li key={q} className={`rounded-2xl border-b border-white/15 last:border-b-0 ${cur ? 'bg-white/12' : ''}`}>
                    <button type="button" disabled={inSet} onClick={() => jump(i)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left">
                      <span className="grid h-10 w-10 flex-none place-items-center rounded-full bg-white/90 text-[var(--grad-b)]">
                        <Icon name={day.done?.[q] ? 'check' : cur && playing ? 'pause' : 'play'} size={16} />
                      </span>
                      <span className="min-w-0 grow">
                        <span className="block font-semibold">{EX[q].name}</span>
                        <span className="block text-[0.8rem] text-white/85">{EX[q].target}</span>
                      </span>
                      <span className="tabular text-sm text-white/85">{n ? `${n} set${n > 1 ? 's' : ''}` : ''}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}

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

const fmtS = (sec: number) => {
  const t = Math.max(0, Math.floor(sec));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};

/** The hold timer drawn as a record: soft halo lines, grooved disc, gradient progress arc, glowing label. */
function Vinyl({ frac, big, label, sub, spinning }: { frac: number; big: string; label: string; sub: string; spinning: boolean }) {
  const f = Math.min(1, Math.max(0, frac));
  const R = 128;
  const C = 2 * Math.PI * R;
  return (
    <svg viewBox="0 0 300 300" className="block w-full" aria-hidden>
      <defs>
        <linearGradient id="vy-disc" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--surface)" />
          <stop offset="0.55" stopColor="color-mix(in srgb, var(--grad-a) 35%, var(--surface))" />
          <stop offset="1" stopColor="color-mix(in srgb, #4d7bd8 45%, var(--bg))" />
        </linearGradient>
        <linearGradient id="vy-arc" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#5aa7ff" />
          <stop offset="0.5" stopColor="var(--grad-a)" />
          <stop offset="1" stopColor="#e070d0" />
        </linearGradient>
        <radialGradient id="vy-label" cx="0.5" cy="0.45" r="0.6">
          <stop offset="0" stopColor="#4a2f9a" />
          <stop offset="0.6" stopColor="#2a1f66" />
          <stop offset="1" stopColor="#141a40" />
        </radialGradient>
        <filter id="vy-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>
      <g className={spinning ? 'vy-spin' : ''} style={{ transformOrigin: '150px 150px' }} opacity="0.75">
        {[0, 35, 70, 115].map((a, i) => (
          <ellipse key={a} cx="150" cy="150" rx={140 - i * 2} ry={128 + i * 3} fill="none" stroke="var(--hi)" strokeWidth="1.2" transform={`rotate(${a} 150 150)`} />
        ))}
        <ellipse cx="150" cy="150" rx="142" ry="124" fill="none" stroke="var(--grad-a)" strokeOpacity="0.25" strokeWidth="1" transform="rotate(150 150 150)" />
      </g>
      <circle cx="150" cy="150" r="118" fill="url(#vy-disc)" style={{ filter: 'drop-shadow(6px 8px 10px var(--lo))' }} />
      {[108, 100, 92, 84, 76].map((r) => (
        <circle key={r} cx="150" cy="150" r={r} fill="none" stroke="var(--hi)" strokeOpacity="0.5" strokeWidth="0.8" />
      ))}
      <circle cx="150" cy="150" r={R} fill="none" stroke="var(--line)" strokeWidth="4" />
      <circle cx="150" cy="150" r={R} fill="none" stroke="url(#vy-arc)" strokeWidth="5" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - f)} transform="rotate(-90 150 150)" style={{ transition: 'stroke-dashoffset 100ms linear' }} />
      <circle cx="150" cy="150" r="68" fill="url(#vy-label)" />
      <circle cx="150" cy="150" r="52" fill="none" stroke="#ff7ad9" strokeWidth="3" filter="url(#vy-glow)" opacity="0.9" />
      <circle cx="150" cy="150" r="52" fill="none" stroke="#ffc2f0" strokeWidth="1" opacity="0.8" />
      <text x="150" y="128" textAnchor="middle" fontSize="12" fontWeight="600" fill="#e6dcff">
        {label}
      </text>
      <text x="150" y="166" textAnchor="middle" fontSize={big.length > 3 ? 34 : 44} fontWeight="700" fill="#fff" style={{ fontFamily: 'var(--font-display)', fontVariantNumeric: 'tabular-nums' }}>
        {big}
      </text>
      <text x="150" y="184" textAnchor="middle" fontSize="11" fill="#d9cffa">
        {sub}
      </text>
    </svg>
  );
}

/** Waveform-style progress through the current set, as in a track scrubber. */
function SetWave({ frac, left, right }: { frac: number; left: string; right: string }) {
  const N = 44;
  const f = Math.min(1, Math.max(0, frac));
  return (
    <div className="flex w-full items-center gap-3" aria-hidden>
      <span className="tabular w-12 text-right text-xs text-muted">{left}</span>
      <div className="flex h-9 grow items-center gap-[3px]">
        {Array.from({ length: N }, (_, i) => {
          const h = 0.25 + 0.75 * Math.abs(Math.sin(i * 1.7) * Math.cos(i * 0.45));
          const on = i / N < f;
          return <span key={i} className="flex-1 rounded-full" style={{ height: `${h * 100}%`, background: on ? 'linear-gradient(var(--grad-a), #e070d0)' : 'var(--line)' }} />;
        })}
      </div>
      <span className="tabular w-12 text-xs text-muted">{right}</span>
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
