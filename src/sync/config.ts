export interface SyncConfig {
  url: string;
  anonKey: string;
  vapidPublicKey?: string;
}
const KEY = 'elbow-sync-config';

/** Build-time values (VITE_SUPABASE_URL etc.) or values typed into Sync settings. Sync is off unless one exists and the user opted in. */
export function buildTimeConfig(): SyncConfig | null {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  return url && anonKey ? { url, anonKey, vapidPublicKey: import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined } : null;
}
export function loadConfig(): SyncConfig | null {
  try {
    const s = localStorage.getItem(KEY);
    return s ? (JSON.parse(s) as SyncConfig) : null;
  } catch {
    return null;
  }
}
export function saveConfig(c: SyncConfig | null) {
  try {
    if (c) localStorage.setItem(KEY, JSON.stringify(c));
    else localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
