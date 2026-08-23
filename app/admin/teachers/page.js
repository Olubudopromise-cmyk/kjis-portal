'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function TeachersAdminPage() {
  const [teachers, setTeachers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [form, setForm] = useState({ fullName: '', username: '', password: '', classId: '' });
  const [error, setError] = useState('');

  function load() {
    fetch('/api/teachers').then((r) => r.json()).then((d) => setTeachers(d.teachers || []));
    fetch('/api/classes').then((r) => r.json()).then((d) => setClasses(d.classes || []));
  }
  useEffect(load, []);

  async function add(e) {
    e.preventDefault();
    setError('');
    const res = await fetch('/api/teachers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    const data = await res.json();
    if (!res.ok) { setError(data.error); return; }
    setForm({ fullName: '', username: '', password: '', classId: '' });
    load();
  }

  async function remove(id) {
    await fetch('/api/teachers', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    load();
  }

  const classNameById = (id) => classes.find((c) => c.id === id)?.name || '—';

  return (
    <main>
      <div className="page-head"><h2>Teachers</h2></div>
      <Link href="/admin" style={{ fontSize: 13, color: 'var(--navy)' }}>← Back to Admin Desk</Link>
      <div className="card" style={{ marginTop: 16, marginBottom: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Add teacher</div>
        {error && <div className="error-msg">{error}</div>}
        <form onSubmit={add} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="field"><label>Full name</label><input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required /></div>
          <div className="field"><label>Username</label><input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required /></div>
          <div className="field"><label>Password</label><input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required /></div>
          <div className="field">
            <label>Assign class</label>
            <select value={form.classId} onChange={(e) => setForm({ ...form, classId: e.target.value })}>
              <option value="">No class yet</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <button className="btn btn-navy" style={{ gridColumn: '1 / -1' }}>Add teacher</button>
        </form>
      </div>
      <div className="card">
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Teachers ({teachers.length})</div>
        {!teachers.length ? <div className="empty-note">No teachers added yet.</div> : (
          <table>
            <thead><tr><th>Name</th><th>Username</th><th>Class</th><th></th></tr></thead>
            <tbody>{teachers.map((t) => (
              <tr key={t.id}><td>{t.full_name}</td><td className="mono">{t.username}</td><td>{classNameById(t.class_id)}</td>
                <td><button className="btn btn-danger btn-sm" onClick={() => remove(t.id)}>Remove</button></td></tr>
            ))}</tbody>
          </table>
        )}
      </div>
    </main>
  );
}
