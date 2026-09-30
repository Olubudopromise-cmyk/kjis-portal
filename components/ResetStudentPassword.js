'use client';
import { useState } from 'react';

// School policy is that a student's password is their Admission No., so that's
// the default here. A custom password is available for the cases where the
// admission number genuinely can't be used (or the admin wants to change it
// temporarily), but the reset-to-default path is one click.
export default function ResetStudentPassword({ studentId, studentName, admissionNo, onClose }) {
  const [mode, setMode] = useState('admission');
  const [newPassword, setNewPassword] = useState('');
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
      // `useAdmissionNo` asks the server to read the admission number off the
      // student's own record rather than trusting a value sent from the browser.
      body: JSON.stringify(
        mode === 'admission'
          ? { studentId, useAdmissionNo: true }
          : { studentId, newPassword }
      ),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || 'Could not reset password.');
      return;
    }
    setSuccess(
      mode === 'admission'
        ? `Password for ${studentName} is now their Admission No.${admissionNo ? ` (${admissionNo})` : ''}.`
        : `Custom password set for ${studentName}. Remember to tell them — it can't be viewed again.`
    );
  }

  const optionStyle = (value) => ({
    display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13,
    lineHeight: 1.45, marginBottom: 8, cursor: 'pointer',
  });

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
            <label style={optionStyle('admission')}>
              <input
                type="radio"
                name="reset-mode"
                checked={mode === 'admission'}
                onChange={() => setMode('admission')}
                style={{ marginTop: 2 }}
              />
              <span>
                Reset to their Admission No.
                <br />
                <span style={{ color: 'var(--muted)', fontSize: 12 }}>
                  {admissionNo
                    ? <>Password becomes <b>{admissionNo}</b> — the normal school setup.</>
                    : <>No admission number on file. Set a custom password instead.</>}
                </span>
              </span>
            </label>
            <label style={optionStyle('custom')}>
              <input
                type="radio"
                name="reset-mode"
                checked={mode === 'custom'}
                onChange={() => setMode('custom')}
                style={{ marginTop: 2 }}
              />
              <span>Set a custom password instead</span>
            </label>
            {mode === 'custom' && (
              <div className="field">
                <label>New password</label>
                <input
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={4}
                  autoComplete="new-password"
                />
                <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 4 }}>
                  At least 4 characters. This one is not stored anywhere readable, so it can only
                  be seen here.
                </div>
              </div>
            )}
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
