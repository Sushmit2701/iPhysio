import { useEffect, useState } from 'react';
import { StatusBox } from '../ui/controls';
import { loadConfig } from './config';

const b64 = (s: string) => {
  const pad = '='.repeat((4 - (s.length % 4)) % 4);
  const raw = atob((s + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};
const standalone = () => matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;

export default function PushCard() {
  const cfg = loadConfig();
  const [on, setOn] = useState<boolean | null>(null);
  const [msg, setMsg] = useState('');
  const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

  useEffect(() => {
    if (!supported) return;
    void navigator.serviceWorker.ready.then((r) => r.pushManager.getSubscription()).then((s) => setOn(!!s));
  }, [supported]);

  if (!cfg) return <p className="hint">Turn on account sync first.</p>;
  if (!cfg.vapidPublicKey) return <p className="hint">Add the VAPID public key in sync settings to use push.</p>;
  if (!supported || (/iPhone|iPad/.test(navigator.userAgent) && !standalone()))
    return (
      <StatusBox tone="none" title="Not available here">
        Open the app from its Home Screen icon to turn on push.
      </StatusBox>
    );

  const enable = async () => {
    setMsg('');
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') return setMsg('Notifications are blocked. Allow them in iPhone Settings, Notifications, Elbow.');
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(cfg.vapidPublicKey!) });
      const { getClient } = await import('./engine');
      const sb = await getClient();
      if (!(await sb?.auth.getSession())?.data.session) throw new Error('Sign in to sync first.');
      const { error } = await sb!.from('push_subs').upsert({ endpoint: sub.endpoint, sub: sub.toJSON(), tz: Intl.DateTimeFormat().resolvedOptions().timeZone, enabled: true });
      if (error) throw error;
      setOn(true);
      setMsg('Push reminders are on for this device.');
    } catch (e) {
      setMsg((e as Error).message);
    }
  };
  const disable = async () => {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      const { getClient } = await import('./engine');
      const sb = await getClient();
      await sb?.from('push_subs').delete().eq('endpoint', sub.endpoint);
      await sub.unsubscribe();
    }
    setOn(false);
    setMsg('Push reminders are off for this device.');
  };

  return (
    <div className="flex flex-col gap-2">
      <button type="button" className={`btn ${on ? '' : 'btn-primary'}`} onClick={on ? disable : enable}>
        {on ? 'Turn off push reminders' : 'Turn on push reminders'}
      </button>
      {msg && (
        <p role="status" className="hint">
          {msg}
        </p>
      )}
    </div>
  );
}
