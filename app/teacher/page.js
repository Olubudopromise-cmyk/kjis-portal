import { cookies } from 'next/headers';
import { verifySessionToken, SESSION_COOKIE } from '../../lib/auth';
import LogoutButton from '../../components/LogoutButton';

export default async function TeacherPage() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;
  if (!session) return null;

  return (
    <div>
      <div className="topbar">
        <div className="brand">
          <div className="crest">KJ</div>
          <div className="brand-text"><div className="name">King James International School</div></div>
        </div>
        <div className="top-right">
          <span>{session.name}</span>
          <LogoutButton />
        </div>
      </div>
      <main>
        <div className="page-head"><h2>Teacher Desk</h2></div>
        <div className="card">
          <p style={{ color: 'var(--muted)', fontSize: 13.5 }}>
            Starter page — port over attendance marking, results entry and the class roster from the
            prototype as components here, calling <code>/api/students</code>, and new
            <code>/api/attendance</code> and <code>/api/results</code> routes you add next.
          </p>
        </div>
      </main>
    </div>
  );
}
