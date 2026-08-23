'use client';
import { useState } from 'react';

export default function TermControl({ initialTerm }) {
  const [term, setTerm] = useState(initialTerm);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true); setSaved(false);
    await fetch('/api/settings', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'current_term', value: term }),
    });
    setSaving(false); setSaved(true);
  }

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div style={{ fontWeight: 700, marginBottom: 8 }}>Current term</div>
      <p style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 0, marginBottom: 10 }}>
        New results teachers enter get tagged with this term. Change it once at the start of a new term —
        students will still be able to look back at past terms on their report card.
      </p>
      <div style={{ display: 'flex', gap: 8 }}>
        <input value={term} onChange={(e) => { setTerm(e.target.value); setSaved(false); }} style={{ flex: 1, padding: '9px 12px', border: '1.5px solid var(--line)', borderRadius: 7 }} />
        <button className="btn btn-navy btn-sm" onClick={save} disabled={saving}>{saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save'}</button>
      </div>
    </div>
  );
}
