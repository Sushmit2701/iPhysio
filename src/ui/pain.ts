/** Green-to-red ramp, used only for pain values. Lightness chosen for 4.5:1 with white text. */
export function painColor(v: number, dark = false) {
  const h = Math.round(135 - 13.5 * Math.max(0, Math.min(10, v)));
  return dark ? `hsl(${h} 58% 34%)` : `hsl(${h} 62% 30%)`;
}
export function painWord(v: number) {
  if (v === 0) return 'none';
  if (v <= 3) return 'within target';
  if (v <= 5) return 'slightly above target';
  return 'above target';
}
