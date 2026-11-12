import { useEffect, useState, type ReactNode } from 'react';
import { painColor } from './pain';
import { Icon } from './Icon';
import { haptic } from './feedback';
import { useApp } from './app-context';

/**
 * 0-10 pain buttons. Each value is its own stable <button> (keyed by value) that only changes
 * attributes on select, so React never swaps the node under a finger. touch-action: manipulation
 * (set globally) removes the double-tap-zoom delay. This is the fix for the prototype's iPhone bug.
 */
export function PainScale({
  value,
  onChange,
  label,
  from = 0,
  to = 10,
  ramp = 'pain',
  size = 'lg',
  name,
}: {
  value: number | null | undefined;
  onChange: (v: number) => void;
  label: string;
  from?: number;
  to?: number;
  ramp?: 'pain' | 'quality' | 'none';
  size?: 'lg' | 'md';
  name?: string;
}) {
  const { settings, dark } = useApp();
  const vals = Array.from({ length: to - from + 1 }, (_, i) => from + i);
  const cols = vals.length > 6 ? 6 : vals.length;
  const fill = (v: number) =>
    ramp === 'pain' ? painColor(v, dark) : ramp === 'quality' ? painColor(((to - v) * 10) / (to - from), dark) : 'var(--accent)';
  return (
    <div role="group" aria-label={label} data-scale={name} className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {vals.map((v) => {
        const on = value === v;
        return (
          <button
            key={v}
            type="button"
            aria-pressed={on}
            aria-label={`${label}: ${v}`}
            data-value={v}
            onClick={() => {
              haptic(settings.haptics);
              onChange(v);
            }}
            className={`chip tabular rounded-2xl font-display font-bold select-none ${size === 'lg' ? 'h-14 text-2xl' : 'h-12 text-xl'} ${
              on ? 'text-white shadow-[inset_3px_3px_7px_rgba(0,0,0,0.25),0_0_0_3px_var(--bg),0_0_0_5px_var(--ink)]' : 'neu-sm text-ink'
            }`}
            style={on ? { background: fill(v) } : undefined}
          >
            {v}
          </button>
        );
      })}
    </div>
  );
}

