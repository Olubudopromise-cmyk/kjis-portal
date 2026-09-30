'use client';
import { useEffect, useState } from 'react';

// One week of timetable, as a stacked table per day. Shared by the student and
// teacher views so both label whole-school events identically.
//
// The merge itself happens server-side in GET /api/timetable: a class-specific
// entry and a whole-school entry (class_id IS NULL) come back in ONE list, so
// neither view has to combine anything itself. A whole-school event is
// identified purely by class_id being null.

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

export const ALL_CLASSES_TAG = '🎓 All Classes';

function periodStart(label) {
  const m = /^\s*(\d{1,2}):(\d{2})\s*(am|pm)?/i.exec(label || '');
  if (!m) return Number.MAX_SAFE_INTEGER; // unparseable labels sort last
  let hours = Number(m[1]);
  const minutes = Number(m[2]);
  const meridiem = (m[3] || '').toLowerCase();
  if (meridiem === 'pm' && hours < 12) hours += 12;
  if (meridiem === 'am' && hours === 12) hours = 0;
  return hours * 60 + minutes;
}

export default function TimetableGrid({ emptyNote = 'No timetable has been set up yet.' }) {
  const [entries, setEntries] = useState(null);

  useEffect(() => {
    fetch('/api/timetable')
      .then((r) => r.json())
      .then((d) => setEntries(d.entries || []))
      .catch(() => setEntries([]));
  }, []);

  if (entries === null) return <div className="card empty-note">Loading…</div>;
  if (!entries.length) return <div className="card empty-note">{emptyNote}</div>;

  return (
    <div className="card">
      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12, lineHeight: 1.5 }}>
        Includes whole-school events marked <b>{ALL_CLASSES_TAG}</b>.
      </div>
      {DAYS.map((day) => {
        const dayEntries = entries
          .filter((e) => e.day_of_week === day)
          // "8:00" must come before "10:00" — the API sorts period_label as
          // text, so re-sort on the parsed time here.
          .sort((a, b) => periodStart(a.period_label) - periodStart(b.period_label)
            || String(a.period_label).localeCompare(String(b.period_label)));
        if (!dayEntries.length) return null;
        return (
          <div key={day} style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>{day}</div>
            <table>
              <thead>
                <tr><th>Period</th><th>Subject</th><th>Teacher</th></tr>
              </thead>
              <tbody>
                {dayEntries.map((e) => {
                  const all = !e.class_id;
                  return (
                    <tr
                      key={e.id}
                      style={all ? { background: 'rgba(201,162,39,0.14)' } : undefined}
                    >
                      <td className="mono">{e.period_label}</td>
                      <td>
                        {all && (
                          <span
                            style={{
                              display: 'inline-block', marginRight: 6, padding: '1px 6px',
                              borderRadius: 10, fontSize: 10.5, fontWeight: 700,
                              background: 'var(--gold)', color: 'var(--navy)',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {ALL_CLASSES_TAG}
                          </span>
                        )}
                        {e.subject}
                      </td>
                      <td>{e.teacher_name || (all ? 'Whole school' : '—')}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
