import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { shortDate, weekdayDate } from '../domain/dates';
import { isNum } from '../domain/logic';
import { painColor } from './pain';
import { useApp } from './app-context';

export interface Series {
  key: string;
  label: string;
  vals: (number | null)[];
  color: string;
  width?: number;
  dash?: string;
  /** dots only, no connecting line; 'pain' colours each dot on the pain ramp */
  dotsOnly?: 'pain' | 'color';
  bar?: boolean;
  fmt?: (v: number) => string;
}

export interface ChartProps {
  label: string;
  dates: string[];
  series: Series[];
  ymin?: number;
  ymax: number;
  ticks: number[];
  refs?: { v: number; label: string; color: string }[];
  marks?: number[];
  height?: number;
  readoutExtra?: (i: number) => ReactNode;
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(340);
  useLayoutEffect(() => {
    if (!ref.current) return;
    setW(ref.current.clientWidth);
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

export function Chart({ label, dates, series, ymin = 0, ymax, ticks, refs = [], marks = [], height = 210, readoutExtra }: ChartProps) {
  const { dark } = useApp();
  const [box, W] = useWidth<HTMLDivElement>();
  const [sel, setSel] = useState<number | null>(null);
  useEffect(() => setSel(null), [dates.length, dates[0]]);
  const H = height;
  const pl = 28;
  const pr = 10;
  const pt = 12;
  const pb = 24;
  const n = dates.length;
  const iw = Math.max(10, W - pl - pr);
  const ih = H - pt - pb;
  const X = (i: number) => pl + (n <= 1 ? iw / 2 : (i * iw) / (n - 1));
  const Y = (v: number) => pt + (1 - (v - ymin) / (ymax - ymin)) * ih;
  const slot = n > 1 ? iw / (n - 1) : iw;
  const bw = Math.max(2, Math.min(16, slot * 0.7));

  const pick = (clientX: number, el: SVGSVGElement) => {
    const r = el.getBoundingClientRect();
    const x = clientX - r.left;
    const i = Math.round(((x - pl) / iw) * (n - 1));
    setSel(Math.max(0, Math.min(n - 1, i)));
  };

  const xLabels = Math.min(W < 420 ? 4 : 6, n);
  return (
    <div className="flex flex-col gap-2">
      <div className="neu-in min-h-12 rounded-2xl px-3 py-2 text-sm" aria-live="polite">
        {sel === null ? (
          <span className="text-muted">Tap or drag on the chart to inspect a day.</span>
        ) : (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <b className="font-semibold">{weekdayDate(dates[sel])}</b>
            {series.map((s) => {
              const v = s.vals[sel];
              return (
                <span key={s.key} className="inline-flex items-center gap-1.5">
                  <i aria-hidden className="inline-block h-[3px] w-3 rounded" style={{ background: s.dotsOnly === 'pain' ? 'var(--muted)' : s.color }} />
                  <b className="tabular">{isNum(v) ? (s.fmt ? s.fmt(v) : Number.isInteger(v) ? v : v.toFixed(1)) : '–'}</b>
                  <span className="text-muted">{s.label}</span>
                </span>
              );
            })}
            {readoutExtra?.(sel)}
          </div>
        )}
      </div>
      <div ref={box} className="w-full">
        <svg
          width={W}
          height={H}
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={label}
          tabIndex={0}
          className="block touch-pan-y select-none outline-offset-2"
          onPointerDown={(e) => pick(e.clientX, e.currentTarget)}
          onPointerMove={(e) => (e.pointerType !== 'mouse' || e.buttons || sel !== null) && pick(e.clientX, e.currentTarget)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft') setSel((s) => Math.max(0, (s ?? n) - 1));
            else if (e.key === 'ArrowRight') setSel((s) => Math.min(n - 1, (s ?? -1) + 1));
            else if (e.key === 'Escape') setSel(null);
            else return;
            e.preventDefault();
          }}
        >
          {marks.map((i) => (
            <rect key={`m${i}`} x={X(i) - Math.max(3, slot / 2)} width={Math.max(6, slot)} y={pt} height={ih} fill="var(--bad)" opacity={0.14} />
          ))}
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pl} x2={W - pr} y1={Y(t)} y2={Y(t)} stroke="var(--line)" strokeWidth={1} />
              <text x={pl - 6} y={Y(t) + 4} textAnchor="end" fontSize={11} fill="var(--muted)">
                {t}
              </text>
            </g>
          ))}
          {refs.map((r) => (
            <g key={r.label}>
              <line x1={pl} x2={W - pr} y1={Y(r.v)} y2={Y(r.v)} stroke={r.color} strokeDasharray="5 4" strokeWidth={1.5} />
              <text x={W - pr} y={Y(r.v) - 4} textAnchor="end" fontSize={11} fontWeight={600} fill="var(--muted)">
                {r.label}
              </text>
            </g>
          ))}
          {Array.from({ length: xLabels }, (_, j) => {
            const i = Math.round((j * (n - 1)) / Math.max(1, xLabels - 1));
            return (
              <text key={j} x={X(i)} y={H - 6} fontSize={11} fill="var(--muted)" textAnchor={j === 0 ? 'start' : j === xLabels - 1 ? 'end' : 'middle'}>
                {shortDate(dates[i])}
              </text>
            );
          })}
          {series.map((s) => {
            if (s.bar)
              return (
                <g key={s.key}>
                  {s.vals.map((v, i) =>
                    isNum(v) && v > ymin ? (
                      <rect key={i} x={X(i) - bw / 2} y={Y(v)} width={bw} height={Math.max(1, Y(ymin) - Y(v))} rx={Math.min(4, bw / 2)} fill={s.color} opacity={sel === null || sel === i ? 1 : 0.55} />
                    ) : null,
                  )}
                </g>
              );
            if (s.dotsOnly)
              return (
                <g key={s.key}>
                  {s.vals.map((v, i) =>
                    isNum(v) ? <circle key={i} cx={X(i)} cy={Y(v)} r={n > 60 ? 3 : 4.5} fill={s.dotsOnly === 'pain' ? painColor(v, dark) : s.color} stroke="var(--surface)" strokeWidth={1.5} /> : null,
                  )}
                </g>
              );
            let d = '';
            let last = -1;
            s.vals.forEach((v, i) => {
              if (isNum(v)) {
                d += `${last === -1 ? 'M' : 'L'}${X(i).toFixed(1)} ${Y(v).toFixed(1)}`;
                last = i;
              }
            });
            return (
              <g key={s.key}>
                {d && <path d={d} fill="none" stroke={s.color} strokeWidth={s.width ?? 2} strokeDasharray={s.dash} strokeLinejoin="round" strokeLinecap="round" />}
                {last >= 0 && <circle cx={X(last)} cy={Y(s.vals[last]!)} r={4} fill={s.color} stroke="var(--surface)" strokeWidth={2} />}
              </g>
            );
          })}
          {sel !== null && (
            <g pointerEvents="none">
              <line x1={X(sel)} x2={X(sel)} y1={pt} y2={pt + ih} stroke="var(--ink)" strokeWidth={1} />
              {series
                .filter((s) => !s.bar && isNum(s.vals[sel]))
                .map((s) => (
                  <circle key={s.key} cx={X(sel)} cy={Y(s.vals[sel]!)} r={5.5} fill={s.dotsOnly === 'pain' ? painColor(s.vals[sel]!, dark) : s.color} stroke="var(--surface)" strokeWidth={2} />
                ))}
            </g>
          )}
        </svg>
      </div>
    </div>
  );
}