export function Seg<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly (T | { v: T; label: string })[];
  value: T | null | undefined;
  onChange: (v: T) => void;
  label: string;
}) {
  const { settings } = useApp();
  return (
    <div
      role="group"
      aria-label={label}
      className={options.length <= 4 ? 'grid gap-2' : 'flex flex-wrap gap-2'}
      style={options.length <= 4 ? { gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` } : undefined}
    >
      {options.map((o) => {
        const v = typeof o === 'string' ? o : o.v;
        const l = typeof o === 'string' ? o : o.label;
        const on = value === v;
        return (
          <button
            key={v}
            type="button"
            aria-pressed={on}
            onClick={() => {
              haptic(settings.haptics);
              onChange(v);
            }}
            className={`chip min-h-12 rounded-2xl px-3 py-1 font-semibold leading-tight ${options.length > 4 ? 'grow basis-auto' : ''} ${
              on ? 'grad-panel shadow-[inset_3px_3px_7px_rgba(0,0,0,0.22)]' : 'neu-sm text-ink'
            }`}
          >
            {l}
          </button>
        );
      })}
    </div>
  );
}

export function Toggle({ on, onChange, children, tone = 'accent' }: { on: boolean; onChange: (v: boolean) => void; children: ReactNode; tone?: 'accent' | 'bad' }) {
  const { settings } = useApp();
  const c = tone === 'bad' ? 'var(--bad)' : 'var(--accent)';
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => {
        haptic(settings.haptics);
        onChange(!on);
      }}
      className="chip neu-sm flex min-h-14 w-full items-center gap-3 rounded-2xl px-4 text-left font-medium"
    >
      <span
        aria-hidden
        className="neu-in relative h-7 w-12 flex-none rounded-full transition-colors"
        style={on ? { background: tone === 'bad' ? c : 'linear-gradient(145deg, var(--grad-a), var(--grad-b))', boxShadow: 'inset 2px 2px 5px rgba(0,0,0,0.25)' } : undefined}
      >
        <span className="absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-[left]" style={{ left: on ? 22 : 2 }} />
      </span>
      <span className="grow">{children}</span>
    </button>
  );
}

export function Stepper({
  value,
  onChange,
  step = 1,
  min = 0,
  max = 99,
  start,
  unit,
  label,
}: {
  value: number | null | undefined;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  start: number;
  unit?: string;
  label: string;
}) {
  const { settings } = useApp();
  const set = (d: number) => {
    haptic(settings.haptics);
    const base = value ?? start - d;
    onChange(Math.min(max, Math.max(min, Math.round((base + d) / step) * step)));
  };
  return (
    <div className="flex items-center gap-3" role="group" aria-label={label}>
      <button type="button" className="orb h-14 w-14" aria-label={`Less ${label}`} onClick={() => set(-step)}>
        <Icon name="minus" />
      </button>
      <output aria-live="polite" className="tabular grow text-center font-display text-4xl font-bold">
        {value ?? '–'}
        {value != null && unit ? <span className="ml-1 text-lg font-semibold text-muted">{unit}</span> : null}
      </output>
      <button type="button" className="orb h-14 w-14" aria-label={`More ${label}`} onClick={() => set(step)}>
        <Icon name="plus" />
      </button>
    </div>
  );
}

export function Card({ title, action, children, className = '' }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card flex flex-col gap-3 ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-3">
          {title && <h2 className="text-xl">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export type Tone = 'ok' | 'mid' | 'hi' | 'none' | 'info';
export function StatusBox({ tone, title, children, icon }: { tone: Tone; title: ReactNode; children?: ReactNode; icon?: string }) {
  const c = tone === 'ok' ? 'var(--good)' : tone === 'mid' ? 'var(--warn)' : tone === 'hi' ? 'var(--bad)' : tone === 'info' ? 'var(--accent)' : 'var(--line)';
  return (
    <div
      className="neu-sm flex gap-3 rounded-3xl border-l-4 p-4"
      style={{ borderColor: c, background: tone === 'none' ? undefined : `color-mix(in srgb, ${c} 10%, var(--surface))` }}
    >
      {icon && (
        <span style={{ color: tone === 'none' ? 'var(--muted)' : c }} className="mt-0.5 flex-none">
          <Icon name={icon} />
        </span>
      )}
      <div className="flex min-w-0 flex-col gap-1">
        <b className="font-display text-lg leading-tight">{title}</b>
        {children && <div className="text-[0.95rem]">{children}</div>}
      </div>
    </div>
  );
}

export function Tile({ n, label }: { n: ReactNode; label: ReactNode }) {
  return (
    <div className="neu flex flex-col gap-0.5 rounded-3xl p-4">
      <span className="tabular font-display text-3xl font-bold leading-tight">{n}</span>
      <span className="text-sm text-muted">{label}</span>
    </div>
  );
}

/** Full-screen sheet (used for check-ins and the guided session). */
export function Sheet({ title, onClose, children, footer, labelledBy = 'sheet-title' }: { title: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; labelledBy?: string }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);
  return (
    <div role="dialog" aria-modal="true" aria-labelledby={labelledBy} className="fixed inset-0 z-40 flex flex-col bg-bg" style={{ background: 'radial-gradient(120% 70% at 0% 0%, var(--surface), var(--bg) 60%)' }}>
      <header className="safe-top">
        <div className="mx-auto flex max-w-2xl items-center gap-2 px-2 py-2">
          <button type="button" className="orb h-12 w-12 flex-none" onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </button>
          <h2 id={labelledBy} className="grow truncate text-lg">
            {title}
          </h2>
        </div>
      </header>
      <div className="grow overflow-y-auto overscroll-contain">
        <div className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-4">{children}</div>
      </div>
      {footer && (
        <footer className="safe-bottom">
          <div className="mx-auto max-w-2xl px-4 py-3">{footer}</div>
        </footer>
      )}
    </div>
  );
}

export function Disclosure({ summary, children, defaultOpen = false }: { summary: ReactNode; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="flex min-h-12 w-full items-center justify-between gap-2 text-left font-semibold text-accent">
        {summary}
        <span className={`transition-transform ${open ? 'rotate-90' : ''}`}>
          <Icon name="right" size={18} />
        </span>
      </button>
      {open && <div className="anim-in">{children}</div>}
    </div>
  );
}
