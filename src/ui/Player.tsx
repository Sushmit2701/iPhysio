// Music-player style pieces shared by the guided session and the routine.
export const fmtS = (sec: number) => {
  const t = Math.max(0, Math.floor(sec));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};

/** The hold timer drawn as a record: soft halo lines, grooved disc, gradient progress arc, glowing label. */
export function Vinyl({ frac, big, label, sub, spinning }: { frac: number; big: string; label: string; sub: string; spinning: boolean }) {
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
export function SetWave({ frac, left, right }: { frac: number; left: string; right: string }) {
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

