import { Card, StatusBox } from '../../ui/controls';

export default function Install() {
  const standalone = typeof window !== 'undefined' && (window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true);
  return (
    <div className="flex flex-col gap-4">
      <StatusBox tone={standalone ? 'ok' : 'info'} title={standalone ? 'Running as an installed app' : 'Running in the browser'}>
        {standalone ? 'Good. Reminders, push and storage work best like this.' : 'Install it so it opens full screen, works offline and keeps its data.'}
      </StatusBox>
      <Card title="iPhone (Safari)">
        <ol className="flex list-decimal flex-col gap-2 pl-5">
          <li>Open the app’s web address in Safari (not inside another app).</li>
          <li>Tap the Share button, then “Add to Home Screen”. Keep “Open as Web App” on.</li>
          <li>Open it from the new home screen icon. Do your logging from there from now on.</li>
          <li>Optional: in the app, More, Backup and data, import your prototype backup.</li>
        </ol>
        <p className="hint">
          Safari and the home-screen app keep separate storage on iPhone. Data you entered in a Safari tab will not appear in the installed app; export and import it, or turn on sync.
        </p>
      </Card>
      <Card title="Offline and storage">
        <p className="text-[0.95rem]">After the first load everything is cached, so the app opens and saves with no signal. iPhone may clear website data that has not been opened for several weeks; home-screen apps are treated better, but export a backup now and then, or use sync.</p>
      </Card>
      <Card title="Desktop">
        <p className="text-[0.95rem]">In Chrome or Edge, use the install icon in the address bar. In Safari on Mac, File, Add to Dock.</p>
      </Card>
    </div>
  );
}
