import { useEffect, useRef, useState } from 'react';
import { useApp } from '../../ui/app-context';
import { Seg, Sheet } from '../../ui/controls';
import { Icon } from '../../ui/Icon';
import { useDayEdit } from '../../ui/useEdit';
import { beep, haptic, keepAwake, unlockAudio } from '../../ui/feedback';
import { SetWave, Vinyl, fmtS } from '../../ui/Player';
import { ROUTINE } from '../../domain/content';
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
  const [reps, setReps] = useState(0);
  const [now, setNow] = useState(Date.now());
  const fired = useRef('');
  const timed = stage === 'cw' || stage === 'ccw';
  useEffect(() => keepAwake(), []);
  useEffect(() => {
    if (!timed || pausedAt !== null) return;
    const id = window.setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [timed, pausedAt]);
  const elapsed = ((pausedAt ?? now) - startAt) / 1000;
  const total = ROUTINE.circlesS;

  const begin = (s: Stage) => {
    setStage(s);
    setStartAt(Date.now());
    setNow(Date.now());
    setPausedAt(null);
    fired.current = '';
  };
  // Switch direction, then move to the curls, when each minute is up
  useEffect(() => {
    if (!timed || pausedAt !== null || elapsed < total || fired.current === stage) return;
    fired.current = stage;
    beep(settings.sound, stage === 'cw' ? 660 : 880, 250);
    haptic(settings.haptics, [60, 60, 60]);
    begin(stage === 'cw' ? 'ccw' : 'curls');
  });

  const finish = (n: number | null) => {
    void edit(date, (x) => void (x.routine = { ...x.routine, [when]: true }), `${when === 'am' ? 'Morning' : 'Bedtime'} routine done${n !== null ? ` (${n} curls)` : ''}`);
    onClose();
  };

  const done = !!days[date]?.routine?.[when];
  const label = stage === 'cw' ? 'Circles one way' : stage === 'ccw' ? 'Other way' : stage === 'curls' ? 'Light hammer curls' : 'Ready';

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
            <p className="hint">{ROUTINE.note}</p>
            {done && <p className="font-semibold text-accent">Already done today. You can do it again.</p>}
          </div>
        )}

        {stage === 'curls' ? (
          <button
            type="button"
            aria-label={`Count a curl, ${reps} so far`}
            onClick={() => {
              haptic(settings.haptics);
              if ((reps + 1) % 10 === 0) beep(settings.sound, 520, 60, 0.08);
              setReps(Math.min(ROUTINE.curlReps, reps + 1));
            }}
            className="w-full max-w-[19rem] select-none"
          >
            <Vinyl frac={reps / ROUTINE.curlReps} big={String(reps)} label="Tap per curl" sub={`of ${ROUTINE.curlReps}, very light`} spinning={false} />
          </button>
        ) : (
          <div className="w-full max-w-[19rem]" role="timer" aria-label={stage === 'intro' ? 'Ready' : `${label}, ${Math.max(0, Math.ceil(total - elapsed))} seconds left`}>
            <Vinyl
              frac={stage === 'intro' ? 0 : elapsed / total}
              big={stage === 'intro' ? '2:00' : String(Math.max(0, Math.ceil(total - elapsed)))}
              label={stage === 'intro' ? 'Wrist circles' : label}
              sub={stage === 'intro' ? 'then 100 light curls' : 'seconds'}
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
              <button type="button" className="orb h-14 w-14" aria-label="Skip to next step" onClick={() => begin(stage === 'cw' ? 'ccw' : 'curls')}>
                <Icon name="skip" size={20} />
              </button>
            </>
          )}
          {stage === 'curls' && (
            <button type="button" className="orb orb-ring h-24 w-24 text-accent" aria-label="Finish routine" onClick={() => finish(reps)}>
              <Icon name="check" size={34} />
            </button>
          )}
        </div>

        {stage === 'curls' && (
          <div className="flex flex-wrap justify-center gap-3">
            <button type="button" className="btn" onClick={() => finish(ROUTINE.curlReps)}>
              I counted all {ROUTINE.curlReps} myself
            </button>
          </div>
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
