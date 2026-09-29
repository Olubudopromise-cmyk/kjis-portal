'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'student', identifier, password }),
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
    // Hard navigation so the dashboard renders against the fresh session cookie
    // instead of reusing any layout cached from the pre-login render.
    window.location.href = '/student';
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
          {error && <div className="error-msg">{error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label>Full name</label>
              <input
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                autoComplete="name"
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
              {loading ? 'Signing in…' : 'Sign in as Student'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
