'use client';
import { useState } from 'react';

// Reuses the same password-suggestion logic found in AddStudentForm.js
function suggestPassword(fullName) {
  const words = fullName.trim().toUpperCase().split(/\s+/).filter(Boolean);
  if (words.length >= 3) return words[0].slice(0, 3) + words[1].slice(0, 3) + words[words.length - 1].slice(-3);
  if (words.length === 2) return words[0].slice(0, 3) + words[1].slice(0, 3);
  if (words.length === 1) return words[0].slice(0, 6);
  return '';
}

export default function ResetStudentPassword({ studentId, studentName, onClose }) {
  const [newPassword, setNewPassword] = useState(() => suggestPassword(studentName));
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    const res = await fetch('/api/students', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId, newPassword }),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || 'Could not reset password.');
      return;
    }
    setSuccess(`Password updated for ${studentName}.`);
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }} onClick={onClose}>
      <div className="card" style={{ width: '100%', maxWidth: 400, margin: 16 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Reset password for {studentName}</div>
        {error && <div className="error-msg">{error}</div>}
        {success ? (
          <div>
            <div className="notice" style={{ marginBottom: 12 }}>{success}</div>
            <button className="btn btn-navy btn-sm" onClick={onClose}>Close</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label>New password</label>
              <input
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost btn-sm" type="button" onClick={onClose}>Cancel</button>
              <button className="btn btn-gold btn-sm" disabled={loading}>
                {loading ? 'Saving…' : 'Reset password'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
