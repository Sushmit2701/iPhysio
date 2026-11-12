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
        <button type="button" className="orb h-12 w-12" aria-label="Previous day" onClick={() => go('today', addDays(date, -1))}>
          <Icon name="left" />
        </button>
        <div className="grow text-center">
          <div className="font-display text-lg font-bold">{isToday ? 'Today' : longDate(date)}</div>
          <div className="text-sm text-muted">{isToday ? longDate(date) : `${diffDays(date, today)} days ago`}</div>
        </div>
        <button type="button" className="orb h-12 w-12" aria-label="Next day" disabled={isToday} onClick={() => go('today', addDays(date, 1))}>
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
            >
              <span className={`grid h-12 w-12 flex-none place-items-center rounded-full ${complete ? 'grad-panel' : 'neu-in text-accent'}`}>
                <Icon name={complete ? 'check' : k === 'morning' ? 'sun' : 'moon'} />
              </span>
              <span className="flex min-w-0 grow flex-col">
                <span className="font-display text-lg font-bold">{k === 'morning' ? 'Morning check-in' : 'Evening check-in'}</span>
                <span className="truncate text-sm text-muted">{s.text || (k === 'morning' ? 'Pain on waking, feel, sleep' : 'Rehab, worst and evening pain, tasks, gym')}</span>
              </span>
              <span className="tabular text-sm font-semibold text-muted">
                {s.done}/{s.total}
                <span className="sr-only"> answered</span>
              </span>
            </button>
          );
        })}
      </div>

      <section className="card flex flex-col gap-0 overflow-hidden p-0">
        <div className="flex flex-col gap-3 p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl">Rehab</h2>
            <span className="pill">{phase.name}</span>
          </div>
          <p className="hint">
            {phase.freq}. {variantFor(settings.phase, mode).dose}. Effort about 7/10, never past 3/10 pain.
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
          <div className="flex items-center justify-center gap-6 py-2">
            <ProgressOrb pct={adh ?? 0} onClick={() => go('session', date)} label={sessionDone(day, prio) ? 'Do another session' : 'Start guided session'} />
          </div>
          <p className="text-center text-sm font-semibold text-muted" aria-hidden>
            {sessionDone(day, prio) ? 'All priority exercises done' : `${adh ?? 0}% of priority done · tap to start`}
          </p>
          <span className="sr-only">{adh === null ? '' : `${adh}% of priority done`}</span>
        </div>
        <div className="grad-panel rounded-t-[26px] px-2 pb-3 pt-2">
          <ul className="flex flex-col">
            {prio.map((k, i) => (
              <ExRow key={k} k={k} rank={i + 1} day={day} date={date} edit={edit} current={k === prio.find((p) => !day.done?.[p])} />
            ))}
          </ul>
          {others.length > 0 && (
            <div className="px-3 [&_button]:text-white">
              <Disclosure summary={`Other exercises (${others.length})`}>
                <ul className="flex flex-col">
                  {others.map((k) => (
                    <ExRow key={k} k={k} rank={0} day={day} date={date} edit={edit} current={false} />
                  ))}
                </ul>
              </Disclosure>
            </div>
          )}
        </div>
      </section>

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

/** Big round play button with the day's adherence as a ring around it, like a record player's control. */
function ProgressOrb({ pct, onClick, label }: { pct: number; onClick: () => void; label: string }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative grid h-32 w-32 place-items-center">
      <svg viewBox="0 0 120 120" className="pointer-events-none absolute inset-0 -rotate-90" aria-hidden>
        <defs>
          <linearGradient id="adh" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--grad-a)" />
            <stop offset="1" stopColor="#e070d0" />
          </linearGradient>
        </defs>
        <circle cx="60" cy="60" r={r} fill="none" stroke="var(--line)" strokeWidth="5" />
        <circle cx="60" cy="60" r={r} fill="none" stroke="url(#adh)" strokeWidth="5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} />
      </svg>
      <button type="button" onClick={onClick} aria-label={label} className="orb orb-ring relative h-24 w-24 text-accent">
        <Icon name="play" size={34} />
      </button>
    </div>
  );
}

function ExRow({ k, rank, day, date, edit, current }: { k: ExKey; rank: number; day: DayData; date: string; edit: ReturnType<typeof useDayEdit>; current: boolean }) {
  const { settings } = useApp();
  const [open, setOpen] = useState(false);
  const e = EX[k];
  const done = !!day.done?.[k];
  const sets = day.sets?.[k] ?? [];
  const mode = effectiveMode(settings.phase, settings.mode);
  return (
    <li className={`rounded-2xl border-b border-white/15 last:border-b-0 ${current ? 'bg-white/12' : ''}`}>
      <div className="flex items-center gap-3 px-3 py-2.5">
        <button
          type="button"
          aria-label={`Start session at ${e.name}`}
          onClick={() => go('session', `${date}/${k}`)}
          className="grid h-11 w-11 flex-none place-items-center rounded-full bg-white/90 text-[var(--grad-b)] shadow-[0_4px_10px_rgba(20,10,60,0.25)]"
        >
          <Icon name="play" size={18} />
        </button>
        <button type="button" aria-expanded={open} aria-label={`How to: ${e.name}`} onClick={() => setOpen(!open)} className="min-w-0 grow py-1 text-left">
          <span className="block font-semibold leading-snug">{e.name}</span>
          <span className="block text-[0.8rem] text-white/85">
            {rank ? `Priority ${rank} · ` : ''}
            {e.target}
            {sets.length > 0 && ` · ${sets.length} set${sets.length > 1 ? 's' : ''}`}
            {day.load?.[k] && ` · ${day.load[k]}`}
          </span>
        </button>
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
          className={`grid h-12 w-12 flex-none place-items-center rounded-full border-2 ${done ? 'border-white bg-white text-[var(--grad-b)]' : 'border-white/70 text-white'}`}
        >
          {done && <Icon name="check" size={24} />}
        </button>
      </div>
      {open && (
        <div className="anim-in flex flex-col gap-3 px-2 pb-3 text-ink">
          <ExerciseHowTo k={k} mode={mode} />
          <label className="flex flex-col gap-1 text-white">
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
