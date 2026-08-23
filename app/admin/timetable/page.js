'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

export default function TimetableAdminPage() {
  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState('');
  const [entries, setEntries] = useState([]);
  const [form, setForm] = useState({ dayOfWeek: 'Monday', periodLabel: '', subject: '', teacherName: '' });

  useEffect(() => {
    fetch('/api/classes').then((r) => r.json()).then((d) => {
      setClasses(d.classes || []);
      if (d.classes?.length) setClassId(d.classes[0].id);
    });
  }, []);

  function load(cid) {
    if (!cid) return;
    fetch(`/api/timetable?classId=${cid}`).then((r) => r.json()).then((d) => setEntries(d.entries || []));
  }
  useEffect(() => load(classId), [classId]);

  async function add(e) {
    e.preventDefault();
    if (!classId || !form.periodLabel || !form.subject) return;
    await fetch('/api/timetable', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ classId, ...form }) });
    setForm({ ...form, periodLabel: '', subject: '', teacherName: '' });
    load(classId);
  }

  async function remove(id) {
    await fetch('/api/timetable', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    load(classId);
  }

  return (
    <main>
      <div className="page-head"><h2>Timetable</h2></div>
      <Link href="/admin" style={{ fontSize: 13, color: 'var(--navy)' }}>← Back to Admin Desk</Link>
      <div className="card" style={{ marginTop: 16 }}>
        <div className="field">
          <label>Class</label>
          <select value={classId} onChange={(e) => setClassId(e.target.value)}>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <form onSubmit={add} style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr) auto', gap: 8, alignItems: 'end', marginBottom: 18 }}>
          <div className="field" style={{ margin: 0 }}>
            <label>Day</label>
            <select value={form.dayOfWeek} onChange={(e) => setForm({ ...form, dayOfWeek: e.target.value })}>
              {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div className="field" style={{ margin: 0 }}><label>Period</label><input value={form.periodLabel} onChange={(e) => setForm({ ...form, periodLabel: e.target.value })} placeholder="8:00 - 8:40" /></div>
          <div className="field" style={{ margin: 0 }}><label>Subject</label><input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Physics" /></div>
          <div className="field" style={{ margin: 0 }}><label>Teacher</label><input value={form.teacherName} onChange={(e) => setForm({ ...form, teacherName: e.target.value })} placeholder="Optional" /></div>
          <button className="btn btn-navy btn-sm">Add</button>
        </form>
        {!entries.length ? <div className="empty-note">No timetable entries for this class yet.</div> : (
          <table>
            <thead><tr><th>Day</th><th>Period</th><th>Subject</th><th>Teacher</th><th></th></tr></thead>
            <tbody>{entries.map((e) => (
              <tr key={e.id}><td>{e.day_of_week}</td><td className="mono">{e.period_label}</td><td>{e.subject}</td><td>{e.teacher_name || '—'}</td>
                <td><button className="btn btn-ghost btn-sm" onClick={() => remove(e.id)}>Remove</button></td></tr>
            ))}</tbody>
          </table>
        )}
      </div>
    </main>
  );
}
