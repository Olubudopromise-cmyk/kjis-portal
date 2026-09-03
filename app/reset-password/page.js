'use client';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  if (!token) {
    return (
      <div className="login-wrap">
        <div className="login-card" style={{ maxWidth: 480 }}>
          <div className="login-main" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '48px 40px' }}>
            <div className="crest" style={{ margin: '0 auto 16px', width: 48, height: 48, fontSize: 20 }}>KJ</div>
            <h2 style={{ marginBottom: 12 }}>Invalid Reset Link</h2>
            <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 24 }}>
              This password reset link is invalid or missing a token.
            </p>
            <Link href="/login" className="btn btn-navy" style={{ padding: '10px 24px', textDecoration: 'none' }}>
              Back to login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (newPassword.length < 4) {
      setError('Password must be at least 4 characters.');
      return;
    }

    setLoading(true);
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, newPassword }),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || 'Something went wrong.');
      return;
    }
    setSuccess(data.message);
  }

  return (
    <div className="login-wrap">
      <div className="login-card" style={{ maxWidth: 480 }}>
        <div className="login-side" style={{ gridColumn: '1 / -1', padding: '36px 38px' }}>
          <div>
            <div className="crest">KJ</div>
            <h1 style={{ fontSize: 24, marginTop: 12 }}>Reset Your Password</h1>
            <p>Enter a new password for your account.</p>
          </div>
        </div>
        <div className="login-main" style={{ gridColumn: '1 / -1', padding: '36px 40px 44px' }}>
          {error && <div className="error-msg">{error}</div>}
          {success ? (
            <div style={{ textAlign: 'center' }}>
              <div className="notice" style={{ marginBottom: 20 }}>{success}</div>
              <Link href="/login" className="btn btn-navy" style={{ padding: '10px 24px', textDecoration: 'none' }}>
                Go to login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="field">
                <label>New password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                />
              </div>
              <div className="field">
                <label>Confirm new password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                />
              </div>
              <button className="btn btn-navy" style={{ width: '100%', padding: '12px' }} disabled={loading}>
                {loading ? 'Resetting…' : 'Reset password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="login-wrap">
      <div className="login-card" style={{ maxWidth: 480 }}>
        <div className="login-main" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '48px 40px' }}>
          <div className="crest" style={{ margin: '0 auto 16px', width: 48, height: 48, fontSize: 20 }}>KJ</div>
          <p style={{ color: 'var(--muted)', fontSize: 14 }}>Loading reset form…</p>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <ResetPasswordForm />
    </Suspense>
  );
}
