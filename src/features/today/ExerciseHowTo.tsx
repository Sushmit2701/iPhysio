import type { ReactElement } from 'react';
import { EX } from '../../domain/content';
import type { ExKey, Mode } from '../../domain/types';

/** Schematic side-view diagrams: arm in ink, equipment muted, movement arrow in accent. */
function Diagram({ k }: { k: ExKey }) {
  const arm = { stroke: 'var(--ink)', strokeWidth: 10, strokeLinecap: 'round' as const, fill: 'none' };
  const eq = { fill: 'var(--surface-2)', stroke: 'var(--muted)', strokeWidth: 2 };
  const mv = { stroke: 'var(--accent)', strokeWidth: 3, fill: 'none', markerEnd: 'url(#ah)' };
  const dumbbell = (x: number, y: number, rot = 0) => (
    <g transform={`translate(${x} ${y}) rotate(${rot})`}>
      <rect x={-3} y={-22} width={6} height={44} rx={2} fill="var(--muted)" />
      <rect x={-11} y={-30} width={22} height={14} rx={3} {...eq} />
    </g>
  );
  const roller = <circle cx={70} cy={92} r={18} {...eq} />;
  const scenes: Record<ExKey, ReactElement> = {
    ecrl: (
      <>
        <path d="M60 18 L60 70 L120 50" {...arm} />
        {dumbbell(128, 44, 20)}
        <path d="M150 80 Q170 50 150 22" {...mv} />
      </>
    ),
    ecrb: (
      <>
        {roller}
        <path d="M30 70 L120 70" {...arm} />
        <path d="M120 70 L148 82" {...arm} strokeWidth={9} />
        <path d="M168 100 Q178 76 162 56" {...mv} />
      </>
    ),
    ecu: (
      <>
        <path d="M80 10 L80 90" {...arm} />
        <path d="M80 90 L82 104" {...arm} strokeWidth={9} />
        {dumbbell(96, 100, 75)}
        <path d="M128 80 Q140 98 122 112" {...mv} />
      </>
    ),
    sup: (
      <>
        {roller}
        <path d="M30 70 L128 70" {...arm} />
        {dumbbell(140, 58, 0)}
        <path d="M165 36 A24 24 0 1 1 160 86" {...mv} />
      </>
    ),
    ed: (
      <>
        {roller}
        <path d="M30 70 L120 70" {...arm} />
        <path d="M120 70 L146 70 M120 66 L146 58" {...arm} strokeWidth={5} />
        <ellipse cx={150} cy={66} rx={10} ry={18} fill="none" stroke="var(--muted)" strokeWidth={3} />
        <path d="M168 76 Q180 60 168 42" {...mv} />
      </>
    ),
    nerve: (
      <>
        <circle cx={100} cy={22} r={14} fill="none" stroke="var(--ink)" strokeWidth={4} />
        <path d="M100 36 L100 90 M100 50 L160 50" {...arm} strokeWidth={8} />
        <path d="M70 18 Q100 -4 130 18" {...mv} />
        <path d="M130 18 Q100 -4 70 18" {...mv} strokeOpacity={0.4} />
      </>
    ),
  };
  return (
    <svg viewBox="0 0 200 120" className="h-auto w-full max-w-[260px]" role="img" aria-label={`Diagram: ${EX[k].name}`}>
      <defs>
        <marker id="ah" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10z" fill="var(--accent)" />
        </marker>
      </defs>
      {scenes[k]}
    </svg>
  );
}

export function ExerciseHowTo({ k, mode }: { k: ExKey; mode: Mode }) {
  const e = EX[k];
  return (
    <div className="neu-in flex flex-col gap-3 rounded-2xl p-4 text-[0.95rem] text-ink">
      <Diagram k={k} />
      <ol className="flex list-decimal flex-col gap-1.5 pl-5">
        {e.how.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
      {mode === 'iso' && k !== 'nerve' && (
        <p>
          <b>Isometric version:</b> {e.iso}
        </p>
      )}
    </div>
  );
}
