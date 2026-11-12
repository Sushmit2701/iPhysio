// Per-record last-writer-wins merge, keyed on updatedAt (epoch ms of the last edit).
// A remote copy replaces the local one only if it is strictly newer, so a late sync
// can never overwrite a newer local edit (the race suspected in the prototype).
import type { SyncMeta } from './types';

export function pickNewer<T extends SyncMeta>(local: T | undefined, remote: T | undefined): 'local' | 'remote' | 'equal' {
  if (!remote) return 'local';
  if (!local) return 'remote';
  if (remote.updatedAt > local.updatedAt) return 'remote';
  if (remote.updatedAt < local.updatedAt) return 'local';
  return 'equal';
}

/** Merge two keyed collections; returns the winners and which keys must be written locally or pushed. */
export function mergeCollections<T extends SyncMeta>(local: Map<string, T>, remote: Map<string, T>) {
  const toLocal: T[] = [];
  const toRemote: T[] = [];
  const keys = new Set([...local.keys(), ...remote.keys()]);
  for (const k of keys) {
    const l = local.get(k);
    const r = remote.get(k);
    const w = pickNewer(l, r);
    if (w === 'remote') toLocal.push(r!);
    else if (w === 'local') toRemote.push(l!);
  }
  return { toLocal, toRemote };
}
