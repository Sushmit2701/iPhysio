import { useState } from 'react';
import { useApp } from '../../ui/app-context';
import { Card, Seg, Tile } from '../../ui/controls';
import { Chart, DataTable, Legend, type Series } from '../../ui/Chart';
import { addDays, dateRange, diffDays, shortDate } from '../../domain/dates';
import {
  adherence, bestStreak, changeFromBaseline, dayPeak, firstAssessment, flareRuns, isNum, mean, roll7, screenMax, sessionDone, streak, windowPeaks,
} from '../../domain/logic';
import { SEED_ASSESS } from '../../domain/seed';
import type { DayData } from '../../domain/types';

type Range = '14' | '30' | '90' | 'all';

export default function Trends() {
  const { days, prio, today, prtee, assess } = useApp();
  const [range, setRange] = useState<Range>('30');
  const [show, setShow] = useState({ am: false, rehab: false, worst: false });

  const keys = Object.keys(days).sort();
  let start = range === 'all' ? (keys[0] ?? addDays(today, -13)) : addDays(today, -(Number(range) - 1));
  if (diffDays(start, today) < 13) start = addDays(today, -13);
  // Leading days before the window are still needed so the 7-day average is right at its left edge
  const lead = dateRange(addDays(start, -6), addDays(start, -1));
  const dates = dateRange(start, today);
  const get = (f: (d: DayData) => number | null | undefined) => dates.map((s) => {
    const v = days[s] ? f(days[s]!) : null;
    return isNum(v) ? v : null;
  });
  const peaksAll = [...lead, ...dates].map((s) => dayPeak(days[s]));
  const avg = roll7(peaksAll).slice(lead.length);
  const peaks = peaksAll.slice(lead.length);
  const marks = dates.map((s, i) => (days[s]?.flare ? i : -1)).filter((i) => i >= 0);

  const now7 = mean(windowPeaks(days, today, 7));
  const prev7 = mean(windowPeaks(days, addDays(today, -7), 7));
  const first = firstAssessment(assess, SEED_ASSESS);
  const baseline = screenMax(first);
  const change = changeFromBaseline(now7, baseline);
  const wk = Array.from({ length: 7 }, (_, i) => sessionDone(days[addDays(today, -i)], prio)).filter(Boolean).length;
  const sl7 = mean(Array.from({ length: 7 }, (_, i) => days[addDays(today, -i)]?.sleepH));
  const runs = flareRuns(days);
  const lastFlare = runs.length ? diffDays(addDays(runs.at(-1)!.start, runs.at(-1)!.length - 1), today) : null;

  const painSeries: Series[] = [
    { key: 'peak', label: 'Daily peak', vals: peaks, color: 'var(--muted)', dotsOnly: 'pain' },
    ...(show.am ? [{ key: 'am', label: 'Morning', vals: get((d) => d.painAM), color: 'var(--c1)', width: 1.5 }] : []),
    ...(show.rehab ? [{ key: 'rehab', label: 'During rehab', vals: get((d) => d.painRehab), color: 'var(--c2)', width: 1.5 }] : []),
    ...(show.worst ? [{ key: 'worst', label: 'Worst', vals: get((d) => d.painWorst), color: 'var(--c3)', width: 1.5 }] : []),
    { key: 'avg', label: '7-day average', vals: avg, color: 'var(--c4)', width: 3.5 },
  ];
  const taskSeries: Series[] = [
    { key: 'cap', label: 'Bottle cap', vals: get((d) => d.fn?.cap), color: 'var(--c1)' },
    { key: 'mug', label: 'Mug grip', vals: get((d) => d.fn?.mug), color: 'var(--c2)' },
    { key: 'door', label: 'Door handle', vals: get((d) => d.fn?.door), color: 'var(--c3)' },
  ];
  const sleepSeries: Series[] = [{ key: 'sleep', label: 'Hours slept', vals: get((d) => d.sleepH), color: 'var(--c1)', bar: true, fmt: (v) => `${v} h` }];
  const adhSeries: Series[] = [{ key: 'adh', label: 'Priority done', vals: dates.map((s) => adherence(days[s], prio)), color: 'var(--c2)', bar: true, fmt: (v) => `${v}%` }];
  const hasAny = (s: Series[]) => s.some((x) => x.vals.some(isNum));
  const sq = get((d) => d.sleepQ);
  const woke = dates.filter((s) => days[s]?.wokePain).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Tile
          n={now7 === null ? '–' : now7.toFixed(1)}
          label={<>Avg daily peak, last 7 days{now7 !== null && prev7 !== null && ` (${now7 - prev7 <= 0 ? '' : '+'}${(now7 - prev7).toFixed(1)} vs week before)`}</>}
        />
        <Tile n={change === null ? '–' : `${change}%`} label={`Change from baseline ${baseline}/10 (worst test, first screen). Higher is better`} />
        <Tile n={streak(days, prio, today)} label={`Day streak, all priority exercises (best ${bestStreak(days, prio)})`} />
        <Tile n={`${wk}/7`} label="Full sessions this week" />
        <Tile n={sl7 === null ? '–' : `${sl7.toFixed(1)} h`} label="Avg sleep, last 7 days" />
        <Tile n={lastFlare === null ? '–' : `${lastFlare} d`} label={runs.length ? `Since last flare-up (${runs.length} so far)` : 'No flare-ups logged'} />
      </div>

      <Seg<Range>
        label="Chart range"
        options={[
          { v: '14', label: '14 d' },
          { v: '30', label: '30 d' },
          { v: '90', label: '90 d' },
          { v: 'all', label: 'All' },
        ]}
        value={range}
        onChange={setRange}
      />

      <Card title="Pain">
        <p className="hint">Single days zig-zag. Judge progress by the thick 7-day average. Red bands are flare-up days.</p>
        {hasAny(painSeries) ? (
          <>
            <Chart
              label={`Pain chart, ${dates.length} days. 7-day average now ${now7?.toFixed(1) ?? 'not available'}.`}
              dates={dates}
              series={painSeries}
              ymax={10}
              ticks={[0, 3, 5, 7, 10]}
              marks={marks}
              refs={[{ v: 3, label: 'target 3', color: 'var(--good)' }]}
              readoutExtra={(i) => (days[dates[i]]?.flare ? <span className="font-semibold text-bad">Flare-up</span> : null)}
            />
            <Legend
              items={[
                { label: 'Daily peak', color: 'var(--muted)', kind: 'dot' },
                { label: '7-day average', color: 'var(--c4)' },
                { label: 'Morning', color: 'var(--c1)', on: show.am, onToggle: () => setShow({ ...show, am: !show.am }) },
                { label: 'During rehab', color: 'var(--c2)', on: show.rehab, onToggle: () => setShow({ ...show, rehab: !show.rehab }) },
                { label: 'Worst', color: 'var(--c3)', on: show.worst, onToggle: () => setShow({ ...show, worst: !show.worst }) },
              ]}
            />
            <DataTable dates={dates} series={painSeries} />
          </>
        ) : (
          <Empty>Log pain in the check-ins and the chart appears here.</Empty>
        )}
        {runs.length > 1 && (
          <p className="hint">
            Flare-ups: {runs.map((r) => `${shortDate(r.start)} (${r.length} d)`).join(', ')}. Shorter flares over time are a good sign.
          </p>
        )}
      </Card>

      <Card title="Daily tasks">
        <p className="hint">Pain with the tasks that bother you. Falling scores here matter more than the headline number.</p>
        {hasAny(taskSeries) ? (
          <>
            <Chart label="Pain with daily tasks" dates={dates} series={taskSeries} ymax={10} ticks={[0, 5, 10]} height={170} />
            <Legend items={taskSeries.map((s) => ({ label: s.label, color: s.color }))} />
            <DataTable dates={dates} series={taskSeries} />
          </>
        ) : (
          <Empty>No task scores yet. They are in the evening check-in.</Empty>
        )}
      </Card>

      <Card title="Sleep">
        {hasAny(sleepSeries) ? (
          <>
            <Chart label="Hours slept" dates={dates} series={sleepSeries} ymax={10} ticks={[0, 4, 7, 10]} refs={[{ v: 7, label: '7 h', color: 'var(--muted)' }]} height={160} />
            <p className="hint">
              Woke with elbow pain on {woke} of {dates.length} days shown{sq.some(isNum) ? `. Average quality ${mean(sq)!.toFixed(1)}/5` : ''}.
            </p>
          </>
        ) : (
          <Empty>No sleep logged yet. It is in the morning check-in.</Empty>
        )}
      </Card>

      <Card title="Rehab done">
        <p className="hint">Share of priority exercises ticked each day. Consistency drives recovery more than intensity.</p>
        {hasAny(adhSeries) ? (
          <Chart label="Rehab completion" dates={dates} series={adhSeries} ymax={100} ticks={[0, 50, 100]} height={150} />
        ) : (
          <Empty>Tick exercises or run a guided session.</Empty>
        )}
      </Card>

      <Card title="Weekly PRTEE">
        {prtee.length ? (
          <>
            <Chart
              label="PRTEE total over time"
              dates={prtee.length === 1 ? [addDays(prtee[0].date, -7), prtee[0].date] : prtee.map((p) => p.date)}
              series={[{ key: 'prtee', label: 'PRTEE total', vals: prtee.length === 1 ? [null, prtee[0].total] : prtee.map((p) => p.total), color: 'var(--c3)', width: 2.5 }]}
              ymax={100}
              ticks={[0, 25, 50, 75, 100]}
              height={170}
            />
            <p className="hint">
              Lower is better. A drop of about 11 points is commonly cited as a meaningful change.
              {prtee.length > 1 && ` Change since first: ${(prtee.at(-1)!.total - prtee[0].total).toFixed(1)} points.`}
            </p>
          </>
        ) : (
          <Empty>Do the PRTEE once a week in More, Tests.</Empty>
        )}
      </Card>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="neu-in rounded-2xl p-5 text-center text-muted">{children}</div>;
}
