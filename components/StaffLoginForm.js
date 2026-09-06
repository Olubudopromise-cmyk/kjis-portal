'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Shared form for the un-advertised staff login pages (/teacher/login and
 * /admin/login). Renders identically to the student login card but always
 * posts a fixed role — the pages themselves carry no role-switching UI and
 * are deliberately not linked from anywhere in the app.
 */
export default function StaffLoginForm({ role, label }) {
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
      body: JSON.stringify({ role, identifier, password }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || 'Login failed.');
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
          {error && <div className="error-msg">{error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label>Username</label>
              <input
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                autoComplete="username"
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
              {loading ? 'Signing in…' : `Sign in as ${label}`}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
