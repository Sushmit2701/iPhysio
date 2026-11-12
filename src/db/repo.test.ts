import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './db';
import { importSnapshot, resetAll, restoreDay, updateDay } from './repo';

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});

describe('repo', () => {
  it('stamps updatedAt, queues for sync, and undo restores the previous value with a newer stamp', async () => {
    await updateDay('2026-11-12', (d) => void (d.painAM = 4));
    const first = await db.days.get('2026-11-12');
    const prev = await updateDay('2026-11-12', (d) => void (d.painAM = 7));
    expect((await db.days.get('2026-11-12'))!.painAM).toBe(7);
    await restoreDay('2026-11-12', prev);
    const after = await db.days.get('2026-11-12');
    expect(after!.painAM).toBe(4);
    expect(after!.updatedAt).toBeGreaterThan(first!.updatedAt);
    expect(await db.outbox.get('days:2026-11-12')).toBeTruthy();
  });
  it('undo of a first edit tombstones the day', async () => {
    const prev = await updateDay('2026-11-13', (d) => void (d.gym = true));
    await restoreDay('2026-11-13', prev);
    expect((await db.days.get('2026-11-13'))!.deleted).toBe(true);
  });
  it('merge import never overwrites a newer local edit; overwrite does', async () => {
    await updateDay('2026-11-12', (d) => void (d.painAM = 2));
    const n = await importSnapshot({ days: [{ date: '2026-11-12', painAM: 9, updatedAt: 1 }, { date: '2026-11-11', painAM: 5, updatedAt: 1 }] }, 'merge');
    expect(n).toBe(1);
    expect((await db.days.get('2026-11-12'))!.painAM).toBe(2);
    await importSnapshot({ days: [{ date: '2026-11-12', painAM: 9, updatedAt: 1 }] }, 'replace');
    expect((await db.days.get('2026-11-12'))!.painAM).toBe(9);
  });
  it('reset tombstones everything', async () => {
    await updateDay('2026-11-12', (d) => void (d.painAM = 2));
    await resetAll();
    expect((await db.days.toArray()).every((d) => d.deleted)).toBe(true);
  });
});
