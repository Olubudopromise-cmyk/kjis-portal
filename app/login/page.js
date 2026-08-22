'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

const ROLES = ['student', 'teacher', 'admin'];
const ROLE_LABEL = { student: 'Student', teacher: 'Teacher', admin: 'Head Admin' };

export default function LoginPage() {
  const router = useRouter();
  const [role, setRole] = useState('student');
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
        </div>
      </div>
    </div>
  );
}
