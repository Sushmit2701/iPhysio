import { useEffect, useRef, useState } from 'react';
import { useApp } from '../../ui/app-context';
import { Card, PainScale, StatusBox } from '../../ui/controls';
import { saveAssessment, savePrtee } from '../../db/repo';
import { EX, ITEMS_FUNC, ITEMS_PAIN, TESTS, TNAME } from '../../domain/content';
import { shortDate } from '../../domain/dates';
import { isNum, prteeScore, rankExercises } from '../../domain/logic';
import { SEED_ASSESS } from '../../domain/seed';
import { TEST_KEYS, type Scores } from '../../domain/types';

function useDraft<T>(key: string, init: () => T) {
  const [v, setV] = useState<T>(() => {
    try {
      const s = localStorage.getItem(key);
      if (s) return JSON.parse(s) as T;
    } catch {
      /* ignore */
    }
    return init();
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(v));
    } catch {
      /* ignore */
    }
  }, [key, v]);
  const clear = () => {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  };
  return [v, setV, clear] as const;
}

export default function Tests({ focus }: { focus?: string }) {
  const { latest, assess, prtee, today, toast } = useApp();
  const screenRef = useRef<HTMLDivElement>(null);
  const prteeRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = focus === 'prtee' ? prteeRef.current : focus === 'screen' ? screenRef.current : null;
    el?.scrollIntoView({ block: 'start' });
  }, [focus]);

  const [draft, setDraft, clearDraft] = useDraft('draft-screen', () => ({ scores: { ...latest.scores } as Scores, finger: latest.finger ?? '', note: '' }));
  const ranked = rankExercises(draft);
  const [pd, setPd, clearPd] = useDraft<{ items: Record<string, number>; pfg: string }>('draft-prtee', () => ({ items: {}, pfg: '' }));
  const sc = prteeScore(pd.items);
  const answered = Object.keys(pd.items).length;
  const hist = assess.length ? assess : [SEED_ASSESS];

  return (
    <div className="flex flex-col gap-4">
      <div ref={screenRef} className="scroll-mt-24">
        <Card title="Movement screen">
          <p className="hint">
            Resist each movement with the other hand and score the pain 0 to 10. Go light, or skip a test, if the elbow is very sore. Your three highest scores become the daily priorities. Repeat every 2 weeks.
          </p>
          {TESTS.map((t) => (
            <div key={t.k} className="flex flex-col gap-2 border-t border-line pt-4">
              <h3 className="text-lg">
                {t.name} {t.optional && <span className="pill ml-1 align-middle">Optional</span>}
              </h3>
              <p className="text-[0.95rem]">{t.setup}</p>
              {t.confirm && <p className="hint">{t.confirm}</p>}
              <p className="text-sm text-muted">In daily life: {t.life}</p>
              <PainScale name={`test.${t.k}`} label={`${t.short} pain`} size="md" value={draft.scores[t.k]} onChange={(v) => setDraft({ ...draft, scores: { ...draft.scores, [t.k]: v } })} />
              {t.optional && (
                <button
                  type="button"
                  aria-pressed={draft.scores[t.k] == null}
                  className={`chip min-h-12 self-start rounded-xl border px-4 font-semibold ${draft.scores[t.k] == null ? 'border-accent bg-accent text-accent-ink' : 'border-line'}`}
                  onClick={() => setDraft({ ...draft, scores: { ...draft.scores, [t.k]: null } })}
                >
                  Not tested
                </button>
              )}
              {t.finger && (
                <label className="flex flex-col gap-1">
                  <span className="label">Most painful finger</span>
                  <input className="field-input" value={draft.finger} onChange={(e) => setDraft({ ...draft, finger: e.target.value })} placeholder="e.g. 3rd (middle)" />
                </label>
              )}
            </div>
          ))}
          <label className="flex flex-col gap-1 border-t border-line pt-4">
            <span className="label">Notes</span>
            <input className="field-input" value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
          </label>
          <button
            type="button"
            className="btn btn-primary min-h-14"
            onClick={async () => {
              await saveAssessment({ date: today, scores: draft.scores, finger: draft.finger, note: draft.note, ecrlBent: null });
              clearDraft();
              toast(`Screen saved for ${shortDate(today)}. Priorities updated.`);
            }}
          >
            Save this screen as today ({shortDate(today)})
          </button>
        </Card>
      </div>

      <Card title="Priorities from this screen">
        {ranked.length ? (
          <ol className="flex flex-col">
            {ranked.map((x, i) => (
              <li key={x.k} className="flex items-center gap-3 border-t border-line py-2 first:border-t-0">
                <span className="grid h-8 w-8 flex-none place-items-center rounded-full bg-accent-soft font-display font-bold text-accent">{i + 1}</span>
                <span className="grow">
                  <b>{TNAME[x.k]}</b> <span className="text-muted">{EX[x.k].name}</span>
                </span>
                <b className="tabular">{x.score}/10</b>
                {x.priority && <span className="pill">Priority</span>}
              </li>
            ))}
          </ol>
        ) : (
          <p className="hint">Score at least one test above 0.</p>
        )}
      </Card>

      <Card title="Screen history">
        <div className="overflow-x-auto">
          <table className="tabular w-full text-sm">
            <thead>
              <tr className="text-left text-muted">
                <th className="py-1.5 pr-2">Date</th>
                {TEST_KEYS.map((k) => (
                  <th key={k} className="py-1.5 pr-2">
                    {TNAME[k]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {hist
                .slice()
                .reverse()
                .map((r) => (
                  <tr key={r.id} className="border-t border-line">
                    <td className="py-2 pr-2">{shortDate(r.date)}</td>
                    {TEST_KEYS.map((k) => (
                      <td key={k} className="py-2 pr-2">
                        {isNum(r.scores[k]) ? r.scores[k] : '–'}
                      </td>
                    ))}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div ref={prteeRef} className="scroll-mt-24">
        <Card title="Weekly PRTEE">
          <p className="hint">
            The Patient-Rated Tennis Elbow Evaluation, 15 items about the last week. 0 is no pain or no difficulty, 10 is the worst pain or unable to do it. Total 0 to 100, lower is better.
          </p>
          <h3 className="text-lg">Pain</h3>
          {ITEMS_PAIN.map((t, i) => (
            <div key={t} className="flex flex-col gap-2">
              <div className="label">{t}</div>
              <PainScale name={`p${i}`} size="md" label={t} value={pd.items['p' + i]} onChange={(v) => setPd({ ...pd, items: { ...pd.items, ['p' + i]: v } })} />
            </div>
          ))}
          <h3 className="pt-2 text-lg">Difficulty</h3>
          {ITEMS_FUNC.map((t, i) => (
            <div key={t} className="flex flex-col gap-2">
              <div className="label">{t}</div>
              <PainScale name={`f${i}`} size="md" label={t} value={pd.items['f' + i]} onChange={(v) => setPd({ ...pd, items: { ...pd.items, ['f' + i]: v } })} />
            </div>
          ))}
          <label className="flex flex-col gap-1">
            <span className="label">Pain-free grip strength in kg (optional, needs a dynamometer)</span>
            <input className="field-input" type="number" inputMode="decimal" step="0.5" min="0" value={pd.pfg} onChange={(e) => setPd({ ...pd, pfg: e.target.value })} />
          </label>
          <StatusBox tone="none" title={sc ? `Total ${sc.total} / 100` : `Answered ${answered} of 15`}>
            {sc && `Pain ${sc.pain} / 50, function ${sc.func} / 50`}
          </StatusBox>
          <button
            type="button"
            className="btn btn-primary min-h-14"
            disabled={!sc}
            onClick={async () => {
              if (!sc) return;
              const pfg = parseFloat(pd.pfg);
              await savePrtee({ date: today, pain: sc.pain, func: sc.func, total: sc.total, pfg: Number.isFinite(pfg) ? pfg : null, items: pd.items });
              clearPd();
              setPd({ items: {}, pfg: '' });
              toast(`PRTEE saved: ${sc.total}/100`);
            }}
          >
            Save weekly score
          </button>
          {prtee.length > 0 && (
            <div className="overflow-x-auto">
              <table className="tabular w-full text-sm">
                <thead>
                  <tr className="text-left text-muted">
                    <th className="py-1.5">Date</th>
                    <th className="py-1.5">Pain</th>
                    <th className="py-1.5">Function</th>
                    <th className="py-1.5">Total</th>
                    <th className="py-1.5">Grip kg</th>
                  </tr>
                </thead>
                <tbody>
                  {prtee
                    .slice()
                    .reverse()
                    .map((r) => (
                      <tr key={r.id} className="border-t border-line">
                        <td className="py-2">{shortDate(r.date)}</td>
                        <td className="py-2">{r.pain}</td>
                        <td className="py-2">{r.func}</td>
                        <td className="py-2 font-bold">{r.total}</td>
                        <td className="py-2">{isNum(r.pfg) ? r.pfg : '–'}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <Card title="Which pain scale?">
        <ul className="flex list-disc flex-col gap-2 pl-5 text-[0.95rem]">
          <li><b>0 to 10 rating:</b> simple and reliable. A change of about 2 points or 30% is usually felt as real. It is noisy day to day, so use the 7-day average.</li>
          <li><b>PRTEE:</b> the better weekly measure because it covers function as well as pain. About 11 points is often cited as a meaningful change.</li>
          <li><b>Pain-free grip strength:</b> objective and responsive if you have a dynamometer.</li>
          <li><b>Pain character and task scores:</b> sharp turning to aching, and falling bottle cap and mug scores, show progress even when the number sits still.</li>
        </ul>
      </Card>
    </div>
  );
}
