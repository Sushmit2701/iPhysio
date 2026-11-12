import { useApp } from '../../ui/app-context';
import { Card, StatusBox } from '../../ui/controls';
import { Icon } from '../../ui/Icon';
import { patchSettings } from '../../db/repo';
import { PHASES, RED_FLAGS, SOURCE_NOTE } from '../../domain/content';
import { advanceCriteria, nextPhase, phaseSuggestion } from '../../domain/logic';
import { PHASE_ORDER, type Phase } from '../../domain/types';

export default function Plan() {
  const { settings, days, prio, today, toast } = useApp();
  const cur = settings.phase;
  const crit = advanceCriteria(days, prio, today);
  const all = crit.every((c) => c.ok);
  const sug = phaseSuggestion(days, prio, today, cur);
  const nxt = nextPhase(cur);
  const setPhase = (p: Phase) => {
    const prev = cur;
    const prevMode = settings.mode;
    void patchSettings({ phase: p, mode: p === 'reduce' ? (settings.mode === 'full' ? 'iso' : settings.mode) : 'full' });
    toast(`Phase set to ${PHASES[p].name}`, () => patchSettings({ phase: prev, mode: prevMode }));
  };

  return (
    <div className="flex flex-col gap-4">
      <Card title="Ready to progress?">
        <p className="hint">Checked against your last 7 days of logs.</p>
        <ul className="flex flex-col gap-2">
          {crit.map((c) => (
            <li key={c.key} className="flex items-start gap-3">
              <span className="mt-0.5 flex-none" style={{ color: c.ok ? 'var(--good)' : 'var(--bad)' }}>
                <Icon name={c.ok ? 'check' : 'close'} />
              </span>
              <span>
                <span className="sr-only">{c.ok ? 'Met: ' : 'Not met: '}</span>
                {c.text}
              </span>
            </li>
          ))}
        </ul>
        {sug ? (
          <StatusBox tone={PHASE_ORDER.indexOf(sug.phase) > PHASE_ORDER.indexOf(cur) ? 'ok' : 'mid'} title={`Suggestion: ${PHASES[sug.phase].name}`}>
            <p>{sug.reason}</p>
            <button type="button" className="btn btn-primary mt-2" onClick={() => setPhase(sug.phase)}>
              Switch to {PHASES[sug.phase].name}
            </button>
          </StatusBox>
        ) : (
          <StatusBox tone="none" title={all ? 'Criteria met' : 'Not yet'}>
            {all ? (nxt ? `You can move to ${PHASES[nxt].name}.` : 'Stay in Reinforce and keep it up.') : 'Stay in this phase and keep logging.'}
          </StatusBox>
        )}
      </Card>

      <Card title="Phases">
        <p className="hint">A road map, not strict rules. Move forward when you meet the criteria, and drop back a phase after a flare.</p>
        {PHASE_ORDER.map((k, i) => {
          const p = PHASES[k];
          const on = cur === k;
          return (
            <button
              key={k}
              type="button"
              aria-pressed={on}
              onClick={() => !on && setPhase(k)}
              className="flex w-full flex-col gap-2 rounded-2xl border-2 p-4 text-left"
              style={{ borderColor: on ? 'var(--accent)' : 'var(--line)', background: on ? 'var(--accent-soft)' : 'var(--surface)' }}
            >
              <span className="flex items-center justify-between gap-2">
                <h3 className="text-lg">
                  {i + 1}. {p.name} <span className="font-sans text-sm font-normal text-muted">· {p.tag}</span>
                </h3>
                {on && <span className="pill">Current</span>}
              </span>
              <span className="text-[0.95rem]">{p.goal}</span>
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                <dt className="text-muted">Dose</dt>
                <dd>{Object.values(p.variants).map((v) => v!.dose).join(' or ')}</dd>
                <dt className="text-muted">How often</dt>
                <dd>{p.freq}</dd>
                <dt className="text-muted">Intensity</dt>
                <dd>{p.intensity}</dd>
                <dt className="text-muted">Volume</dt>
                <dd>{p.volume}</dd>
                <dt className="text-muted">Move on when</dt>
                <dd>{p.advance}</dd>
              </dl>
            </button>
          );
        })}
      </Card>

      <Card title="Rules of thumb">
        <ul className="flex list-disc flex-col gap-2 pl-5">
          <li><b>Pain target:</b> 3/10 or less during rehab, and for 48 hours afterwards. Tendon pain can arrive a day or two late.</li>
          <li><b>Effort:</b> about 7/10, so you could do 2 more reps but not 4. If pain is high, lower the load, not the frequency.</li>
          <li><b>Tempo:</b> 3 seconds down, 3 seconds up, with a weight you control.</li>
          <li><b>Early on:</b> low intensity, high volume, high frequency. Later: higher intensity, lower volume, fewer sessions.</li>
          <li><b>Session:</b> 15 to 25 minutes a day, 3 to 10 exercises, built around your top three painful tests.</li>
        </ul>
      </Card>

      <Card title="Flare-up steps">
        <ul className="flex list-disc flex-col gap-2 pl-5">
          <li>Cut load and session time to about half until pain is 3/10 or less for 48 hours.</li>
          <li>Higher volume, lower intensity. Light rehab is usually better than a day off.</li>
          <li>Heat and massage are fine. Keep the elbow moving.</li>
          <li>A flare is not failure. About 80% of people have at least one, and shorter flares over time are a good sign.</li>
        </ul>
      </Card>

      <Card title="Gym and sport">
        <ul className="flex list-disc flex-col gap-2 pl-5">
          <li>You do not need to be pain-free to train. Rest calms pain but does not fix the tendon.</li>
          <li>Build in this order: session length, then how often, then intensity.</li>
          <li>Start with one short, easy session a week at about 3/10 effort. Keep sessions to an hour or less and avoid back-to-back days at first.</li>
          <li>The 48-hour rule applies. If you feel fine at the time but wake up at 5/10, you did too much.</li>
          <li>Your pain started after a gym session, so go lighter on pulling and gripping work. Anything that loads your painful tests (hammer curls, heavy supinated or gripped work) should wait. See Gym, Train around it.</li>
        </ul>
      </Card>

      <Card title="Other points from the video">
        <ul className="flex list-disc flex-col gap-2 pl-5">
          <li><b>Sleep:</b> pillow under the elbow, bent to 90 degrees. Morning pain is often worse after poor sleep.</li>
          <li><b>Supplements, as claimed in the video:</b> collagen about 20 g a day with vitamin C, enough protein, omega-3. Evidence for these is modest.</li>
          <li><b>Relief in the moment:</b> massage, pin and stretch with a lacrosse ball, scraping, heat.</li>
          <li><b>Timeline:</b> mild 6 to 10 weeks, moderate 10 to 16, chronic 3 to 6 months or more.</li>
          <li><b>Small wins:</b> more confidence with a mug or door, less morning pain, pain changing from sharp to aching, shorter flares.</li>
          <li><b>Travel:</b> a 5 to 10 minute band version keeps momentum.</li>
        </ul>
      </Card>

      <StatusBox tone="none" icon="alert" title="When to get it checked">
        {RED_FLAGS}
      </StatusBox>
      <p className="px-1 text-sm text-muted">{SOURCE_NOTE}</p>
    </div>
  );
}
