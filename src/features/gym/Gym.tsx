import { useState } from 'react';
import { useApp } from '../../ui/app-context';
import { Card, Disclosure, Seg, StatusBox, Tile } from '../../ui/controls';
import { Icon } from '../../ui/Icon';
import { go } from '../../ui/route';
import { useDayEdit } from '../../ui/useEdit';
import { painColor } from '../../ui/pain';
import { haptic } from '../../ui/feedback';
import { addDays, longDate, mondayStart, parseD, weekdayDate } from '../../domain/dates';
import { GYM_LETTER, TNAME } from '../../domain/content';
import { dayPeak, gymImpact, gymVerdict } from '../../domain/logic';
import { trainAroundSplit } from '../../domain/split';
import { ELBOW_LOADS, GYM_TYPES } from '../../domain/types';

export default function Gym() {
  const { days, today, prio, dark, settings } = useApp();
  const edit = useDayEdit();
  const [weeksBack, setWeeksBack] = useState(0);
  const [sel, setSel] = useState<string | null>(null);
  const start = mondayStart(today, 4 + weeksBack * 5);
  const cells = Array.from({ length: 35 }, (_, i) => addDays(start, i));
  const im = gymImpact(days, today);
  const verdict = gymVerdict(im);
  const f = (v: number | null) => (v === null ? '–' : v.toFixed(1));
  const count = (n: number) => Array.from({ length: n }, (_, i) => days[addDays(today, -i)]).filter((x) => x?.gym).length;
  const selDay = sel ? (days[sel] ?? {}) : null;
  const split = trainAroundSplit(prio);
  const recent = Object.keys(days)
    .filter((k) => days[k]?.gym)
    .sort()
    .reverse()
    .slice(0, 6);

  return (
    <div className="flex flex-col gap-4">
      <Card
        title="Training days"
        action={
          <div className="flex gap-1">
            <button type="button" className="btn h-12 w-12 p-0" aria-label="Earlier weeks" onClick={() => setWeeksBack(weeksBack + 1)}>
              <Icon name="left" />
            </button>
            <button type="button" className="btn h-12 w-12 p-0" aria-label="Later weeks" disabled={weeksBack === 0} onClick={() => setWeeksBack(weeksBack - 1)}>
              <Icon name="right" />
            </button>
          </div>
        }
      >
        <p className="hint">Tap a day to tick it as a training day. The bar under each day is that day’s peak pain.</p>
        <div className="grid grid-cols-7 gap-1" role="grid" aria-label="Training calendar">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
            <div key={d} className="pb-1 text-center text-xs font-semibold text-muted">
              {d}
            </div>
          ))}
          {cells.map((d) => {
            const day = days[d];
            const pk = dayPeak(day);
            const fut = d > today;
            const on = !!day?.gym;
            return (
              <button
                key={d}
                type="button"
                data-date={d}
                disabled={fut}
                aria-pressed={on}
                aria-label={`${longDate(d)}${on ? `, trained${day?.gymType ? ' ' + day.gymType : ''}` : ''}${pk !== null ? `, peak pain ${pk}` : ''}`}
                onClick={() => {
                  haptic(settings.haptics);
                  void edit(d, (x) => void (x.gym = !on), `${weekdayDate(d)}: ${on ? 'rest day' : 'training day'}`);
                  setSel(on ? null : d);
                }}
                className={`relative flex min-h-14 flex-col items-center justify-center rounded-xl border pb-2 pt-1 font-semibold tabular ${
                  on ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-surface'
                } ${d === today ? 'ring-2 ring-ink ring-offset-1 ring-offset-surface' : ''} ${fut ? 'opacity-35' : ''} ${sel === d ? 'outline outline-2 outline-offset-2 outline-accent' : ''}`}
              >
                {parseD(d).getDate()}
                <small className="h-3 text-[0.68rem] leading-3">{on && day?.gymType ? GYM_LETTER[day.gymType] : ''}</small>
                {pk !== null && <span className="absolute inset-x-1.5 bottom-1 h-1 rounded" style={{ background: painColor(pk, dark) }} />}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted">L legs · Ps push · Pl pull · U upper · F full body · O other</p>
        {sel && selDay?.gym && (
          <div className="anim-in flex flex-col gap-3 rounded-2xl bg-surface-2 p-4">
            <div className="flex items-center justify-between">
              <b>{weekdayDate(sel)}</b>
              <button type="button" className="btn btn-ghost min-h-10 px-2" onClick={() => setSel(null)}>
                Done
              </button>
            </div>
            <Seg label="Session type" options={GYM_TYPES} value={selDay.gymType} onChange={(v) => void edit(sel, (x) => void (x.gymType = v))} />
            <div className="label">Elbow load</div>
            <Seg label="Elbow load" options={ELBOW_LOADS} value={selDay.gymElbow} onChange={(v) => void edit(sel, (x) => void (x.gymElbow = v))} />
          </div>
        )}
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Tile n={count(7)} label="Training days, last 7" />
        <Tile n={count(28)} label="Training days, last 28" />
      </div>

      <Card title="Impact on the elbow">
        <p className="hint">Tendon pain often arrives a day or two late, so this compares the next morning and the following 48 hours after training days and after rest days.</p>
        <div className="overflow-x-auto">
          <table className="tabular w-full text-[0.95rem]">
            <thead>
              <tr className="text-left text-sm text-muted">
                <th className="py-1.5 pr-2 font-semibold" />
                <th className="py-1.5 pr-2 font-semibold">After training</th>
                <th className="py-1.5 font-semibold">After rest</th>
              </tr>
            </thead>
            <tbody>
              {(
                [
                  ['Days compared', String(im.nT), String(im.nR)],
                  ['Next-morning pain', f(im.tAM), f(im.rAM)],
                  ['Peak pain, next 48 h', f(im.tP), f(im.rP)],
                  ['Peak pain on the day', f(im.tOwn), f(im.rOwn)],
                ] as const
              ).map(([l, a, b]) => (
                <tr key={l} className="border-t border-line">
                  <td className="py-2 pr-2">{l}</td>
                  <td className="py-2 pr-2 font-semibold">{a}</td>
                  <td className="py-2 font-semibold">{b}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <StatusBox tone={verdict.level} title={verdict.title}>
          {verdict.body}
        </StatusBox>
        {Object.keys(im.byElb).length > 0 && (
          <>
            <h3 className="text-lg">By elbow load</h3>
            <table className="tabular w-full text-[0.95rem]">
              <thead>
                <tr className="text-left text-sm text-muted">
                  <th className="py-1.5 font-semibold">Elbow load</th>
                  <th className="py-1.5 font-semibold">Sessions</th>
                  <th className="py-1.5 font-semibold">Next morning</th>
                  <th className="py-1.5 font-semibold">48 h peak</th>
                </tr>
              </thead>
              <tbody>
                {ELBOW_LOADS.filter((e) => im.byElb[e]).map((e) => (
                  <tr key={e} className="border-t border-line">
                    <td className="py-2">{e}</td>
                    <td className="py-2">{im.byElb[e]!.n}</td>
                    <td className="py-2 font-semibold">{f(im.byElb[e]!.am)}</td>
                    <td className="py-2 font-semibold">{f(im.byElb[e]!.p48)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
        <p className="text-sm text-muted">This shows association, not proof. Sleep, work and rehab load all move pain too.</p>
      </Card>

      <Card title="Train around it">
        <p className="hint">
          A simple week that keeps you training while sparing your priority tests ({prio.map((k) => TNAME[k]).join(', ') || 'none yet'}). Build back in this order: session length, then how often, then intensity. Keep sessions under an hour and avoid elbow-heavy days back to back.
        </p>
        <ul className="flex flex-col gap-2">
          {split.avoid.map((a) => (
            <li key={a.k} className="rounded-xl bg-surface-2 p-3 text-[0.95rem]">
              <b>{TNAME[a.k]}:</b> avoid {a.avoid.charAt(0).toLowerCase() + a.avoid.slice(1)}. <span className="text-muted">Instead: {a.swap}.</span>
            </li>
          ))}
        </ul>
        <Disclosure summary="Suggested week">
          <ul className="flex flex-col">
            {split.week.map((d) => (
              <li key={d.day} className="flex gap-3 border-t border-line py-2 first:border-t-0">
                <b className="w-10 flex-none">{d.day}</b>
                <span>
                  <b>{d.focus}.</b> <span className="text-muted">{d.detail}</span>
                </span>
              </li>
            ))}
          </ul>
        </Disclosure>
      </Card>

      {recent.length > 0 && (
        <Card title="Recent sessions">
          <ul className="flex flex-col">
            {recent.map((k) => (
              <li key={k} className="flex items-center gap-3 border-t border-line py-2 first:border-t-0">
                <div className="grow">
                  <b>{longDate(k)}</b>
                  <div className="text-sm text-muted">
                    {days[k]?.gymType ?? 'Type not set'} · elbow load {days[k]?.gymElbow?.toLowerCase() ?? 'not set'}
                  </div>
                </div>
                <button type="button" className="btn min-h-12" onClick={() => go('today', k)}>
                  Edit
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
