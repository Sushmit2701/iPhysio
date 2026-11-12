import { useState } from 'react';
import { useApp } from '../../ui/app-context';
import { Card, Disclosure, Seg, StatusBox, Toggle, type Tone } from '../../ui/controls';
import { Icon } from '../../ui/Icon';
import { go } from '../../ui/route';
import { useDayEdit } from '../../ui/useEdit';
import { addDays, diffDays, longDate, nowHM } from '../../domain/dates';
import { EX, PHASES, RED_FLAGS, effectiveMode, variantFor } from '../../domain/content';
import { adherence, dueChecks, sessionDone, todayAdvice } from '../../domain/logic';
import { patchSettings } from '../../db/repo';
import { TEST_KEYS, type DayData, type ExKey } from '../../domain/types';
import { CheckInFlow, NoteField, firstOpenStep, flowSummary, type FlowKind } from './CheckIn';
import { ExerciseHowTo } from './ExerciseHowTo';
import { haptic } from '../../ui/feedback';
import { ELBOW_LOADS, GYM_TYPES } from '../../domain/types';

const TONE: Record<string, Tone> = { 'step-back': 'hi', hold: 'mid', progress: 'ok', log: 'none' };

export function Today({ date: dateArg }: { date?: string }) {
  const app = useApp();
  const { days, settings, prio, ranked, today, prtee, assess } = app;
  const date = dateArg && dateArg <= today ? dateArg : today;
  const isToday = date === today;
  const day: DayData = days[date] ?? {};
  const [flow, setFlow] = useState<{ kind: FlowKind; at: number } | null>(null);
  const edit = useDayEdit();
  const advice = todayAdvice(days, prio, date, settings.phase);
  const adviceTone = advice.action === 'hold' && advice.title.startsWith('Within') ? 'ok' : TONE[advice.action];
  const due = dueChecks(prtee, assess, today);
  const hm = nowHM();
  const banner =
    isToday && settings.remindOn
      ? hm >= settings.t1 && !sessionDone(day, prio)
        ? 'Rehab not done yet today. It takes 15 to 25 minutes.'
        : hm >= settings.t2 && day.painPM == null
          ? 'Log your evening check-in before bed.'
          : null
      : null;
  const others = TEST_KEYS.filter((k) => !prio.includes(k) && (k !== 'nerve' || ranked.some((x) => x.k === 'nerve')));
  const adh = adherence(day, prio);
  const phase = PHASES[settings.phase];
  const mode = effectiveMode(settings.phase, settings.mode);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <button type="button" className="btn h-12 w-12 p-0" aria-label="Previous day" onClick={() => go('today', addDays(date, -1))}>
          <Icon name="left" />
        </button>
        <div className="grow text-center">
          <div className="font-display text-lg font-bold">{isToday ? 'Today' : longDate(date)}</div>
          <div className="text-sm text-muted">{isToday ? longDate(date) : `${diffDays(date, today)} days ago`}</div>
        </div>
        <button type="button" className="btn h-12 w-12 p-0" aria-label="Next day" disabled={isToday} onClick={() => go('today', addDays(date, 1))}>
          <Icon name="right" />
        </button>
      </div>
      {!isToday && (
        <button type="button" className="btn self-center" onClick={() => go('today')}>
          Back to today
        </button>
      )}

      {banner && <StatusBox tone="info" icon="bell" title={banner} />}

      <StatusBox tone={adviceTone} icon={advice.action === 'step-back' ? 'alert' : 'info'} title={advice.title}>
        <p>{advice.body}</p>
        {advice.suggestPhase && advice.suggestPhase !== settings.phase && (
          <button type="button" className="btn mt-2" onClick={() => go('plan')}>
            {advice.action === 'progress' ? `Review moving to ${PHASES[advice.suggestPhase].name}` : `Consider ${PHASES[advice.suggestPhase].name} phase`}
          </button>
        )}
      </StatusBox>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {(['morning', 'evening'] as const).map((k) => {
          const s = flowSummary(k, day);
          const complete = s.done >= s.total;
          return (
            <button
              key={k}
              type="button"
              onClick={() => setFlow({ kind: k, at: complete ? 0 : firstOpenStep(k, day) })}
              className="card flex w-full min-w-0 items-center gap-4 text-left"
              aria-label={`${k === 'morning' ? 'Morning' : 'Evening'} check-in, ${s.done} of ${s.total} answered`}
            >
              <span className="grid h-12 w-12 flex-none place-items-center rounded-full" style={{ background: complete ? 'var(--accent)' : 'var(--accent-soft)', color: complete ? 'var(--accent-ink)' : 'var(--accent)' }}>
                <Icon name={complete ? 'check' : k === 'morning' ? 'sun' : 'moon'} />
              </span>
              <span className="flex min-w-0 grow flex-col">
                <span className="font-display text-lg font-bold">{k === 'morning' ? 'Morning check-in' : 'Evening check-in'}</span>
                <span className="truncate text-sm text-muted">{s.text || (k === 'morning' ? 'Pain on waking, feel, sleep' : 'Rehab, worst and evening pain, tasks, gym')}</span>
              </span>
              <span className="tabular text-sm font-semibold text-muted">
                {s.done}/{s.total}
              </span>
            </button>
          );
        })}
      </div>

      <Card
        title="Rehab"
        action={<span className="text-sm text-muted">{adh === null ? '' : `${adh}% of priority done`}</span>}
      >
        <p className="hint">
          <b className="text-ink">{phase.name}.</b> {phase.freq}. {variantFor(settings.phase, mode).dose}. Effort about 7/10, never past 3/10 pain.
        </p>
        {settings.phase === 'reduce' && (
          <Seg
            label="Reduce phase style"
            options={[
              { v: 'iso', label: 'Isometric holds' },
              { v: 'pump', label: 'Light pump work' },
            ]}
            value={mode}
            onChange={(v) => void patchSettings({ mode: v })}
          />
        )}
        <button type="button" className="btn btn-primary min-h-14 text-lg" onClick={() => go('session', date)}>
          <Icon name="play" /> {sessionDone(day, prio) ? 'Do another session' : 'Start guided session'}
        </button>
        <ul className="flex flex-col">
          {prio.map((k, i) => (
            <ExRow key={k} k={k} rank={i + 1} day={day} date={date} edit={edit} />
          ))}
        </ul>
        {others.length > 0 && (
          <Disclosure summary={`Other exercises (${others.length})`}>
            <ul className="flex flex-col">
              {others.map((k) => (
                <ExRow key={k} k={k} rank={0} day={day} date={date} edit={edit} />
              ))}
            </ul>
          </Disclosure>
        )}
      </Card>

      <Card title="Gym">
        <Toggle on={!!day.gym} onChange={(v) => void edit(date, (x) => void (x.gym = v), v ? 'Marked as a training day' : 'Marked as a rest day')}>
          Trained {isToday ? 'today' : 'this day'}
        </Toggle>
        {day.gym && (
          <>
            <div className="label">Session type</div>
            <Seg label="Session type" options={GYM_TYPES} value={day.gymType} onChange={(v) => void edit(date, (x) => void (x.gymType = v))} />
            <div className="label">Elbow load</div>
            <Seg label="Elbow load" options={ELBOW_LOADS} value={day.gymElbow} onChange={(v) => void edit(date, (x) => void (x.gymElbow = v))} />
          </>
        )}
      </Card>

      {(due.prteeDue || due.screenDue) && (
        <StatusBox tone="info" icon="file" title={due.prteeDue ? 'Weekly PRTEE is due' : 'Movement screen is due'}>
          <p>{due.prteeDue ? 'Fifteen quick questions, about two minutes. It tracks function as well as pain.' : 'Re-test every 2 weeks so your priorities stay current.'}</p>
          <button type="button" className="btn mt-2" onClick={() => go('tests', due.prteeDue ? 'prtee' : 'screen')}>
            Open {due.prteeDue ? 'PRTEE' : 'movement screen'}
          </button>
        </StatusBox>
      )}

      <Card title="Notes">
        <NoteField key={date} label="Notes for this day" value={day.note ?? ''} onSave={(v) => void edit(date, (x) => void (x.note = v), 'Note saved')} />
      </Card>

      <p className="px-1 text-sm text-muted">{RED_FLAGS}</p>

      {flow && <CheckInFlow kind={flow.kind} date={date} startAt={flow.at} onClose={() => setFlow(null)} />}
    </div>
  );
}

