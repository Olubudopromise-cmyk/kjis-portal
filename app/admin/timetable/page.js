'use client';
import { useEffect, useState } from 'react';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const ALL_CLASSES = 'all';

const EMPTY = { dayOfWeek: 'Monday', periodLabel: '', subject: '', teacherName: '' };

export default function TimetableAdminPage() {
  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState('');
  const [entries, setEntries] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  // Conflicts are a soft warning: the first submit comes back 409 with this
  // list, the admin is shown what overlaps, and only a confirm re-submits.
  const [warning, setWarning] = useState(null);
  const [savedNote, setSavedNote] = useState('');
  const [busy, setBusy] = useState(false);

  const isAllClasses = classId === ALL_CLASSES;

  useEffect(() => {
    fetch('/api/classes').then((r) => r.json()).then((d) => setClasses(d.classes || []));
  }, []);

  function load(cid) {
    setWarning(null);
    setSavedNote('');
    if (!cid) { setEntries([]); return; }
    const qs = cid === ALL_CLASSES ? '?classId=' + ALL_CLASSES : `?classId=${cid}`;
    fetch(`/api/timetable${qs}`).then((r) => r.json()).then((d) => setEntries(d.entries || []));
  }
  useEffect(() => load(classId), [classId]);

  async function save(confirmOverwrite) {
    setBusy(true);
    setError('');
    if (!confirmOverwrite) setWarning(null);

    const res = await fetch('/api/timetable', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ classId, ...form, confirmOverwrite: confirmOverwrite === true }),
    });
    const data = await res.json();
    setBusy(false);

    if (res.status === 409 && data.needsConfirmation) {
      setWarning(data);
      return;
    }
    if (!res.ok) { setError(data.error || 'Could not add entry.'); return; }

    setWarning(null);
    setSavedNote(
      data.savedOverConflict
        ? 'Saved — note this now overlaps the other entry in that slot.'
        : ''
    );
    setForm(EMPTY);
    load(classId);
  }

  async function add(e) {
    e.preventDefault();
    if (!classId || !form.periodLabel.trim() || !form.subject.trim()) {
      setError(isAllClasses
        ? 'A period and label are required.'
        : 'A period and subject are required.');
      return;
    }
    await save(false);
  }

  async function remove(id) {
    setError('');
    await fetch('/api/timetable', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    load(classId);
  }

  return (
    <div>
      <div className="page-head"><h2>Timetable</h2></div>
      <div className="card" style={{ marginTop: 16 }}>
        <div className="field">
          <label>Class</label>
          <select value={classId} onChange={(e) => setClassId(e.target.value)}>
            <option value={ALL_CLASSES}>🎓 All Classes (whole-school)</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 4 }}>
            {isAllClasses
              ? 'Whole-school events — assembly, fellowship, prayers. Added once, shown to every student and teacher.'
              : `This class's own periods, plus any whole-school events. Entries marked 🎓 apply to everyone.`}
          </div>
        </div>

        <form onSubmit={add} style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr) auto', gap: 8, alignItems: 'end', marginBottom: 18 }}>
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
            {/* Whole-school events have no subject/teacher pairing — just a label. */}
            <label>{isAllClasses ? 'Label' : 'Subject'}</label>
            <input
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              placeholder={isAllClasses ? 'Assembly' : 'Physics'}
            />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label>Teacher</label>
            {isAllClasses ? (
              <input value="" disabled placeholder="Not applicable" />
            ) : (
              <input value={form.teacherName} onChange={(e) => setForm({ ...form, teacherName: e.target.value })} placeholder="Optional" />
            )}
          </div>
          <button className="btn btn-navy btn-sm" disabled={busy}>
            {busy ? 'Saving…' : 'Add'}
          </button>
        </form>

        {error && <div className="error-msg" style={{ marginBottom: 12 }}>{error}</div>}
        {savedNote && <div className="notice" style={{ marginBottom: 12 }}>{savedNote}</div>}

        {warning && (
          <div
            role="alert"
            style={{
              border: '1px solid var(--gold, #d4a017)', background: 'rgba(212,160,23,0.12)',
              borderRadius: 8, padding: 12, marginBottom: 14,
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 6 }}>⚠️ {warning.message}</div>
            <div style={{ fontSize: 12.5, marginBottom: 10, lineHeight: 1.5 }}>
              Whole-school events shouldn&apos;t normally sit on top of a scheduled lesson.
              Check this is intended:
            </div>
            <ul style={{ margin: '0 0 10px', paddingLeft: 18, fontSize: 12.5 }}>
              {warning.conflicts.map((c) => (
                <li key={c.id}>
                  <b>{c.isAllClasses ? '🎓 All Classes' : c.scope}</b> — {c.label}
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

        {!entries.length ? (
          <div className="empty-note">
            {isAllClasses ? 'No whole-school events yet.' : 'No timetable entries for this class yet.'}
          </div>
        ) : (
          <table>
            <thead><tr><th>Applies to</th><th>Day</th><th>Period</th><th>{isAllClasses ? 'Label' : 'Subject'}</th><th>Teacher</th><th></th></tr></thead>
            <tbody>{entries.map((e) => {
              const all = !e.class_id;
              return (
                <tr key={e.id}>
                  <td style={{ color: all ? 'var(--gold, #d4a017)' : 'inherit', fontWeight: all ? 700 : 400 }}>
                    {all ? '🎓 All Classes' : (classes.find((c) => c.id === e.class_id)?.name || e.class_id)}
                  </td>
                  <td>{e.day_of_week}</td>
                  <td className="mono">{e.period_label}</td>
                  <td>{e.subject}</td>
                  <td>{e.teacher_name || '—'}</td>
                  <td><button className="btn btn-ghost btn-sm" onClick={() => remove(e.id)}>Remove</button></td>
                </tr>
              );
            })}</tbody>
          </table>
        )}
      </div>
    </div>
  );
}
