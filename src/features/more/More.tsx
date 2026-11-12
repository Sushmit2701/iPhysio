import { lazy } from 'react';
import { Icon } from '../../ui/Icon';
import { go } from '../../ui/route';

const Data = lazy(() => import('./Data'));
const Appointments = lazy(() => import('./Appointments'));
const Reminders = lazy(() => import('./Reminders'));
const SettingsScreen = lazy(() => import('./Settings'));
const Install = lazy(() => import('./Install'));
const SyncSettings = lazy(() => import('../../sync/SyncSettings'));

const SECTIONS = [
  ['tests', 'Tests', 'Movement screen and weekly PRTEE', 'file'],
  ['appts', 'Appointments and results', 'Scans, clinic and physio notes', 'today'],
  ['reminders', 'Reminders', 'Calendar alerts, banners, push', 'bell'],
  ['data', 'Backup and data', 'Import the prototype backup, export JSON or CSV', 'file'],
  ['sync', 'Account sync (optional)', 'Use the app on more than one device', 'cloud'],
  ['settings', 'Settings', 'Side, start date, theme, sound, timers', 'info'],
  ['install', 'Install on iPhone', 'Add to the home screen, how offline works', 'down'],
] as const;

export default function More({ section }: { section?: string }) {
  const s = SECTIONS.find((x) => x[0] === section);
  if (s)
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <button type="button" className="btn btn-ghost h-12 w-12 p-0" aria-label="Back to More" onClick={() => go('more')}>
            <Icon name="left" />
          </button>
          <h2 className="text-2xl">{s[1]}</h2>
        </div>
        {section === 'data' && <Data />}
        {section === 'appts' && <Appointments />}
        {section === 'reminders' && <Reminders />}
        {section === 'settings' && <SettingsScreen />}
        {section === 'install' && <Install />}
        {section === 'sync' && <SyncSettings />}
      </div>
    );
  return (
    <nav aria-label="More" className="card flex flex-col p-0">
      {SECTIONS.map(([id, title, sub, icon]) => (
        <button key={id} type="button" onClick={() => (id === 'tests' ? go('tests') : go('more', id))} className="flex min-h-16 items-center gap-4 border-t border-line px-4 py-3 text-left first:border-t-0">
          <span className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-accent-soft text-accent">
            <Icon name={icon} />
          </span>
          <span className="flex grow flex-col">
            <b>{title}</b>
            <span className="text-sm text-muted">{sub}</span>
          </span>
          <Icon name="right" className="text-muted" />
        </button>
      ))}
    </nav>
  );
}
