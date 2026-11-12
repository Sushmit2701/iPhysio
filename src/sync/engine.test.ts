import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db/db';
import { updateDay } from '../db/repo';
import { applyRemote, type RemoteRow } from './engine';

const row = (id: string, data: Record<string, unknown>, updated_at: number, deleted = false): RemoteRow => ({ kind: 'days', id, data, updated_at, deleted, seq: 1 });

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});

describe('applyRemote', () => {
  it('a late pull never overwrites a newer local edit', async () => {
    await updateDay('2026-11-12', (d) => void (d.painAM = 3)); // local edit stamped now
    const n = await applyRemote([row('2026-11-12', { date: '2026-11-12', painAM: 8 }, Date.now() - 60_000)]);
    expect(n).toBe(0);
    expect((await db.days.get('2026-11-12'))!.painAM).toBe(3);
  });
  it('applies newer remote edits, including deletions, without queueing them back', async () => {
    await updateDay('2026-11-12', (d) => void (d.painAM = 3));
    await db.outbox.clear();
    await applyRemote([row('2026-11-12', { painAM: 8 }, Date.now() + 60_000), row('2026-11-10', { painWorst: 4 }, 5, true)]);
    expect((await db.days.get('2026-11-12'))!.painAM).toBe(8);
    expect((await db.days.get('2026-11-10'))!.deleted).toBe(true);
    expect(await db.outbox.count()).toBe(0);
  });
});
