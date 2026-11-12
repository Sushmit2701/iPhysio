// Small hand-drawn icon set (24px grid, 2px stroke) so we need no icon dependency.
const P: Record<string, string> = {
  today: 'M4 6h16M4 6v13a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V6M8 3v5M16 3v5M8 13l3 3 5-6',
  trends: 'M4 19h16M5 15l4-5 4 3 6-8',
  gym: 'M6 8v8M3 10v4M18 8v8M21 10v4M6 12h12',
  plan: 'M6 4h12v16H6zM9 9h6M9 13h6M9 17h3',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  left: 'M15 5l-7 7 7 7',
  right: 'M9 5l7 7-7 7',
  close: 'M6 6l12 12M18 6L6 18',
  play: 'M8 5v14l11-7z',
  pause: 'M8 5v14M16 5v14',
  check: 'M5 12l5 5 9-11',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  undo: 'M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3',
  sun: 'M12 4V2M12 22v-2M4 12H2M22 12h-2M5.6 5.6 4.2 4.2M19.8 19.8l-1.4-1.4M5.6 18.4l-1.4 1.4M19.8 4.2l-1.4 1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  moon: 'M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z',
  info: 'M12 8h.01M11 12h1v5h1M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z',
  alert: 'M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  down: 'M12 5v14M5 12l7 7 7-7',
  up: 'M12 19V5M5 12l7-7 7 7',
  skip: 'M5 5l10 7-10 7zM19 5v14',
  bell: 'M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8M10 20a2 2 0 0 0 4 0',
  file: 'M14 3H6v18h12V7zM14 3v4h4',
  cloud: 'M7 18a4 4 0 0 1-.5-8A6 6 0 0 1 18 9a4.5 4.5 0 0 1-.5 9z',
};

export function Icon({ name, size = 22, className = '' }: { name: keyof typeof P | string; size?: number; className?: string }) {
  const filled = name === 'play';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className={className} fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d={P[name] ?? ''} />
    </svg>
  );
}
