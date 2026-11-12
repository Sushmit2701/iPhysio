import { useRef, useState } from 'react';
import { useApp } from '../../ui/app-context';
import { Card, Seg, StatusBox } from '../../ui/controls';
import { importSnapshot, resetAll, snapshot } from '../../db/repo';
import { ImportError, parseBackup, toBackupJSON, toCSV } from '../../domain/backup';
import { saveFile } from '../../ui/download';

export default function Data() {
  const { today, dayList, toast } = useApp();
  const [mode, setMode] = useState<'merge' | 'replace'>('merge');
  const [text, setText] = useState('');
  const [msg, setMsg] = useState<{ tone: 'ok' | 'hi'; text: string } | null>(null);
  const [armed, setArmed] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const doImport = async (raw: string) => {
    try {
      const parsed = parseBackup(raw, 1);
      const n = await importSnapshot(parsed, mode);
      const c = parsed.counts;
      setMsg({ tone: 'ok', text: `Read ${c.days} days, ${c.assess} screens, ${c.prtee} PRTEE scores, ${c.appts} appointments. ${n} records ${mode === 'merge' ? 'were new or newer and' : ''} saved.` });
      setText('');
    } catch (e) {
      setMsg({ tone: 'hi', text: e instanceof ImportError ? e.message : 'Import failed. Nothing was changed.' });
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Card title="Export">
        <p className="hint">Everything lives on this device. Export now and then to keep a copy in Files or iCloud Drive. {dayList.length} days logged.</p>
        <button type="button" className="btn btn-primary" onClick={async () => void saveFile(`elbow-rehab-${today}.json`, toBackupJSON(await snapshot()), 'application/json')}>
          Export backup (JSON)
        </button>
        <button type="button" className="btn" onClick={async () => void saveFile(`elbow-rehab-${today}.csv`, toCSV((await snapshot()).days), 'text/csv')}>
          Export daily log (CSV, for a spreadsheet)
        </button>
      </Card>

      <Card title="Import">
        <p className="hint">Accepts the prototype’s backup text and this app’s JSON export. Values out of range are dropped, not guessed.</p>
        <Seg
          label="Import mode"
          options={[
            { v: 'merge', label: 'Merge (keep newer)' },
            { v: 'replace', label: 'Overwrite' },
          ]}
          value={mode}
          onChange={setMode}
        />
        <p className="text-sm text-muted">
          {mode === 'merge' ? 'Merge keeps whichever copy of each day was edited last. Safe to run twice.' : 'Overwrite replaces any day, screen or score that is in the backup, even if this device has a newer edit.'}
        </p>
        <input ref={fileRef} type="file" accept="application/json,.json,.txt" className="sr-only" onChange={async (e) => {
          const f = e.target.files?.[0];
          if (f) await doImport(await f.text());
          e.target.value = '';
        }} />
        <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
          Choose a backup file
        </button>
        <label className="flex flex-col gap-1">
          <span className="label">Or paste the backup text</span>
          <textarea className="field-input min-h-28 font-mono text-sm" value={text} onChange={(e) => setText(e.target.value)} placeholder='{"settings":…,"days":…}' />
        </label>
        <button type="button" className="btn" disabled={!text.trim()} onClick={() => doImport(text)}>
          Import pasted text
        </button>
        {msg && (
          <div role="status">
            <StatusBox tone={msg.tone} title={msg.tone === 'ok' ? 'Imported' : 'Not imported'}>
              {msg.text}
            </StatusBox>
          </div>
        )}
      </Card>

      <Card title="Delete everything">
        <p className="hint">Deletes every log, test, score and appointment on this device{' '}(and on your sync account if sync is on). Export first if unsure.</p>
        <button
          type="button"
          className="btn btn-danger"
          onClick={async () => {
            if (!armed) return setArmed(true);
            await resetAll();
            setArmed(false);
            toast('All data deleted');
          }}
          onBlur={() => setArmed(false)}
        >
          {armed ? 'Tap again to delete everything' : 'Delete all data'}
        </button>
      </Card>
    </div>
  );
}
