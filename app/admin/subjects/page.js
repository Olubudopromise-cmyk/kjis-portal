'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

const CATEGORIES = ['Science', 'Art', 'Commercial'];

export default function SubjectsAdminPage() {
  const [cat, setCat] = useState('Science');
  const [subjects, setSubjects] = useState({ Science: [], Art: [], Commercial: [] });
  const [name, setName] = useState('');

  function load() {
    fetch('/api/subjects').then((r) => r.json()).then((d) => setSubjects(d.subjects || { Science: [], Art: [], Commercial: [] }));
  }
  useEffect(load, []);

  async function add(e) {
    e.preventDefault();
    if (!name.trim()) return;
    await fetch('/api/subjects', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category: cat, name: name.trim() }),
    });
    setName('');
    load();
  }

  async function remove(id) {
    await fetch('/api/subjects', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    load();
  }

  return (
    <main>
      <div className="page-head"><h2>Categories &amp; Subjects</h2></div>
      <Link href="/admin" style={{ fontSize: 13, color: 'var(--navy)' }}>← Back to Admin Desk</Link>
      <div className="card" style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
          {CATEGORIES.map((c) => (
            <button key={c} className="tab-btn" style={{ border: '1.5px solid var(--line)', borderRadius: 8, borderColor: cat === c ? 'var(--gold)' : 'var(--line)' }} onClick={() => setCat(c)}>
              {c} ({subjects[c]?.length || 0})
            </button>
          ))}
        </div>
        <form onSubmit={add} style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Physics" style={{ flex: 1, padding: '9px 12px', border: '1.5px solid var(--line)', borderRadius: 7 }} />
          <button className="btn btn-navy btn-sm">Add subject</button>
        </form>
        {!subjects[cat]?.length ? <div className="empty-note">No subjects added yet for {cat}.</div> : subjects[cat].map((s) => (
          <div className="att-row" key={s.id}><div>{s.name}</div><button className="btn btn-ghost btn-sm" onClick={() => remove(s.id)}>Remove</button></div>
        ))}
      </div>
    </main>
  );
}
