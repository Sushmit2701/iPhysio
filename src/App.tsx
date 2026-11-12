import { lazy, Suspense } from 'react';
import { useApp } from './ui/app-context';
import { useRoute, go } from './ui/route';
import { Icon } from './ui/Icon';
import { Toast } from './ui/Toast';
import { Today } from './features/today/Today';
import { Session } from './features/session/Session';
import { PHASES } from './domain/content';
import { diffDays } from './domain/dates';
import { useSyncStatus } from './sync/status';

const Trends = lazy(() => import('./features/trends/Trends'));
const Gym = lazy(() => import('./features/gym/Gym'));
const Plan = lazy(() => import('./features/plan/Plan'));
const Tests = lazy(() => import('./features/tests/Tests'));
const More = lazy(() => import('./features/more/More'));

const TABS = [
  ['today', 'Today', 'today'],
  ['trends', 'Trends', 'trends'],
  ['gym', 'Gym', 'gym'],
  ['plan', 'Plan', 'plan'],
  ['more', 'More', 'more'],
] as const;

export function App() {
  const { ready, settings, today } = useApp();
  const route = useRoute();
  const sync = useSyncStatus();
  const tab = route.tab === 'tests' ? 'more' : route.tab;
  const dayN = Math.max(1, diffDays(settings.start, today) + 1);

  if (route.tab === 'session') {
    // #/session/<date>[/<exercise>]
    const [d, ex] = (route.arg ?? '').split('/');
    return <Session date={d && d <= today ? d : today} startEx={ex} />;
  }

  return (
    <div className="min-h-dvh">
      <header className="safe-top sticky top-0 z-20 bg-bg/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <h1 className="text-xl tracking-tight">Elbow Rehab</h1>
            <p className="truncate text-sm text-muted">
              {settings.side} elbow · day {dayN} · {sync}
            </p>
          </div>
          <button type="button" className="neu-sm min-h-11 rounded-full px-4 text-sm font-semibold text-accent" onClick={() => go('plan')}>
            {PHASES[settings.phase].name}
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 pt-4" style={{ paddingBottom: 'calc(110px + env(safe-area-inset-bottom))' }}>
        {!ready ? (
          <p className="hint py-10 text-center">Loading…</p>
        ) : (
          <Suspense fallback={<p className="hint py-10 text-center">Loading…</p>}>
            {route.tab === 'today' && <Today date={route.arg} />}
            {route.tab === 'trends' && <Trends />}
            {route.tab === 'gym' && <Gym />}
            {route.tab === 'plan' && <Plan />}
            {route.tab === 'tests' && <Tests focus={route.arg} />}
            {route.tab === 'more' && <More section={route.arg} />}
          </Suspense>
        )}
      </main>
      <nav aria-label="Sections" className="safe-bottom pointer-events-none fixed inset-x-0 bottom-0 z-30 px-3 pb-2">
        <div className="neu pointer-events-auto mx-auto flex max-w-2xl gap-1 rounded-[28px] p-1.5">
          {TABS.map(([id, label, icon]) => {
            const on = tab === id;
            return (
              <button
                key={id}
                type="button"
                aria-current={on ? 'page' : undefined}
                onClick={() => go(id)}
                className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 rounded-[22px] text-xs font-semibold ${on ? 'neu-in text-accent' : 'text-muted'}`}
              >
                <Icon name={icon} size={24} />
                {label}
              </button>
            );
          })}
        </div>
      </nav>
      <Toast />
    </div>
  );
}
