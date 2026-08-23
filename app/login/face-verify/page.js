'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import FaceCapture from '../../../components/FaceCapture';

export default function FaceVerifyPage() {
  const router = useRouter();
  const [faceToken, setFaceToken] = useState(null);
  const [name, setName] = useState('');
  const [photo, setPhoto] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const token = sessionStorage.getItem('kjis_face_token');
    const n = sessionStorage.getItem('kjis_face_name');
    if (!token) { router.push('/login'); return; }
    setFaceToken(token);
    setName(n || '');
  }, [router]);

  async function verify() {
    setError(''); setLoading(true);
    const res = await fetch('/api/auth/face-verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ faceToken, image: photo }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error || 'Verification failed.'); return; }
    sessionStorage.removeItem('kjis_face_token');
    sessionStorage.removeItem('kjis_face_name');
    router.push('/student');
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-side">
          <div>
            <div className="crest">KJ</div>
            <h1>Face<br />Verification</h1>
            <p>Hi {name || 'there'} — let's confirm it's really you before signing you in.</p>
          </div>
        </div>
        <div className="login-main">
          {error && <div className="error-msg">{error}</div>}
          <FaceCapture label="Live photo" onCapture={setPhoto} />
          <p style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 16 }}>
            This is matched against your reference photo on file. Good lighting and looking
            straight at the camera helps it work first time.
          </p>
          <button className="btn btn-navy" style={{ width: '100%', padding: 12 }} onClick={verify} disabled={!photo || loading}>
            {loading ? 'Verifying…' : 'Verify & sign in'}
          </button>
          <div className="switch-line" style={{ marginTop: 16 }}>
            <a onClick={() => router.push('/login')}>← Back to sign-in</a>
          </div>
        </div>
      </div>
    </div>
  );
}
