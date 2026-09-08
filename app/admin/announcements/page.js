'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

const EXPIRY_OPTIONS = [
  { value: 'never', label: 'Never expire' },
  { value: '24h', label: '24 hours' },
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: 'this_term', label: 'This term' },
];

function expiryISO(option, postedAt = new Date()) {
  if (option === 'never') return null;
  const d = new Date(postedAt);
  if (option === '24h') d.setHours(d.getHours() + 24);
  else if (option === '7d') d.setDate(d.getDate() + 7);
  else if (option === '30d') d.setDate(d.getDate() + 30);
  else if (option === 'this_term') d.setMonth(d.getMonth() + 4);
  return d.toISOString();
}

export default function AnnouncementsAdminPage() {
  const [list, setList] = useState([]);
  const [text, setText] = useState('');
  const [expiry, setExpiry] = useState('never');
  const [editing, setEditing] = useState(null);

  function load() {
    fetch('/api/announcements').then((r) => r.json()).then((d) => setList(d.announcements || []));
  }
  useEffect(load, []);

  async function post(e) {
    e.preventDefault();
    if (!text.trim()) return;
    const expiresAt = expiryISO(expiry);
    await fetch('/api/announcements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text.trim(), expiresAt }),
    });
    setText('');
    load();
  }

  async function del(id) {
    if (!window.confirm('Delete this notice? This can\'t be undone.')) return;
    await fetch('/api/announcements', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    if (editing?.id === id) setEditing(null);
    load();
  }

  async function saveEdit(e) {
    e.preventDefault();
    if (!editing || !editing.text.trim()) return;
    const expiresAt = expiryISO(expiry, editing.postedAt);
    await fetch('/api/announcements', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: editing.id, text: editing.text.trim(), expiresAt }),
    });
    setEditing(null);
    load();
  }

  function startEdit(a) {
    setEditing({ id: a.id, text: a.text, postedAt: new Date(a.created_at || a.created_at) });
  }

  function cancelEdit() {
    setEditing(null);
  }

  return (
    <main>
      <div className="page-head"><h2>Notices</h2></div>
      <Link href="/admin" style={{ fontSize: 13, color: 'var(--navy)' }}>← Back to Admin Desk</Link>
      <div className="card" style={{ marginTop: 16 }}>
        <form onSubmit={post} style={{ marginBottom: 18 }}>
          <div className="field"><input value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a notice for the whole school…" /></div>
          <div className="field" style={{ marginBottom: 10 }}>
            <label>Expires</label>
            <select value={expiry} onChange={(e) => setExpiry(e.target.value)} style={{ padding: '9px 12px', border: '1.5px solid var(--line)', borderRadius: 7, width: '100%' }}>
              {EXPIRY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <button className="btn btn-gold">Post notice</button>
        </form>

        {editing ? (
          <form onSubmit={saveEdit} style={{ marginBottom: 18 }}>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>Edit notice</div>
            <div className="field">
              <label>Text</label>
              <textarea value={editing.text} onChange={(e) => setEditing({ ...editing, text: e.target.value })} rows={3} style={{ width: '100%', padding: '9px 12px', border: '1.5px solid var(--line)', borderRadius: 7 }} />
            </div>
            <div className="field" style={{ marginBottom: 10 }}>
              <label>Expires</label>
              <select value={expiry} onChange={(e) => setExpiry(e.target.value)} style={{ padding: '9px 12px', border: '1.5px solid var(--line)', borderRadius: 7, width: '100%' }}>
                {EXPIRY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-navy">Save</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={cancelEdit}>Cancel</button>
            </div>
          </form>
        ) : null}

        {!list.length ? <div className="empty-note">No notices yet.</div> : list.map((a) => (
          <div className="notice" key={a.id}>
            {editing?.id === a.id ? null : (
              <div>
                <div className="edit-btn-row">
                  <div>{a.text}</div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => startEdit(a)}>Edit</button>
                    <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => del(a.id)}>Delete</button>
                  </div>
                </div>
              </div>
            )}
            <div className="meta">{new Date(a.created_at).toLocaleDateString()} · {a.author}</div>
          </div>
        ))}
      </div>
    </main>
  );
}
