import { useApp } from '../../ui/app-context';
import { Card, Seg, Toggle } from '../../ui/controls';
import { patchSettings } from '../../db/repo';
import { haptic, beep } from '../../ui/feedback';
import { SOURCE_NOTE } from '../../domain/content';

export default function Settings() {
  const { settings } = useApp();
  return (
    <div className="flex flex-col gap-4">
      <Card title="Rehab">
        <div className="label">Affected elbow</div>
        <Seg label="Affected elbow" options={['Left', 'Right', 'Both'] as const} value={settings.side} onChange={(side) => void patchSettings({ side })} />
        <label className="flex flex-col gap-1">
          <span className="label">Rehab start date</span>
          <input className="field-input" type="date" value={settings.start} onChange={(e) => e.target.value && void patchSettings({ start: e.target.value })} />
        </label>
      </Card>
      <Card title="Guided session">
        <div className="label">Isometric sets</div>
        <Seg label="Isometric sets" options={['3', '4', '5'] as const} value={String(settings.isoSets) as '3'} onChange={(v) => void patchSettings({ isoSets: Number(v) })} />
        <div className="label">Hold length</div>
        <Seg label="Hold length" options={['30', '35', '40', '45'] as const} value={String(settings.holdS) as '30'} onChange={(v) => void patchSettings({ holdS: Number(v) })} />
        <div className="label">Rest between sets</div>
        <Seg label="Rest between sets" options={['30', '45', '60', '90'] as const} value={String(settings.restS) as '30'} onChange={(v) => void patchSettings({ restS: Number(v) })} />
        <Toggle on={settings.sound} onChange={(v) => { void patchSettings({ sound: v }); if (v) beep(true); }}>
          Sound cues (tempo ticks, end of hold)
        </Toggle>
        <Toggle on={settings.haptics} onChange={(v) => { void patchSettings({ haptics: v }); if (v) haptic(true); }}>
          Haptic feedback
        </Toggle>
        <p className="text-sm text-muted">On iPhone, haptics need iOS 18 or later and System Haptics on. Sound follows the ring/silent switch.</p>
      </Card>
      <Card title="Appearance">
        <Seg
          label="Theme"
          options={[
            { v: 'system', label: 'Match phone' },
            { v: 'light', label: 'Light' },
            { v: 'dark', label: 'Dark' },
          ]}
          value={settings.theme}
          onChange={(theme) => void patchSettings({ theme })}
        />
      </Card>
      <Card title="Privacy">
        <p className="text-[0.95rem]">
          No analytics, no trackers, no third-party requests. Fonts and code are bundled. Your data stays in this browser’s storage on this device unless you switch on account sync, which only talks to your own Supabase project.
        </p>
        <p className="text-sm text-muted">{SOURCE_NOTE}</p>
      </Card>
    </div>
  );
}
