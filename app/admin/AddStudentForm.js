'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import FaceCapture from '../../components/FaceCapture';

const CATEGORIES = ['Science', 'Art', 'Commercial'];

export default function AddStudentForm({ classes }) {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [classId, setClassId] = useState('');
  const [category, setCategory] = useState('');
  const [totalFee, setTotalFee] = useState('');
  const [admissionNo, setAdmissionNo] = useState('');
  const [faceConsent, setFaceConsent] = useState(false);
  const [facePhoto, setFacePhoto] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // One-time credentials card: shown only in the response to this
  // registration — nothing stores the plaintext, so it can't be reopened.
  const [created, setCreated] = useState(null);
  const [copied, setCopied] = useState(false);

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
        faceConsent, facePhotoBase64: faceConsent ? facePhoto : null,
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error || 'Could not add student.'); return; }
    // Capture the one-time credentials before the form resets. The server only
    // returns `generatedPassword` when it generated one for us — a password the
    // admin typed is never echoed back.
    setCreated({
      fullName: fullName.trim(),
      password: data.generatedPassword || null,
      url: `${window.location.origin}/login`,
    });
    setFullName(''); setPassword(''); setClassId(''); setCategory(''); setTotalFee(''); setAdmissionNo(''); setFaceConsent(false); setFacePhoto(null);
    router.refresh();
  }

  async function copyDetails() {
    const text = [
      'King James International School — student login',
      `URL: ${created.url}`,
      `Name: ${created.fullName}`,
      ...(created.password ? [`Password: ${created.password}`] : []),
    ].join('\n');
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <>
    <div className="card">
      <div style={{ fontWeight: 700, marginBottom: 10 }}>Register a student</div>
      {error && <div className="error-msg">{error}</div>}
      <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="field" style={{ gridColumn: '1 / -1' }}>
          <label>Full name</label>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label>Password (optional)</label>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Leave blank to auto-generate"
            autoComplete="new-password"
          />
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
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, lineHeight: 1.45, marginBottom: 10, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={faceConsent}
              onChange={(e) => {
                setFaceConsent(e.target.checked);
                if (!e.target.checked) setFacePhoto(null);
              }}
              style={{ marginTop: 3 }}
              required
            />
            <span>
              I confirm the parent or guardian has given consent to store this student's photo for face verification (required under Nigeria's NDPR).
            </span>
          </label>
          {faceConsent && (
            <FaceCapture label="Reference photo (optional — enables face verification at login)" onCapture={setFacePhoto} />
          )}
        </div>
        <button className="btn btn-gold" style={{ gridColumn: '1 / -1' }} disabled={loading}>
          {loading ? 'Adding…' : 'Add student'}
        </button>
      </form>
    </div>

    {/* One-time credentials confirmation — rendered only from this response,
        never re-fetchable. Re-sharing means Reset password → new password. */}
    {created && (
      <div
        style={{
          position: 'fixed', inset: 0, background: 'rgba(10, 20, 40, 0.55)',
          zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 16,
        }}
        role="dialog"
        aria-modal="true"
      >
        <div className="card" style={{ width: '100%', maxWidth: 420 }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>✅ Student registered</div>
          <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 14, lineHeight: 1.5 }}>
            Share these details with the parent/student now. They can't be viewed again —
            if they're lost, use <b>Reset password</b> to generate a new one.
          </div>
          <div className="field">
            <label>Login URL</label>
            <input readOnly value={created.url} onFocus={(e) => e.target.select()} />
          </div>
          <div className="field">
            <label>Full name (used to sign in)</label>
            <input readOnly value={created.fullName} onFocus={(e) => e.target.select()} />
          </div>
          <div className="field">
            <label>Password</label>
            <input
              readOnly
              value={created.password || ''}
              onFocus={(e) => e.target.select()}
              style={{ fontFamily: 'monospace', letterSpacing: 0.5 }}
            />
            {!created.password && (
              <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 4 }}>
                You set this password yourself, so it isn't shown here.
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button type="button" className="btn btn-navy" style={{ flex: 1 }} onClick={copyDetails}>
              {copied ? 'Copied!' : 'Copy'}
            </button>
            <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setCreated(null)}>
              Done
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
