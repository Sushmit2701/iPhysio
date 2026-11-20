import { useEffect, useRef, useState } from 'react';
import { useApp } from '../../ui/app-context';
import { Seg, Sheet } from '../../ui/controls';
import { Icon } from '../../ui/Icon';
import { useDayEdit } from '../../ui/useEdit';
import { beep, haptic, keepAwake, unlockAudio } from '../../ui/feedback';
import { SetWave, Vinyl, fmtS } from '../../ui/Player';
import { PACE_OPTIONS, ROUTINE } from '../../domain/content';
import { patchSettings } from '../../db/repo';
import { weekdayDate } from '../../domain/dates';

export type RoutineWhen = 'am' | 'pm';
type Stage = 'intro' | 'cw' | 'ccw' | 'curls';

/** Bedtime and morning blood-flow routine: wrist circles both ways, then very light hammer curls. */
export function RoutineFlow({ date, when: initial, onClose }: { date: string; when: RoutineWhen; onClose: () => void }) {
  const { settings, days } = useApp();
  const edit = useDayEdit();
  const [when, setWhen] = useState<RoutineWhen>(initial);
  const [stage, setStage] = useState<Stage>('intro');
  const [startAt, setStartAt] = useState(0);
  const [pausedAt, setPausedAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const fired = useRef('');
  const timed = stage === 'cw' || stage === 'ccw' || stage === 'curls';
  const pace = settings.repPaceS;
  useEffect(() => keepAwake(), []);
  useEffect(() => {
    if (!timed || pausedAt !== null) return;
    const id = window.setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [timed, pausedAt]);
  const elapsed = ((pausedAt ?? now) - startAt) / 1000;
  const total = stage === 'curls' ? ROUTINE.curlReps * pace : ROUTINE.circlesS;
  const repNow = Math.min(ROUTINE.curlReps, Math.floor(elapsed / pace) + 1);
  const repsDone = Math.min(ROUTINE.curlReps, Math.floor(elapsed / pace));

  const begin = (s: Stage) => {
    setStage(s);
    setStartAt(Date.now());
    setNow(Date.now());
    setPausedAt(null);
    fired.current = '';
  };
  // Switch direction, then curls, then finish; a soft tick per curl so you can follow the pace
  useEffect(() => {
    if (!timed || pausedAt !== null) return;
    if (elapsed >= total) {
      if (fired.current === stage) return;
      fired.current = stage;
      beep(settings.sound, stage === 'curls' ? 880 : stage === 'cw' ? 660 : 880, 250);
      haptic(settings.haptics, [60, 60, 60]);
      if (stage === 'curls') finish(ROUTINE.curlReps);
      else begin(stage === 'cw' ? 'ccw' : 'curls');
      return;
    }
    if (stage === 'curls' && repsDone > 0 && fired.current !== `c${repsDone}`) {
      fired.current = `c${repsDone}`;
      if (repsDone % 10 === 0) beep(settings.sound, 760, 90, 0.12);
      else beep(settings.sound, 520, 40, 0.05);
    }
  });

  const finish = (n: number | null) => {
    void edit(date, (x) => void (x.routine = { ...x.routine, [when]: true }), `${when === 'am' ? 'Morning' : 'Bedtime'} routine done${n !== null ? ` (${n} curls)` : ''}`);
    onClose();
  };

  const done = !!days[date]?.routine?.[when];
  const label = stage === 'cw' ? 'Circles one way' : stage === 'ccw' ? 'Other way' : 'Ready';

  return (
    <Sheet title={`${when === 'am' ? 'Morning' : 'Bedtime'} routine · ${weekdayDate(date)}`} onClose={onClose}>
      <div className="anim-in flex flex-col items-center gap-5">
        {stage === 'intro' && (
          <div className="flex w-full flex-col gap-3">
            <Seg
              label="Which routine"
              options={[
                { v: 'am', label: 'Morning' },
                { v: 'pm', label: 'Bedtime' },
              ]}
              value={when}
              onChange={setWhen}
            />
            <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-[0.95rem]">
              {ROUTINE.steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
            <div className="label">
              Curl pace <span className="font-normal text-muted">· {ROUTINE.curlReps} curls take {fmtS(ROUTINE.curlReps * pace)}</span>
            </div>
            <Seg label="Curl pace" options={PACE_OPTIONS.map((x) => ({ v: String(x), label: `${x} s` }))} value={String(pace)} onChange={(v) => void patchSettings({ repPaceS: Number(v) })} />
            <p className="hint">{ROUTINE.note} A soft tick marks each curl, with a stronger one every 10.</p>
            {done && <p className="font-semibold text-accent">Already done today. You can do it again.</p>}
          </div>
        )}

        {stage === 'curls' ? (
          <div className="w-full max-w-[19rem]" role="timer" aria-label={`Curl ${repNow} of ${ROUTINE.curlReps}, ${Math.max(0, Math.ceil(total - elapsed))} seconds left`}>
            <Vinyl frac={elapsed / total} big={fmtS(Math.max(0, total - elapsed + 0.999))} label={`Curl ${repNow} of ${ROUTINE.curlReps}`} sub="very light" spinning={pausedAt === null} />
          </div>
        ) : (
          <div className="w-full max-w-[19rem]" role="timer" aria-label={stage === 'intro' ? 'Ready' : `${label}, ${Math.max(0, Math.ceil(total - elapsed))} seconds left`}>
            <Vinyl
              frac={stage === 'intro' ? 0 : elapsed / total}
              big={stage === 'intro' ? fmtS(2 * ROUTINE.circlesS + ROUTINE.curlReps * pace) : String(Math.max(0, Math.ceil(total - elapsed)))}
              label={stage === 'intro' ? 'Circles and curls' : label}
              sub={stage === 'intro' ? 'minutes in total' : 'seconds'}
              spinning={timed && pausedAt === null}
            />
          </div>
        )}

        {timed && <SetWave frac={elapsed / total} left={fmtS(elapsed)} right={fmtS(total)} />}

        <div className="flex w-full items-center justify-center gap-5">
          {stage === 'intro' && (
            <button type="button" className="orb orb-ring h-24 w-24 text-accent" aria-label="Start routine" onClick={() => (unlockAudio(), begin('cw'))}>
              <Icon name="play" size={34} />
            </button>
          )}
          {timed && (
            <>
              <button type="button" className="orb orb-ring h-24 w-24 text-accent" aria-label={pausedAt ? 'Resume' : 'Pause'} onClick={() => (pausedAt ? (setStartAt(startAt + (Date.now() - pausedAt)), setPausedAt(null)) : setPausedAt(Date.now()))}>
                <Icon name={pausedAt ? 'play' : 'pause'} size={34} />
              </button>
              <button type="button" className="orb h-14 w-14" aria-label={stage === 'curls' ? 'Finish now' : 'Skip to next step'} onClick={() => (stage === 'curls' ? finish(repsDone) : begin(stage === 'cw' ? 'ccw' : 'curls'))}>
                <Icon name="skip" size={20} />
              </button>
            </>
          )}
        </div>

        {stage === 'curls' && (
          <button type="button" className="btn" onClick={() => finish(repsDone)}>
            End now ({repsDone} curls)
          </button>
        )}
        {stage === 'intro' && (
          <button type="button" className="btn" onClick={() => finish(null)}>
            Already did it, just mark done
          </button>
        )}
        <p className="text-center text-sm text-muted">{ROUTINE.source}</p>
      </div>
    </Sheet>
  );
}
