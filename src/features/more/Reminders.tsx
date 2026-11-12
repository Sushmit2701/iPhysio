import { lazy, Suspense } from 'react';
import { useApp } from '../../ui/app-context';
import { Card, StatusBox, Toggle } from '../../ui/controls';
import { patchSettings } from '../../db/repo';
import { buildIcs } from '../../domain/ics';
import { saveFile } from '../../ui/download';
import { go } from '../../ui/route';

const PushCard = lazy(() => import('../../sync/PushCard'));

export function icsText(t1: string, t2: string, start: string) {
  const url = location.origin + location.pathname;
  return buildIcs(
    [
      { uid: 'elbow-rehab-session@elbow-rehab', time: t1, title: 'Elbow rehab', description: 'Priority exercises, 15 to 25 minutes. Open Elbow Rehab and start a guided session.', url },
      { uid: 'elbow-rehab-evening@elbow-rehab', time: t2, title: 'Elbow evening check-in', description: 'Log rehab, worst and evening pain, tasks and gym. Under 30 seconds.', url },
    ],
    start,
  );
}

export default function Reminders() {
  const { settings, today } = useApp();
  const ics = icsText(settings.t1, settings.t2, today);
  return (
    <div className="flex flex-col gap-4">
      <Card title="Times">
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="label">Rehab</span>
            <input className="field-input" type="time" value={settings.t1} onChange={(e) => e.target.value && void patchSettings({ t1: e.target.value })} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="label">Evening log</span>
            <input className="field-input" type="time" value={settings.t2} onChange={(e) => e.target.value && void patchSettings({ t2: e.target.value })} />
          </label>
        </div>
      </Card>

      <Card title="1. Calendar alerts (most reliable)">
        <p className="hint">Adds two events that repeat every day, each with an alert, to your phone’s calendar. They work with the app closed, offline and in any Focus mode you allow calendar alerts in.</p>
        <a className="btn btn-primary" href={`data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`} download="elbow-rehab-reminders.ics">
          Add to Calendar
        </a>
        <button type="button" className="btn" onClick={() => void saveFile('elbow-rehab-reminders.ics', ics, 'text/calendar')}>
          Share or save the .ics file
        </button>
        <p className="text-sm text-muted">
          On iPhone, “Add to Calendar” shows a preview with “Add All”. If nothing happens from the home-screen app, open the same page in Safari and tap it there. If you change the times later, add the file again: the events keep the same IDs, so most calendars update them instead of duplicating.
        </p>
      </Card>

      <Card title="2. In-app banners">
        <Toggle on={settings.remindOn} onChange={(v) => void patchSettings({ remindOn: v })}>
          Show reminder banners on Today
        </Toggle>
        <p className="hint">A banner appears after the rehab time if the priority exercises are not done, and after the evening time if the evening check-in is missing. Only visible while the app is open.</p>
      </Card>

      <Card title="3. Push notifications (needs sync)">
        <StatusBox tone="none" icon="info" title="What iPhone allows">
          <ul className="mt-1 flex list-disc flex-col gap-1 pl-5">
            <li>A web app cannot schedule notifications by itself on iPhone. A server has to send them (Web Push).</li>
            <li>Push only works once the app is added to the Home Screen (iOS 16.4 or later; your iPhone 15 Pro is fine), and you allow notifications from inside that home-screen app.</li>
            <li>It needs account sync, because the server must know your times and whether you already logged today. Removing the app from the Home Screen cancels push.</li>
            <li>Delivery is best effort. Low Power Mode and Focus can delay or hide it, so keep the calendar alerts as your backstop.</li>
          </ul>
        </StatusBox>
        <Suspense fallback={null}>
          <PushCard />
        </Suspense>
        <button type="button" className="btn" onClick={() => go('more', 'sync')}>
          Account sync settings
        </button>
      </Card>
    </div>
  );
}
