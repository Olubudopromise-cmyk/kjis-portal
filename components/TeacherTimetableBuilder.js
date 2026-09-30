'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { DAYS, ALL_CLASSES_TAG, buildGrid } from '../lib/timetable-grid';

// The teacher's own weekly timetable builder. Scoped to their class by the API —
// this component never receives a class id and cannot ask for another class, so
// there is nothing here to bypass with devtools.
//
// Grid: one row per distinct period_label in the week (rows are emergent, not
// hardcoded), one column per day. A cell holds either:
//   • the teacher's own period  -> editable, deletable
//   • a whole-school event      -> gold, READ-ONLY, no controls at all
//   • nothing                   -> an inline "+" to fill it
export default function TeacherTimetableBuilder({ teacherName, className }) {
  const [entries, setEntries] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editing, setEditing] = useState(null); // {day, period, entry, isNew}
  const [warning, setWarning] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    fetch('/api/timetable')
      .then((r) => r.json())
      .then((d) => setEntries(d.entries || []))
      .catch(() => setEntries([]));
  }, []);
  useEffect(load, [load]);

  const grid = useMemo(() => (entries ? buildGrid(entries) : []), [entries]);

  async function save({ day, entry, isNew, nextPeriod, subject }) {
    setBusy(true);
    setError('');
    // No classId is sent: the API derives the target class from the session, so
    // there is nothing for a tampered request to redirect at another class.
    const payload = {
      dayOfWeek: day,
      periodLabel: nextPeriod,
      subject,
      ...(isNew ? {} : { id: entry.id }),
    };
    const res = await fetch('/api/timetable', {
      method: isNew ? 'POST' : 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    setBusy(false);

    if (res.status === 409 && data.needsConfirmation) {
      setWarning({ ...data, retry: { day, period, entry, isNew, nextPeriod, subject } });
      return;
    }
    if (!res.ok) { setError(data.error || 'Could not save that period.'); return; }

    setEditing(null);
    setWarning(null);
    setNotice(isNew ? 'Period added.' : data.savedOverConflict ? 'Saved — this now overlaps another entry in that slot.' : 'Period updated.');
    load();
  }

  async function remove(id) {
    setBusy(true);
    setError('');
    setNotice('');
    const res = await fetch('/api/timetable', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) { setError(data.error || 'Could not remove that period.'); return; }
    setNotice('Period removed.');
    load();
  }

  if (entries === null) return <div className="card empty-note">Loading your timetable…</div>;

  return (
    <div className="card">
      <div style={{ fontWeight: 700, marginBottom: 2 }}>Weekly timetable{className ? ` — ${className}` : ''}</div>
      <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 12, lineHeight: 1.5 }}>
        Fill in your class&apos;s own periods. Rows appear as you add them, so add as many as
        you need. Whole-school events marked <b>{ALL_CLASSES_TAG}</b> are set by an
        administrator and can&apos;t be edited here.
        {!teacherName && ' You are recorded as the teacher for everything you add.'}
      </div>

      {error && <div className="error-msg" style={{ marginBottom: 10 }}>{error}</div>}
      {notice && <div className="notice" style={{ marginBottom: 10 }}>{notice}</div>}

      {warning && (
        <div role="alert" style={{
          border: '1px solid var(--gold)', background: 'rgba(201,162,39,0.12)',
          borderRadius: 8, padding: 12, marginBottom: 14,
        }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>⚠️ {warning.message}</div>
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
            <button className="btn btn-gold btn-sm" disabled={busy}
              onClick={async () => {
                setBusy(true);
                const r = warning.retry;
                const res = await fetch('/api/timetable', {
                  method: r.isNew ? 'POST' : 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      dayOfWeek: r.day, periodLabel: r.nextPeriod, subject: r.subject,
                      ...(r.isNew ? {} : { id: r.entry.id }),
                      confirmOverwrite: true,
                    }),

                });
                const d = await res.json();
                setBusy(false);
                if (!res.ok) { setError(d.error || 'Could not save that period.'); return; }
                setEditing(null); setWarning(null); setNotice('Saved over the conflict.');
                load();
              }}>Save anyway</button>
          </div>
        </div>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ minWidth: 720 }}>
          <thead>
            <tr>
              <th style={{ width: 130 }}>Period</th>
              {DAYS.map((d) => <th key={d}>{d}</th>)}
            </tr>
          </thead>
          <tbody>
            {grid.map((row) => (
              <tr key={row.period}>
                <td className="mono" style={{ fontSize: 12.5, whiteSpace: 'nowrap' }}>{row.period}</td>
                {DAYS.map((day) => {
                  const cell = row.byDay[day];
                  // Whole-school events are shown but never editable.
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
                  if (cell?.entry) {
                    return (
                      <td key={day}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ flex: 1, minWidth: 0 }}>{cell.entry.subject}</span>
                          <button className="btn btn-ghost btn-sm" title="Edit"
                            onClick={() => { setError(''); setWarning(null); setNotice(''); setEditing({ day, period: row.period, entry: cell.entry, isNew: false }); }}>Edit</button>
                          <button className="btn btn-ghost btn-sm" title="Remove" disabled={busy}
                            onClick={() => remove(cell.entry.id)}>✕</button>
                        </div>
                      </td>
                    );
                  }
                  return (
                    <td key={day}>
                      <button className="btn btn-ghost btn-sm" style={{ width: '100%' }}
                        onClick={() => { setError(''); setWarning(null); setNotice(''); setEditing({ day, period: row.period, entry: null, isNew: true }); }}>+ Add</button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!grid.length && (
        <div className="empty-note" style={{ marginTop: 12 }}>
          No periods yet. Use <b>+ Add</b> in any cell to start, and give the period a time like
          {' '}<span className="mono">8:00 - 8:40</span>. Whole-school events appear here
          automatically.
        </div>
      )}

      {editing && (
        <SlotEditor
          editing={editing}
          busy={busy}
          onCancel={() => setEditing(null)}
          onSave={(day, nextPeriod, subject) =>
            save({ ...editing, day, nextPeriod, subject })}
        />
      )}
    </div>
  );
}

function SlotEditor({ editing, busy, onCancel, onSave }) {
  // An existing row already defines this time-of-day for the week, so the period
  // is pre-filled; only a genuinely new time needs typing.
  const [period, setPeriod] = useState(editing.period || '');
  const [subject, setSubject] = useState(editing.entry?.subject || '');
  const [day, setDay] = useState(editing.day);
  const [err, setErr] = useState('');

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(10,20,40,0.5)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }} onClick={onCancel}>
      <div className="card" style={{ width: '100%', maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>
          {editing.isNew ? 'Add a period' : 'Edit period'} — {editing.day}
        </div>
        {err && <div className="error-msg" style={{ marginBottom: 8 }}>{err}</div>}
        <div className="field">
          <label>Day</label>
          <select value={day} onChange={(e) => setDay(e.target.value)}>
            {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Period (time)</label>
          <input value={period} onChange={(e) => setPeriod(e.target.value)}
            placeholder="8:00 - 8:40" className="mono" />
          <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 4 }}>
            Rows are grouped by this text, so keep it identical across days.
          </div>
        </div>
        <div className="field">
          <label>Subject</label>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Mathematics" />
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel</button>
          <button className="btn btn-gold btn-sm" disabled={busy}
            onClick={() => {
              if (!period.trim()) { setErr('A period time is required.'); return; }
              if (!subject.trim()) { setErr('A subject is required.'); return; }
              onSave(period.trim(), subject.trim());
            }}>{busy ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
}
