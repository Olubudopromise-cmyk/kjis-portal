'use client';
import { useState } from 'react';
import FaceCapture from '../../components/FaceCapture';

const CATEGORIES = ['Science', 'Art', 'Commercial'];

function suggestPassword(fullName) {
  const words = fullName.trim().toUpperCase().split(/\s+/).filter(Boolean);
  if (words.length >= 3) return words[0].slice(0, 3) + words[1].slice(0, 3) + words[words.length - 1].slice(-3);
  if (words.length === 2) return words[0].slice(0, 3) + words[1].slice(0, 3);
  if (words.length === 1) return words[0].slice(0, 6);
  return '';
}

// Teachers register students straight into their own class — the backend
// (POST /api/students) already scopes this to the teacher's class_id, so
// there's no class picker here, unlike the admin version of this form.
export default function AddStudentForm({ onAdded }) {
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [category, setCategory] = useState('');
  const [totalFee, setTotalFee] = useState('');
  const [admissionNo, setAdmissionNo] = useState('');
  const [facePhoto, setFacePhoto] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(''); setSuccess(''); setLoading(true);
    const res = await fetch('/api/students', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName, password, category: category || null, totalFee: totalFee ? Number(totalFee) : 0, admissionNo, facePhotoBase64: facePhoto }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error || 'Could not add student.'); return; }
    setSuccess(`Added ${fullName} to your class.`);
    setFullName(''); setPassword(''); setCategory(''); setTotalFee(''); setAdmissionNo(''); setFacePhoto(null);
    if (onAdded) onAdded();
  }

  return (
    <div className="card">
      <div style={{ fontWeight: 700, marginBottom: 10 }}>Register a student into your class</div>
      {error && <div className="error-msg">{error}</div>}
      {success && <div className="notice">{success}</div>}
      <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="field" style={{ gridColumn: '1 / -1' }}>
          <label>Full name</label>
          <input value={fullName} onChange={(e) => { setFullName(e.target.value); if (!password) setPassword(suggestPassword(e.target.value)); }} required />
        </div>
        <div className="field"><label>Password</label><input value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
        <div className="field"><label>Admission No.</label><input value={admissionNo} onChange={(e) => setAdmissionNo(e.target.value)} /></div>
        <div className="field">
          <label>Category</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">No category</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="field"><label>Term fee (₦)</label><input type="number" min="0" value={totalFee} onChange={(e) => setTotalFee(e.target.value)} /></div>
        <div style={{ gridColumn: '1 / -1' }}>
          <FaceCapture label="Reference photo (optional — enables face verification at login)" onCapture={setFacePhoto} />
        </div>
        <button className="btn btn-gold" style={{ gridColumn: '1 / -1' }} disabled={loading}>{loading ? 'Adding…' : 'Add student to my class'}</button>
      </form>
    </div>
  );
}
