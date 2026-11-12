// Local calendar dates as YYYY-MM-DD strings. Ported from the prototype.
export const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const pad = (n: number) => String(n).padStart(2, '0');
export const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayStr = () => fmt(new Date());
export const parseD = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const addDays = (s: string, n: number) => {
  const d = parseD(s);
  d.setDate(d.getDate() + n);
  return fmt(d);
};
export const diffDays = (a: string, b: string) => Math.round((parseD(b).getTime() - parseD(a).getTime()) / 864e5);
export const shortDate = (s: string) => {
  const d = parseD(s);
  return `${d.getDate()} ${MON[d.getMonth()]}`;
};
export const longDate = (s: string) => {
  const d = parseD(s);
  return `${DOW[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()}`;
};
export const weekdayDate = (s: string) => {
  const d = parseD(s);
  return `${DOW[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]}`;
};
export const isDate = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
export const nowHM = (d = new Date()) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
/** Monday of the week containing `today`, minus `weeksBack` weeks. */
export function mondayStart(today: string, weeksBack: number) {
  const dow = parseD(today).getDay();
  return addDays(today, -((dow + 6) % 7) - 7 * weeksBack);
}
export function dateRange(start: string, end: string) {
  const out: string[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
  return out;
}