function ExRow({ k, rank, day, date, edit }: { k: ExKey; rank: number; day: DayData; date: string; edit: ReturnType<typeof useDayEdit> }) {
  const { settings } = useApp();
  const [open, setOpen] = useState(false);
  const e = EX[k];
  const done = !!day.done?.[k];
  const sets = day.sets?.[k] ?? [];
  const mode = effectiveMode(settings.phase, settings.mode);
  return (
    <li className="border-t border-line py-2 first:border-t-0">
      <div className="flex items-center gap-3">
        <button
          type="button"
          role="checkbox"
          aria-checked={done}
          aria-label={`Done: ${e.name}`}
          data-ex={k}
          onClick={() => {
            haptic(settings.haptics);
            void edit(date, (x) => void (x.done = { ...x.done, [k]: !done }), `${e.name}: ${done ? 'not done' : 'done'}`);
          }}
          className="grid h-12 w-12 flex-none place-items-center rounded-xl border-2"
          style={{ borderColor: done ? 'var(--accent)' : 'var(--muted)', background: done ? 'var(--accent)' : 'var(--surface)', color: 'var(--accent-ink)' }}
        >
          {done && <Icon name="check" size={26} />}
        </button>
        <div className="min-w-0 grow">
          <div className="font-semibold leading-snug">{e.name}</div>
          <div className="text-sm text-muted">
            {rank ? <span className="font-semibold text-accent">Priority {rank} · </span> : null}
            {e.target}
            {sets.length > 0 && ` · ${sets.length} set${sets.length > 1 ? 's' : ''}`}
            {day.load?.[k] && ` · ${day.load[k]}`}
          </div>
        </div>
        <button type="button" aria-expanded={open} aria-label={`How to: ${e.name}`} onClick={() => setOpen(!open)} className="btn btn-ghost min-h-12 flex-none px-2">
          How
          <span className={`transition-transform ${open ? 'rotate-90' : ''}`}>
            <Icon name="right" size={18} />
          </span>
        </button>
      </div>
      {open && (
        <div className="anim-in mt-2 flex flex-col gap-3">
          <ExerciseHowTo k={k} mode={mode} />
          <label className="flex flex-col gap-1">
            <span className="label">Load used</span>
            <input
              className="field-input"
              defaultValue={day.load?.[k] ?? ''}
              placeholder="e.g. 2 kg, or green band"
              onBlur={(ev) => {
                const v = ev.target.value.trim();
                if (v !== (day.load?.[k] ?? '')) void edit(date, (x) => void (x.load = { ...x.load, [k]: v }), 'Load saved');
              }}
            />
          </label>
        </div>
      )}
    </li>
  );
}
