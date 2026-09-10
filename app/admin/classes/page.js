'use client';
import { useEffect, useState } from 'react';

export default function ClassesAdminPage() {
  const [classes, setClasses] = useState([]);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [removingId, setRemovingId] = useState(null);

  function load() {
    fetch('/api/classes')
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setError(d.error); return; }
        setClasses(d.classes || []);
      })
      .catch(() => setError('Could not load classes.'));
  }
  useEffect(load, []);

  async function add(e) {
    e.preventDefault();
    setError('');
    if (!name.trim()) return;
    setLoading(true);
    const res = await fetch('/api/classes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim() }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error || 'Could not add class.'); return; }
    setName('');
    load();
  }

  async function remove(c) {
    setError('');
    if (!window.confirm(`Delete class "${c.name}"? Timetable entries for it are removed too. This cannot be undone.`)) return;
    setRemovingId(c.id);
    const res = await fetch('/api/classes', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ classId: c.id }),
    });
    const data = await res.json();
    setRemovingId(null);
    if (!res.ok) {
      setError(data.error || 'Could not delete class.');
      return;
    }
    load();
  }

  return (
    <div>
      <div className="page-head"><h2>Classes</h2></div>
      <div className="card" style={{ marginTop: 16 }}>
        {error && <div className="error-msg">{error}</div>}
        <form onSubmit={add} style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. JSS 1A"
            style={{ flex: 1, padding: '9px 12px', border: '1.5px solid var(--line)', borderRadius: 7 }}
          />
          <button className="btn btn-navy btn-sm" disabled={loading}>
            {loading ? 'Adding…' : 'Add class'}
          </button>
        </form>
        {!classes.length ? (
          <div className="empty-note">No classes added yet.</div>
        ) : (
          classes.map((c) => (
            <div className="att-row" key={c.id}>
              <div>{c.name}</div>
              <button
                className="btn btn-ghost btn-sm"
                style={{ color: 'var(--danger)' }}
                disabled={removingId === c.id}
                onClick={() => remove(c)}
              >
                {removingId === c.id ? 'Deleting…' : 'Remove'}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
