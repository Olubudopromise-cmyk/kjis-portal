'use client';
import { useEffect, useState } from 'react';
import { DAYS, ALL_CLASSES_TAG, buildGrid, comparePeriods } from '../../../lib/timetable-grid';

const ALL_CLASSES = 'all';

const EMPTY = { dayOfWeek: 'Monday', periodLabel: '', subject: '' };

// Admins own WHOLE-SCHOOL entries only. Per-class schedules are built by each
// class's teacher, so this page offers a read-only view of any class for
// oversight and edit controls exclusively for All Classes.
export default function TimetableAdminPage() {
  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState(ALL_CLASSES);
  const [entries, setEntries] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  // Conflicts are a soft warning: the first submit comes back 409 with this list
  // and only a confirm re-submits.
  const [warning, setWarning] = useState(null);
  const [savedNote, setSavedNote] = useState('');
  const [busy, setBusy] = useState(false);

  const isAllClasses = classId === ALL_CLASSES;

  useEffect(() => {
    fetch('/api/classes').then((r) => r.json()).then((d) => setClasses(d.classes || []));
  }, []);

  useEffect(() => {
    setWarning(null);
    setSavedNote('');
    setError('');
    const qs = classId === ALL_CLASSES ? '?classId=all' : `?classId=${classId}`;
    fetch(`/api/timetable${qs}`).then((r) => r.json()).then((d) => setEntries(d.entries || []));
  }, [classId]);

  async function save(confirmOverwrite) {
    setBusy(true);
    setError('');
    if (!confirmOverwrite) setWarning(null);
    const res = await fetch('/api/timetable', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ classId: ALL_CLASSES, ...form, confirmOverwrite: confirmOverwrite === true }),
    });
    const data = await res.json();
    setBusy(false);
    if (res.status === 409 && data.needsConfirmation) { setWarning(data); return; }
    if (!res.ok) { setError(data.error || 'Could not add entry.'); return; }
    setWarning(null);
    setSavedNote(data.savedOverConflict ? 'Saved — note this now overlaps other entries in that slot.' : '');
    setForm(EMPTY);
    reload();
  }

  function reload() {
    const qs = classId === ALL_CLASSES ? '?classId=all' : `?classId=${classId}`;
    fetch(`/api/timetable${qs}`).then((r) => r.json()).then((d) => setEntries(d.entries || []));
  }

  async function remove(id) {
    setError('');
    await fetch('/api/timetable', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    reload();
  }

  const allClassEntries = entries.filter((e) => !e.class_id).sort((a, b) =>
    DAYS.indexOf(a.day_of_week) - DAYS.indexOf(b.day_of_week) || comparePeriods(a.period_label, b.period_label));
  const grid = buildGrid(entries);
  const className = classes.find((c) => c.id === classId)?.name || '';

  return (
    <div>
      <div className="page-head"><h2>Timetable</h2></div>
      <div className="card" style={{ marginTop: 16 }}>
        <div className="field">
          <label>View</label>
          <select value={classId} onChange={(e) => setClassId(e.target.value)}>
            <option value={ALL_CLASSES}>🎓 All Classes (whole-school)</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 4 }}>
            {isAllClasses
              ? 'Whole-school events — assembly, fellowship, prayers. Added once, shown to every student and teacher.'
              : 'Read-only. Each class teacher builds their own weekly schedule.'}
          </div>
        </div>

        {isAllClasses ? (
          <>
            <form onSubmit={(e) => {
              e.preventDefault();
              if (!form.periodLabel.trim() || !form.subject.trim()) {
                setError('A period and label are required.');
                return;
              }
              setError('');
              save(false);
            }}
              style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr) auto', gap: 8, alignItems: 'end', marginBottom: 18 }}>
              <div className="field" style={{ margin: 0 }}>
                <label>Day</label>
                <select value={form.dayOfWeek} onChange={(e) => setForm({ ...form, dayOfWeek: e.target.value })}>
                  {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="field" style={{ margin: 0 }}>
                <label>Period</label>
                <input value={form.periodLabel} onChange={(e) => setForm({ ...form, periodLabel: e.target.value })} placeholder="8:00 - 8:40" />
              </div>
              <div className="field" style={{ margin: 0 }}>
                <label>Label</label>
                <input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Assembly" />
              </div>
              <button className="btn btn-navy btn-sm" disabled={busy}>{busy ? 'Saving…' : 'Add'}</button>
            </form>

            {error && <div className="error-msg" style={{ marginBottom: 12 }}>{error}</div>}
            {savedNote && <div className="notice" style={{ marginBottom: 12 }}>{savedNote}</div>}

            {warning && (
              <div role="alert" style={{
                border: '1px solid var(--gold)', background: 'rgba(201,162,39,0.12)',
                borderRadius: 8, padding: 12, marginBottom: 14,
              }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>⚠️ {warning.message}</div>
                <div style={{ fontSize: 12.5, marginBottom: 10, lineHeight: 1.5 }}>
                  Whole-school events shouldn&apos;t normally sit on top of a scheduled lesson.
                  Check this is intended:
                </div>
                <ul style={{ margin: '0 0 10px', paddingLeft: 18, fontSize: 12.5 }}>
                  {warning.conflicts.map((c) => (
                    <li key={c.id}>
                      <b>{c.isAllClasses ? ALL_CLASSES_TAG : c.scope}</b> — {c.label}
                      {c.teacher ? ` (${c.teacher})` : ''}
                    </li>
                  ))}
                </ul>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => setWarning(null)}>Cancel</button>
                  <button className="btn btn-gold btn-sm" onClick={() => save(true)} disabled={busy}>
                    {busy ? 'Saving…' : 'Save anyway'}
                  </button>
                </div>
              </div>
            )}

            <div style={{ fontWeight: 700, marginBottom: 6 }}>
              Whole-school events ({allClassEntries.length})
            </div>
            {!allClassEntries.length ? (
              <div className="empty-note">No whole-school events yet.</div>
            ) : (
              <table>
                <thead><tr><th>Day</th><th>Period</th><th>Label</th><th></th></tr></thead>
                <tbody>{allClassEntries.map((e) => (
                  <tr key={e.id}>
                    <td>{e.day_of_week}</td>
                    <td className="mono">{e.period_label}</td>
                    <td>{e.subject}</td>
                    <td><button className="btn btn-ghost btn-sm" onClick={() => remove(e.id)}>Remove</button></td>
                  </tr>
                ))}</tbody>
              </table>
            )}
          </>
        ) : (
          <>
            <div className="notice" style={{ marginBottom: 14 }}>
              <b>{className}</b> is scheduled by its class teacher — this view is read-only.
              {grid.length ? '' : ' Nothing has been entered yet.'}
            </div>
            {grid.length && (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ minWidth: 720 }}>
                  <thead>
                    <tr><th style={{ width: 130 }}>Period</th>{DAYS.map((d) => <th key={d}>{d}</th>)}</tr>
                  </thead>
                  <tbody>
                    {grid.map((row) => (
                      <tr key={row.period}>
                        <td className="mono" style={{ fontSize: 12.5, whiteSpace: 'nowrap' }}>{row.period}</td>
                        {DAYS.map((day) => {
                          const cell = row.byDay[day];
                          if (cell?.isAllClasses) {
                            return (
                              <td key={day} style={{ background: 'rgba(201,162,39,0.14)' }}>
                                <span style={{
                                  display: 'inline-block', padding: '1px 6px', borderRadius: 10,
                                  fontSize: 10.5, fontWeight: 700, background: 'var(--gold)',
                                  color: 'var(--navy)', whiteSpace: 'nowrap',
                                }}>{ALL_CLASSES_TAG}</span>{' '}
                                {cell.entry.subject}
                              </td>
                            );
                          }
                          return (
                            <td key={day}>
                              {cell?.entry ? (
                                <>
                                  {cell.entry.subject}
                                  {cell.entry.teacher_name && (
                                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>{cell.entry.teacher_name}</div>
                                  )}
                                </>
                              ) : <span style={{ color: 'var(--muted)' }}>—</span>}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
