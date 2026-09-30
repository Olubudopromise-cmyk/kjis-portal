'use client';
import { useEffect, useState } from 'react';
import { DAYS, ALL_CLASSES_TAG, buildGrid } from '../lib/timetable-grid';

// Read-only weekly timetable: the student's own class merged with every
// whole-school event. No edit controls exist in this file at all, so a student
// cannot render one however they tamper with the response — the editable
// version lives in TeacherTimetableBuilder and is a separate component.
//
// The merge itself happens server-side in GET /api/timetable: class-specific and
// whole-school rows come back in ONE list. A whole-school event is identified
// purely by class_id being null.

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

  const grid = buildGrid(entries);

  return (
    <div className="card">
      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12, lineHeight: 1.5 }}>
        Includes whole-school events marked <b>{ALL_CLASSES_TAG}</b>.
      </div>
      {grid.map((row) => (
        <div key={row.period} style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>{row.period}</div>
          <table>
            <thead>
              <tr><th>Day</th><th>Subject</th><th>Teacher</th></tr>
            </thead>
            <tbody>
              {DAYS.map((day) => {
                const cell = row.byDay[day];
                if (!cell) return null;
                const e = cell.entry;
                return (
                  <tr key={day} style={cell.isAllClasses ? { background: 'rgba(201,162,39,0.14)' } : undefined}>
                    <td>{day}</td>
                    <td>
                      {cell.isAllClasses && (
                        <span style={{
                          display: 'inline-block', marginRight: 6, padding: '1px 6px',
                          borderRadius: 10, fontSize: 10.5, fontWeight: 700,
                          background: 'var(--gold)', color: 'var(--navy)',
                          whiteSpace: 'nowrap',
                        }}>{ALL_CLASSES_TAG}</span>
                      )}
                      {e.subject}
                    </td>
                    <td>{e.teacher_name || (cell.isAllClasses ? 'Whole school' : '—')}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
