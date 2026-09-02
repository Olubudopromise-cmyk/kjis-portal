'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const ROLES = ['student', 'teacher', 'admin'];
const ROLE_LABEL = { student: 'Student', teacher: 'Teacher', admin: 'Head Admin' };

export default function LoginPage() {
  const router = useRouter();
  const [role, setRole] = useState('student');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMessage, setForgotMessage] = useState('');
  const [showForgot, setShowForgot] = useState(false);

  async function handleForgot(e) {
    e.preventDefault();
    setForgotMessage('');
    setForgotLoading(true);
    const res = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: forgotEmail }),
    });
    const data = await res.json();
    setForgotLoading(false);
    setForgotMessage(data.message || 'If that email is registered, you\'ll receive a reset link shortly.');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role, identifier, password }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || 'Login failed.');
      return;
    }
    if (data.pendingFaceCheck) {
      sessionStorage.setItem('kjis_face_token', data.faceToken);
      sessionStorage.setItem('kjis_face_name', data.name || '');
      router.push('/login/face-verify');
      return;
    }
    router.push('/' + role);
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-side">
          <div>
            <div className="crest">KJ</div>
            <h1>King James
              <br />
              International School
            </h1>
            <p>Sign in to your desk below.</p>
          </div>
        </div>
        <div className="login-main">
          <div className="role-tabs">
            {ROLES.map((r) => (
              <div
                key={r}
                className={`role-tab ${role === r ? 'active' : ''}`}
                onClick={() => { setRole(r); setError(''); }}
              >
                {ROLE_LABEL[r]}
              </div>
            ))}
          </div>
          {error && <div className="error-msg">{error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label>{role === 'student' ? 'Full name' : 'Username'}</label>
              <input
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                autoComplete={role === 'student' ? 'name' : 'username'}
                required
              />
            </div>
            <div className="field">
              <label>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
            <button className="btn btn-navy" style={{ width: '100%', padding: '12px' }} disabled={loading}>
              {loading ? 'Signing in…' : `Sign in as ${ROLE_LABEL[role]}`}
            </button>
          </form>
          {role !== 'student' && (
            <div style={{ marginTop: 14, textAlign: 'center' }}>
              {showForgot ? (
                forgotMessage ? (
                  <div>
                    <div className="notice" style={{ marginBottom: 10, textAlign: 'left' }}>{forgotMessage}</div>
                    <button className="btn btn-ghost btn-sm" onClick={() => { setShowForgot(false); setForgotMessage(''); setForgotEmail(''); }}>
                      Back to sign in
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleForgot} style={{ textAlign: 'left' }}>
                    <div className="field">
                      <label>Email address</label>
                      <input
                        type="email"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        placeholder="you@school.com"
                        required
                      />
                    </div>
                    <button className="btn btn-ghost btn-sm" type="submit" disabled={forgotLoading} style={{ marginRight: 8 }}>
                      {forgotLoading ? 'Sending…' : 'Send reset link'}
                    </button>
                    <button className="btn btn-ghost btn-sm" type="button" onClick={() => { setShowForgot(false); setForgotEmail(''); }}>
                      Cancel
                    </button>
                  </form>
                )
              ) : (
                <button className="btn btn-ghost btn-sm" onClick={() => setShowForgot(true)} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 12.5, cursor: 'pointer', padding: '4px 0' }}>
                  Forgot password?
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
