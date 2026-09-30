'use client';
import { useEffect, useState } from 'react';
import { STREAM_CATEGORIES, JUNIOR_CATEGORY, ALL_CATEGORIES } from '../../../lib/subjects';

const EMPTY = Object.fromEntries(ALL_CATEGORIES.map((c) => [c, []]));

// Junior (JSS) students don't stream, so their subject list is one flat list
// rather than Science/Art/Commercial. Senior students keep the existing
// per-stream tabs, unchanged.
export default function SubjectsAdminPage() {
  const [level, setLevel] = useState('senior'); // 'junior' | 'senior'
  const [cat, setCat] = useState(STREAM_CATEGORIES[0]);
  const [subjects, setSubjects] = useState(EMPTY);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // The category this form will write to.
  const activeCategory = level === 'junior' ? JUNIOR_CATEGORY : cat;

  function load() {
    fetch('/api/subjects')
      .then((r) => r.json())
      .then((d) => setSubjects({ ...EMPTY, ...(d.subjects || {}) }))
      .catch(() => setSubjects(EMPTY));
  }
  useEffect(load, []);

  async function add(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setError('');
    setNotice('');
    const res = await fetch('/api/subjects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category: activeCategory, name: name.trim() }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || 'Could not add that subject.');
      return;
    }
    setName('');
    setNotice(`Added to ${activeCategory === JUNIOR_CATEGORY ? 'Junior (JSS)' : activeCategory}.`);
    load();
  }

  async function remove(id) {
    setError('');
    await fetch('/api/subjects', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    load();
  }

  const list = subjects[activeCategory] || [];
  const totalJunior = subjects[JUNIOR_CATEGORY]?.length || 0;

  return (
    <div>
      <div className="page-head"><h2>Categories &amp; Subjects</h2></div>
      <div className="card" style={{ marginTop: 16 }}>

        {/* Level switch */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
          <button
            type="button"
            className="tab-btn"
            style={{ border: '1.5px solid', borderRadius: 8, borderColor: level === 'junior' ? 'var(--gold)' : 'var(--line)' }}
            onClick={() => { setLevel('junior'); setError(''); setNotice(''); }}
          >
            🎒 Junior (JSS) ({totalJunior})
          </button>
          <button
            type="button"
            className="tab-btn"
            style={{ border: '1.5px solid', borderRadius: 8, borderColor: level === 'senior' ? 'var(--gold)' : 'var(--line)' }}
            onClick={() => { setLevel('senior'); setError(''); setNotice(''); }}
          >
            🎓 Senior (SS)
          </button>
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 18, lineHeight: 1.5 }}>
          {level === 'junior'
            ? 'Junior classes do not stream, so all JSS students share one subject list.'
            : 'Senior classes stream. Each stream gets its own subject list.'}
        </div>

        {/* Stream sub-tabs — senior only */}
        {level === 'senior' && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
            {STREAM_CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                className="tab-btn"
                style={{ border: '1.5px solid', borderRadius: 8, borderColor: cat === c ? 'var(--gold)' : 'var(--line)' }}
                onClick={() => setCat(c)}
              >
                {c} ({subjects[c]?.length || 0})
              </button>
            ))}
          </div>
        )}

        <form onSubmit={add} style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={level === 'junior' ? 'e.g. Basic Science' : 'e.g. Physics'}
            style={{ flex: 1, padding: '9px 12px', border: '1.5px solid var(--line)', borderRadius: 7 }}
          />
          <button className="btn btn-navy btn-sm">Add subject</button>
        </form>

        {error && <div className="error-msg" style={{ marginBottom: 12 }}>{error}</div>}
        {notice && <div className="notice" style={{ marginBottom: 12 }}>{notice}</div>}

        {!list.length ? (
          <div className="empty-note">
            {level === 'junior'
              ? 'No junior subjects added yet. These are the subjects every JSS student gets.'
              : `No subjects added yet for ${cat}.`}
          </div>
        ) : (
          list.map((s) => (
            <div className="att-row" key={s.id}>
              <div>{s.name}</div>
              <button className="btn btn-ghost btn-sm" onClick={() => remove(s.id)}>Remove</button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
