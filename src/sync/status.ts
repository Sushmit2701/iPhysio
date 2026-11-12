import { useSyncExternalStore } from 'react';

export type SyncState = 'local' | 'syncing' | 'synced' | 'offline' | 'error';
let state: SyncState = 'local';
let detail = '';
const subs = new Set<() => void>();
export function setSyncState(s: SyncState, d = '') {
  state = s;
  detail = d;
  subs.forEach((f) => f());
}
export const getSyncDetail = () => detail;
const LABEL: Record<SyncState, string> = {
  local: 'saved on this device',
  syncing: 'syncing…',
  synced: 'synced',
  offline: 'offline, saved on device',
  error: 'sync failed, saved on device',
};
export function useSyncStatus() {
  const s = useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    () => state,
  );
  return LABEL[s];
}
export function useSyncState() {
  return useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    () => state,
  );
}

/** Starts sync only if the user turned it on. The Supabase client is loaded lazily, so a local-only app never contacts any server. */
export function startSyncIfEnabled() {
  try {
    if (localStorage.getItem('elbow-sync-config')) void import('./engine').then((m) => m.startSync());
  } catch {
    /* storage blocked */
  }
}
