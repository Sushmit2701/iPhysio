import Dexie, { type Table } from 'dexie';
import type { Appointment, Assessment, DayLog, PrteeRecord, Settings } from '../domain/types';

export type TableName = 'days' | 'assess' | 'prtee' | 'settings' | 'appts';
export interface OutboxEntry {
  key: string; // `${table}:${id}`
  table: TableName;
  id: string;
}
export interface MetaEntry {
  key: string;
  value: unknown;
}

export class RehabDB extends Dexie {
  days!: Table<DayLog, string>;
  assess!: Table<Assessment, string>;
  prtee!: Table<PrteeRecord, string>;
  settings!: Table<Settings, string>;
  appts!: Table<Appointment, string>;
  outbox!: Table<OutboxEntry, string>;
  meta!: Table<MetaEntry, string>;

  constructor(name = 'elbow-rehab') {
    super(name);
    this.version(1).stores({
      days: '&date, updatedAt',
      assess: '&id, date, updatedAt',
      prtee: '&id, date, updatedAt',
      settings: '&id',
      appts: '&id, date, updatedAt',
      outbox: '&key, table',
      meta: '&key',
    });
  }
}

export const db = new RehabDB();

export const idOf = (table: TableName, rec: { date?: string; id?: string }) => (table === 'days' ? rec.date! : rec.id!);
