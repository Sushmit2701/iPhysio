import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Card, StatusBox } from '../ui/controls';
import { useApp } from '../ui/app-context';
import { buildTimeConfig, loadConfig, saveConfig, type SyncConfig } from './config';
import { getSyncDetail, setSyncState, useSyncState } from './status';
import { db } from '../db/db';

type Engine = typeof import('./engine');

export default function SyncSettings() {
  const { toast } = useApp();
  const state = useSyncState();
  const [cfg, setCfg] = useState<SyncConfig | null>(loadConfig);
  const [form, setForm] = useState<SyncConfig>(() => cfg ?? buildTimeConfig() ?? { url: '', anonKey: '', vapidPublicKey: '' });
  const [engine, setEngine] = useState<Engine | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [last, setLast] = useState<number | null>(null);

  useEffect(() => {
    if (!cfg) return;
    let unsub: (() => void) | undefined;
    void import('./engine').then(async (m) => {
      setEngine(m);
      await m.startSync();
      const sb = await m.getClient();
      if (!sb) return;
      setSession((await sb.auth.getSession()).data.session);
      unsub = sb.auth.onAuthStateChange((_e, s) => setSession(s)).data.subscription.unsubscribe;
    });
    return () => unsub?.();
  }, [cfg]);
  useEffect(() => {
    void db.meta.get('lastSync').then((m) => setLast((m?.value as number) ?? null));
  }, [state]);

  const run = async (f: () => Promise<void>) => {
    setBusy(true);
    setErr('');
    try {
      await f();
    } catch (e) {
      setErr((e as Error).message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  if (!cfg)
    return (
      <div className="flex flex-col gap-4">
        <StatusBox tone="none" icon="info" title="Optional, and off">
          The app works fully on this device without an account. Sync is for using it on a second device (for example a laptop) and for push reminders. It talks only to your own Supabase project, protected so only your account can read your rows. See the README for the 10-minute setup.
        </StatusBox>
        <Card title="Your Supabase project">
          <label className="flex flex-col gap-1">
            <span className="label">Project URL</span>
            <input className="field-input" inputMode="url" autoCapitalize="off" autoCorrect="off" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value.trim() })} placeholder="https://abcd1234.supabase.co" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="label">Anon public key</span>
            <input className="field-input font-mono text-sm" autoCapitalize="off" autoCorrect="off" value={form.anonKey} onChange={(e) => setForm({ ...form, anonKey: e.target.value.trim() })} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="label">VAPID public key (only for push reminders)</span>
            <input className="field-input font-mono text-sm" autoCapitalize="off" autoCorrect="off" value={form.vapidPublicKey ?? ''} onChange={(e) => setForm({ ...form, vapidPublicKey: e.target.value.trim() })} />
          </label>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!/^https:\/\/.+/.test(form.url) || form.anonKey.length < 20}
            onClick={() => {
              saveConfig(form);
              setCfg(form);
            }}
          >
            Turn on sync
          </button>
        </Card>
      </div>
    );

  return (
    <div className="flex flex-col gap-4">
      {session ? (
        <Card title="Signed in">
          <p>{session.user.email}</p>
          <StatusBox tone={state === 'error' ? 'hi' : state === 'synced' ? 'ok' : 'none'} title={{ local: 'Not synced yet', syncing: 'Syncing…', synced: 'Up to date', offline: 'Offline. Changes are saved and will sync later', error: 'Sync failed. Changes are safe on this device' }[state]}>
            {last ? `Last sync ${new Date(last).toLocaleString()}.` : ''} {state === 'error' && getSyncDetail()}
          </StatusBox>
          <button type="button" className="btn btn-primary" disabled={busy || !engine} onClick={() => run(async () => engine!.syncNow())}>
            Sync now
          </button>
          <button
            type="button"
            className="btn"
            onClick={() =>
              run(async () => {
                const sb = await engine!.getClient();
                await sb?.auth.signOut();
                setSyncState('local');
                toast('Signed out. Data stays on this device.');
              })
            }
          >
            Sign out
          </button>
        </Card>
      ) : (
        <Card title="Sign in">
          <p className="hint">Enter your email. You will get a 6-digit code. On iPhone, type the code here rather than tapping the link, because the link opens Safari, which has separate storage from the home-screen app.</p>
          <label className="flex flex-col gap-1">
            <span className="label">Email</span>
            <input className="field-input" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value.trim())} />
          </label>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy || !email.includes('@') || !engine}
            onClick={() =>
              run(async () => {
                const sb = await engine!.getClient();
                const { error } = await sb!.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + location.pathname, shouldCreateUser: true } });
                if (error) throw error;
                setSent(true);
              })
            }
          >
            {sent ? 'Send a new code' : 'Send code'}
          </button>
          {sent && (
            <>
              <label className="flex flex-col gap-1">
                <span className="label">Code from the email</span>
                <input className="field-input tabular text-center text-2xl tracking-[0.4em]" inputMode="numeric" autoComplete="one-time-code" maxLength={8} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
              </label>
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy || code.length < 6}
                onClick={() =>
                  run(async () => {
                    const sb = await engine!.getClient();
                    const { error } = await sb!.auth.verifyOtp({ email, token: code, type: 'email' });
                    if (error) throw error;
                    await engine!.queueEverything();
                    await engine!.syncNow();
                    toast('Signed in. Your logs are syncing.');
                  })
                }
              >
                Verify and sync
              </button>
            </>
          )}
        </Card>
      )}
      {err && (
        <div role="alert">
          <StatusBox tone="hi" title="Something went wrong">
            {err}
          </StatusBox>
        </div>
      )}
      <Card title="Turn off sync">
        <p className="hint">Stops syncing on this device and forgets the project settings. Your data stays on this device and in your Supabase project.</p>
        <button
          type="button"
          className="btn"
          onClick={() =>
            run(async () => {
              const sb = await engine?.getClient();
              await sb?.auth.signOut().catch(() => undefined);
              saveConfig(null);
              engine?.resetClient();
              setSyncState('local');
              setCfg(null);
              location.reload();
            })
          }
        >
          Turn off sync
        </button>
      </Card>
    </div>
  );
}
