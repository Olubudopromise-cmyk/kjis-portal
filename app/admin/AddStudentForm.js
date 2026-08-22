'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

const CATEGORIES = ['Science', 'Art', 'Commercial'];

// Generates a password suggestion the same way the prototype did:
// first 3 letters of the first two names + last 3 of the final name.
function suggestPassword(fullName) {
  const words = fullName.trim().toUpperCase().split(/\s+/).filter(Boolean);
  if (words.length >= 3) return words[0].slice(0, 3) + words[1].slice(0, 3) + words[words.length - 1].slice(-3);
  if (words.length === 2) return words[0].slice(0, 3) + words[1].slice(0, 3);
  if (words.length === 1) return words[0].slice(0, 6);
  return '';
}

export default function AddStudentForm({ classes }) {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [classId, setClassId] = useState('');
  const [category, setCategory] = useState('');
  const [totalFee, setTotalFee] = useState('');
  const [admissionNo, setAdmissionNo] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const res = await fetch('/api/students', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName, password, classId: classId || null, category: category || null,
        totalFee: totalFee ? Number(totalFee) : 0, admissionNo,
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error || 'Could not add student.'); return; }
    setFullName(''); setPassword(''); setClassId(''); setCategory(''); setTotalFee(''); setAdmissionNo('');
    router.refresh();
  }

  return (
    <div className="card">
      <div style={{ fontWeight: 700, marginBottom: 10 }}>Register a student</div>
      {error && <div className="error-msg">{error}</div>}
      <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="field" style={{ gridColumn: '1 / -1' }}>
          <label>Full name</label>
          <input
            value={fullName}
            onChange={(e) => {
              setFullName(e.target.value);
              if (!password) setPassword(suggestPassword(e.target.value));
            }}
            required
          />
        </div>
        <div className="field">
          <label>Password</label>
          <input value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <div className="field">
          <label>Admission No.</label>
          <input value={admissionNo} onChange={(e) => setAdmissionNo(e.target.value)} />
        </div>
        <div className="field">
          <label>Class</label>
          <select value={classId} onChange={(e) => setClassId(e.target.value)}>
            <option value="">Select class</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Category</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">No category</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Term fee (₦)</label>
          <input type="number" min="0" value={totalFee} onChange={(e) => setTotalFee(e.target.value)} />
        </div>
        <button className="btn btn-gold" style={{ gridColumn: '1 / -1' }} disabled={loading}>
          {loading ? 'Adding…' : 'Add student'}
        </button>
      </form>
    </div>
  );
}
