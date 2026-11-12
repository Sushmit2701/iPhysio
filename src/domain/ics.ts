// Recurring calendar reminders (.ics, RFC 5545). Floating local times so the event
// follows the phone's time zone, with an alert at the event time.
const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

function utcStamp(d: Date) {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/** Fold lines longer than 75 octets (ASCII content assumed). */
function fold(line: string) {
  const out: string[] = [];
  let s = line;
  while (s.length > 75) {
    out.push(s.slice(0, 75));
    s = ' ' + s.slice(75);
  }
  out.push(s);
  return out.join('\r\n');
}

export interface IcsReminder {
  uid: string;
  time: string; // HH:MM
  title: string;
  description: string;
  url?: string;
}

export function buildIcs(reminders: IcsReminder[], startDate: string, now = new Date()): string {
  const day = startDate.replace(/-/g, '');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Elbow Rehab//Reminders//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  for (const r of reminders) {
    const [h, m] = r.time.split(':');
    const start = `${day}T${h}${m}00`;
    const endMin = Number(h) * 60 + Number(m) + 15;
    const end = `${day}T${String(Math.floor(endMin / 60) % 24).padStart(2, '0')}${String(endMin % 60).padStart(2, '0')}00`;
    lines.push(
      'BEGIN:VEVENT',
      `UID:${r.uid}`,
      `DTSTAMP:${utcStamp(now)}`,
      `DTSTART:${start}`,
      `DTEND:${endMin >= 24 * 60 ? start : end}`,
      'RRULE:FREQ=DAILY',
      `SUMMARY:${esc(r.title)}`,
      `DESCRIPTION:${esc(r.description)}`,
      ...(r.url ? [`URL:${r.url}`] : []),
      'TRANSP:TRANSPARENT',
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${esc(r.title)}`,
      'TRIGGER:PT0M',
      'END:VALARM',
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}
