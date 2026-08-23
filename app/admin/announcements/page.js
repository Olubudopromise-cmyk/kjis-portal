'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function AnnouncementsAdminPage() {
  const [list, setList] = useState([]);
  const [text, setText] = useState('');

  function load() {
    fetch('/api/announcements').then((r) => r.json()).then((d) => setList(d.announcements || []));
  }
  useEffect(load, []);

  async function post(e) {
    e.preventDefault();
    if (!text.trim()) return;
    await fetch('/api/announcements', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: text.trim() }) });
    setText('');
    load();
  }

  return (
    <main>
      <div className="page-head"><h2>Notices</h2></div>
      <Link href="/admin" style={{ fontSize: 13, color: 'var(--navy)' }}>← Back to Admin Desk</Link>
      <div className="card" style={{ marginTop: 16 }}>
        <form onSubmit={post} style={{ marginBottom: 18 }}>
          <div className="field"><input value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a notice for the whole school…" /></div>
          <button className="btn btn-gold">Post notice</button>
        </form>
        {!list.length ? <div className="empty-note">No notices yet.</div> : list.map((a) => (
          <div className="notice" key={a.id}><div>{a.text}</div><div className="meta">{new Date(a.created_at).toLocaleDateString()} · {a.author}</div></div>
        ))}
      </div>
    </main>
  );
}
