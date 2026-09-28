import Link from 'next/link';

// Rendered by app/admin/layout.js when a session cookie exists but the token
// is expired, tampered with, or belongs to a different role. Without this file
// that case used to `return null` and show a completely blank screen.
export default function AdminNotFound() {
  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-side">
          <div>
            <div className="crest">KJ</div>
            <h1>
              King James
              <br />
              International School
            </h1>
            <p>Admin desk</p>
          </div>
        </div>
        <div className="login-main">
          <div className="error-msg">Your session has expired. Please sign in again.</div>
          <Link className="btn btn-navy" style={{ width: '100%', padding: '12px', display: 'block', textAlign: 'center' }} href="/admin/login">
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
