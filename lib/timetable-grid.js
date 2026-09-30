// Pure helpers for the weekly timetable grid. No React, no Supabase, no Node
// built-ins — imported by both the read-only student grid and the editable
// teacher builder so the two can never disagree about rows, ordering or what
// counts as a whole-school event.

export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

export const ALL_CLASSES_TAG = '🎓 All Classes';

// Pull the start time out of a period label like "8:00 - 8:40" so rows sort by
// clock time. The DB stores period_label as free text (it may be a real range or
// something non-numeric like "Recess"), so this is deliberately best-effort.
// Returns null when there is no parseable time.
export function parsePeriodStart(label) {
  const m = /^\s*(\d{1,2}):(\d{2})\s*(am|pm)?/i.exec(label || '');
  if (!m) return null;
  let hours = Number(m[1]);
  const minutes = Number(m[2]);
  const meridiem = (m[3] || '').toLowerCase();
  if (meridiem === 'pm' && hours < 12) hours += 12;
  if (meridiem === 'am' && hours === 12) hours = 0;
  return hours * 60 + minutes;
}

// Chronological, with unparseable labels (Recess, Break, …) last but stable.
export function comparePeriods(a, b) {
  const ta = parsePeriodStart(a);
  const tb = parsePeriodStart(b);
  if (ta === null && tb === null) return String(a).localeCompare(String(b));
  if (ta === null) return 1;
  if (tb === null) return -1;
  return ta - tb || String(a).localeCompare(String(b));
}

export function isAllClassesEntry(entry) {
  return !entry?.class_id;
}

// Fold a flat list of entries into rows keyed by period_label, with one cell per
// day. Rows are EMERGENT — nothing is hardcoded, so a teacher can have as many
// periods as they need and a school event with no time (e.g. "Recess") still
// gets its own row at the end.
//
// A row's cell holds the class-specific entry when there is one, otherwise the
// whole-school entry for that slot (which is read-only for teachers).
export function buildGrid(entries) {
  const mine = (entries || []).filter((e) => !isAllClassesEntry(e));
  const all = (entries || []).filter(isAllClassesEntry);

  const periods = [...new Set([...mine, ...all].map((e) => e.period_label))]
    .sort(comparePeriods);

  const mineBySlot = new Map();
  const allBySlot = new Map();
  for (const e of mine) mineBySlot.set(`${e.day_of_week}|${e.period_label}`, e);
  for (const e of all) allBySlot.set(`${e.day_of_week}|${e.period_label}`, e);

  return periods.map((period) => {
    const byDay = {};
    for (const day of DAYS) {
      const key = `${day}|${period}`;
      const own = mineBySlot.get(key) || null;
      byDay[day] = own ? { entry: own, isAllClasses: false } : allBySlot.get(key)
        ? { entry: allBySlot.get(key), isAllClasses: true }
        : null;
    }
    return { period, byDay };
  });
}
