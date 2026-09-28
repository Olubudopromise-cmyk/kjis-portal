'use client';
import { useState } from 'react';

export default function TermControl({ initialTerm, initialStartDate }) {
  const [term, setTerm] = useState(initialTerm);
  const [startDate, setStartDate] = useState(initialStartDate || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true); setSaved(false);
    await fetch('/api/settings', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'current_term', value: term }),
    });
    await fetch('/api/settings', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'term_start_date', value: startDate || '' }),
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
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <input value={term} onChange={(e) => { setTerm(e.target.value); setSaved(false); }} style={{ flex: 1, padding: '9px 12px', border: '1.5px solid var(--line)', borderRadius: 7 }} />
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <label style={{ fontSize: 12.5, color: 'var(--muted)', flex: 'none' }}>Term start date</label>
        <input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setSaved(false); }} style={{ flex: 1, padding: '9px 12px', border: '1.5px solid var(--line)', borderRadius: 7 }} />
        <button className="btn btn-navy btn-sm" onClick={save} disabled={saving}>{saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save'}</button>
      </div>
      <p style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 8, marginBottom: 0 }}>
        The start date drives the student "This Week's Focus" card — week 1 begins on this date.
      </p>
    </div>
  );
}