export function Legend({ items }: { items: { label: string; color: string; kind?: 'line' | 'dash' | 'bar' | 'dot'; on?: boolean; onToggle?: () => void }[] }) {
  return (
    <div className="flex flex-wrap gap-2 text-sm">
      {items.map((it) => {
        const key = (
          <i
            aria-hidden
            className="inline-block flex-none"
            style={
              it.kind === 'dot'
                ? { width: 10, height: 10, borderRadius: 99, background: it.color }
                : it.kind === 'bar'
                  ? { width: 10, height: 10, borderRadius: 2, background: it.color }
                  : { width: 16, height: it.kind === 'dash' ? 0 : 3, borderTop: it.kind === 'dash' ? `3px dashed ${it.color}` : undefined, background: it.kind === 'dash' ? undefined : it.color, borderRadius: 2 }
            }
          />
        );
        return it.onToggle ? (
          <button key={it.label} type="button" aria-pressed={!!it.on} onClick={it.onToggle} className={`chip inline-flex min-h-10 items-center gap-2 rounded-full px-3 ${it.on ? 'neu-in text-ink' : 'neu-sm text-muted'}`}>
            {key}
            {it.label}
          </button>
        ) : (
          <span key={it.label} className="inline-flex min-h-8 items-center gap-2 text-muted">
            {key}
            {it.label}
          </span>
        );
      })}
    </div>
  );
}

export function DataTable({ dates, series }: { dates: string[]; series: Series[] }) {
  const rows = dates.map((d, i) => ({ d, i })).filter(({ i }) => series.some((s) => isNum(s.vals[i])));
  return (
    <details className="text-sm">
      <summary className="flex min-h-12 cursor-pointer items-center font-semibold text-accent">Show as table</summary>
      <div className="max-h-72 overflow-auto">
        <table className="tabular w-full border-collapse">
          <thead>
            <tr>
              <th className="sticky top-0 bg-bg p-1.5 text-left text-muted">Date</th>
              {series.map((s) => (
                <th key={s.key} className="sticky top-0 bg-bg p-1.5 text-left text-muted">
                  {s.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows
              .slice()
              .reverse()
              .map(({ d, i }) => (
                <tr key={d} className="border-t border-line">
                  <td className="p-1.5">{shortDate(d)}</td>
                  {series.map((s) => {
                    const v = s.vals[i];
                    return (
                      <td key={s.key} className="p-1.5">
                        {isNum(v) ? (s.fmt ? s.fmt(v) : Number.isInteger(v) ? v : v.toFixed(1)) : '–'}
                      </td>
                    );
                  })}
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
