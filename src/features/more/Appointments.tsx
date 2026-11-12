import { useState } from 'react';
import { useApp } from '../../ui/app-context';
import { Card, Seg } from '../../ui/controls';
import { deleteAppt, saveAppt } from '../../db/repo';
import { longDate } from '../../domain/dates';
import { APPT_KINDS, type Appointment, type ApptKind } from '../../domain/types';

type Draft = Omit<Appointment, 'updatedAt'>;
const blank = (today: string): Draft => ({ id: crypto.randomUUID(), date: today, kind: 'Scan request', title: '', detail: '' });

export default function Appointments() {
  const { appts, today, toast } = useApp();
  const [draft, setDraft] = useState<Draft | null>(null);
  const sorted = [...appts].sort((a, b) => (a.date < b.date ? 1 : -1));

  if (draft)
    return (
      <Card title={appts.some((a) => a.id === draft.id) ? 'Edit entry' : 'New entry'}>
        <Seg<ApptKind> label="Type" options={APPT_KINDS} value={draft.kind} onChange={(kind) => setDraft({ ...draft, kind })} />
        <label className="flex flex-col gap-1">
          <span className="label">Date</span>
          <input className="field-input" type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="label">Title</span>
          <input className="field-input" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="e.g. MRI left elbow requested" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="label">Details or result</span>
          <textarea className="field-input min-h-36" value={draft.detail} onChange={(e) => setDraft({ ...draft, detail: e.target.value })} placeholder="Findings, plan, who you saw, next steps" />
        </label>
        <div className="flex gap-3">
          <button type="button" className="btn grow" onClick={() => setDraft(null)}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary grow"
            disabled={!draft.title.trim() || !draft.date}
            onClick={async () => {
              await saveAppt({ ...draft, title: draft.title.trim() });
              setDraft(null);
              toast('Saved');
            }}
          >
            Save
          </button>
        </div>
        {appts.some((a) => a.id === draft.id) && (
          <button
            type="button"
            className="btn btn-danger"
            onClick={async () => {
              const id = draft.id;
              const prev = appts.find((a) => a.id === id)!;
              await deleteAppt(id);
              setDraft(null);
              toast('Entry deleted', () => saveAppt({ ...prev, deleted: undefined }));
            }}
          >
            Delete entry
          </button>
        )}
      </Card>
    );

  return (
    <div className="flex flex-col gap-4">
      <button type="button" className="btn btn-primary" onClick={() => setDraft(blank(today))}>
        Add scan, clinic or result
      </button>
      {sorted.length === 0 ? (
        <p className="neu-in rounded-2xl p-5 text-center text-muted">Nothing yet. For example: “MRI left elbow requested”, then add the result when it is back.</p>
      ) : (
        <ul className="card flex flex-col p-0">
          {sorted.map((a) => (
            <li key={a.id} className="border-t border-line first:border-t-0">
              <button type="button" className="flex w-full flex-col gap-1 px-4 py-3 text-left" onClick={() => setDraft({ ...a })}>
                <span className="flex flex-wrap items-center gap-2">
                  <span className="pill">{a.kind}</span>
                  <span className="text-sm text-muted">
                    {longDate(a.date)}
                    {a.date > today ? ' · upcoming' : ''}
                  </span>
                </span>
                <b>{a.title}</b>
                {a.detail && <span className="line-clamp-3 whitespace-pre-line text-[0.95rem] text-muted">{a.detail}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
