import { describe, expect, it } from 'vitest';
import { mergeCollections, pickNewer } from './merge';
import { parseBackup, toBackupJSON, toCSV, ImportError } from './backup';
import { buildIcs } from './ics';
import { defaultSettings } from './seed';

describe('merge by updatedAt', () => {
  it('a late sync never overwrites a newer local edit', () => {
    const local = { updatedAt: 2000, painAM: 3 };
    const remote = { updatedAt: 1000, painAM: 7 };
    expect(pickNewer(local, remote)).toBe('local');
    expect(pickNewer(remote, local)).toBe('remote');
    expect(pickNewer(local, { ...local })).toBe('equal');
  });
  it('splits a collection into writes in each direction', () => {
    const l = new Map([
      ['a', { updatedAt: 5 }],
      ['b', { updatedAt: 1 }],
      ['c', { updatedAt: 3 }],
    ]);
    const r = new Map([
      ['a', { updatedAt: 4 }],
      ['b', { updatedAt: 2, deleted: true }],
      ['d', { updatedAt: 1 }],
      ['c', { updatedAt: 3 }],
    ]);
    const { toLocal, toRemote } = mergeCollections(l, r);
    expect(toRemote).toEqual([{ updatedAt: 5 }]);
    expect(toLocal).toEqual([{ updatedAt: 2, deleted: true }, { updatedAt: 1 }]);
  });
});

const PROTO = {
  settings: { side: 'Left', phase: 'reduce', mode: 'iso', start: '2026-11-12', remindOn: true, t1: '08:00', t2: '20:00' },
  days: {
    '2026-11-12': {
      done: { ecrl: true, sup: false },
      load: { ecrl: '2 kg' },
      painAM: 6, painRehab: 3, painWorst: 8, painPM: 5,
      char: 'Burning', fn: { cap: 7, mug: 5, door: 4 },
      sleepH: 6.5, sleepQ: 3, wokePain: true, flare: false,
      gym: true, gymType: 'Pull', gymElbow: 'High',
      adj: { strap: true, heat: false }, note: 'rows, "heavy"', _t: 1763000000000,
    },
    '2026-11-13': { painAM: 99, char: 'Weird', gymType: 'Swim' },
    'bad-date': { painAM: 3 },
  },
  assess: [{ date: '2026-11-12', scores: { ecrl: 8, ecrb: 4, ecu: 4, sup: 8, ed: 8, nerve: null }, finger: '3rd (middle)', note: 'x' }],
  prtee: [{ date: '2026-11-12', pain: 30, func: 25, total: 55, pfg: null, items: { p0: 6 } }],
};

describe('import prototype backup', () => {
  it('maps every field and drops out-of-range values', () => {
    const r = parseBackup(JSON.stringify(PROTO), 99);
    expect(r.counts).toEqual({ days: 2, assess: 1, prtee: 1, appts: 0 });
    const d = r.days!.find((x) => x.date === '2026-11-12')!;
    expect(d).toMatchObject({
      painAM: 6, painWorst: 8, char: 'Burning', fn: { cap: 7, mug: 5, door: 4 }, sleepH: 6.5, sleepQ: 3,
      wokePain: true, gym: true, gymType: 'Pull', gymElbow: 'High', adj: { strap: true, heat: false },
      done: { ecrl: true, sup: false }, load: { ecrl: '2 kg' }, updatedAt: 1763000000000,
    });
    const bad = r.days!.find((x) => x.date === '2026-11-13')!;
    expect(bad).toEqual({ date: '2026-11-13', updatedAt: 99 });
    expect(r.assess![0].scores).toEqual({ ecrl: 8, ecrb: 4, ecu: 4, sup: 8, ed: 8, nerve: null });
    expect(r.settings).toMatchObject({ side: 'Left', phase: 'reduce', t2: '20:00' });
  });
  it('rejects non-backups', () => {
    expect(() => parseBackup('nope', 1)).toThrow(ImportError);
    expect(() => parseBackup('{"a":1}', 1)).toThrow(/no "days"/);
  });
  it('round-trips through the v2 export', () => {
    const r = parseBackup(JSON.stringify(PROTO), 99);
    const out = toBackupJSON({ settings: { ...defaultSettings(), ...r.settings }, days: r.days!, assess: r.assess!, prtee: r.prtee!, appts: [] });
    const again = parseBackup(out, 1);
    expect(again.days).toEqual(r.days);
    expect(again.assess).toEqual(r.assess);
  });
  it('exports CSV with escaping', () => {
    const r = parseBackup(JSON.stringify(PROTO), 99);
    const csv = toCSV(r.days!);
    const [head, row] = csv.split('\r\n');
    expect(head.startsWith('date,painAM,painRehab,painWorst,painPM,peak')).toBe(true);
    expect(row).toContain('"rows, ""heavy"""');
    expect(row.split(',').slice(0, 6)).toEqual(['2026-11-12', '6', '3', '8', '5', '8']);
  });
});

describe('ics', () => {
  it('builds two daily recurring events with alarms', () => {
    const ics = buildIcs(
      [
        { uid: 'rehab@elbow', time: '08:00', title: 'Elbow rehab', description: 'Priority exercises, 15 to 25 min' },
        { uid: 'log@elbow', time: '23:50', title: 'Evening log', description: 'Pain, tasks; gym' },
      ],
      '2026-11-12',
      new Date('2026-11-12T00:00:00Z'),
    );
    expect(ics).toContain('DTSTART:20261112T080000\r\nDTEND:20261112T081500');
    expect(ics.match(/RRULE:FREQ=DAILY/g)).toHaveLength(2);
    expect(ics.match(/BEGIN:VALARM/g)).toHaveLength(2);
    expect(ics).toContain('DESCRIPTION:Pain\\, tasks\; gym');
    expect(ics).toContain('DTSTART:20261112T235000\r\nDTEND:20261112T235000');
    expect(ics.split('\r\n').every((l) => l.length <= 75)).toBe(true);
  });
});
