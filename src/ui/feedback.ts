// Haptics, sound and screen wake lock, each a no-op where unsupported.

let hapticLabel: HTMLLabelElement | null = null;
/**
 * Light tap feedback. Android: Vibration API. iPhone (Safari 18+): Safari has no Vibration API,
 * but toggling an <input type=checkbox switch> through its label plays the system haptic,
 * so we keep a hidden one and click it inside the user's tap.
 */
export function haptic(enabled = true, pattern: number | number[] = 10) {
  if (!enabled) return;
  try {
    if (typeof navigator.vibrate === 'function') {
      navigator.vibrate(pattern);
      return;
    }
    if (!hapticLabel) {
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.setAttribute('switch', '');
      input.id = 'haptic-switch';
      input.tabIndex = -1;
      input.setAttribute('aria-hidden', 'true');
      const label = document.createElement('label');
      label.htmlFor = 'haptic-switch';
      label.setAttribute('aria-hidden', 'true');
      const wrap = document.createElement('div');
      wrap.style.cssText = 'position:fixed;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none;left:-10px;top:0';
      wrap.append(input, label);
      document.body.append(wrap);
      hapticLabel = label;
    }
    hapticLabel.click();
  } catch {
    /* ignore */
  }
}

let ctx: AudioContext | null = null;
/** Short sine beep. Must first be called inside a tap on iOS to unlock audio. */
export function beep(enabled: boolean, freq = 880, ms = 120, vol = 0.15) {
  if (!enabled) return;
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx ??= new AC();
    if (ctx.state === 'suspended') void ctx.resume();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = freq;
    o.type = 'sine';
    const t = ctx.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + ms / 1000 + 0.02);
  } catch {
    /* ignore */
  }
}
export const unlockAudio = () => beep(true, 440, 10, 0.0002);

/** Keep the screen awake while mounted; re-acquired when the page becomes visible again. */
export function keepAwake(): () => void {
  let lock: WakeLockSentinel | null = null;
  let active = true;
  const req = async () => {
    try {
      if ('wakeLock' in navigator && document.visibilityState === 'visible') lock = await navigator.wakeLock.request('screen');
    } catch {
      /* not allowed or unsupported */
    }
  };
  const onVis = () => active && document.visibilityState === 'visible' && void req();
  void req();
  document.addEventListener('visibilitychange', onVis);
  return () => {
    active = false;
    document.removeEventListener('visibilitychange', onVis);
    void lock?.release().catch(() => {});
  };
}
