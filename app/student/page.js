import { cookies } from 'next/headers';
import { verifySessionToken, SESSION_COOKIE } from '../../lib/auth';
import supabaseAdmin from '../../lib/db';
import LogoutButton from '../../components/LogoutButton';

export default async function StudentPage() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;
  if (!session) return null; // middleware.js already redirects unauthenticated visits

  const { data: student } = await supabaseAdmin.from('users').select('*').eq('id', session.id).single();
  const balance = (student.total_fee || 0) - (student.paid || 0);

  return (
    <div>
      <div className="topbar">
        <div className="brand">
          <div className="crest">KJ</div>
          <div className="brand-text"><div className="name">King James International School</div></div>
        </div>
        <div className="top-right">
          <span>{student.full_name}</span>
          <LogoutButton />
        </div>
      </div>
      <main>
        <div className="page-head"><h2>Welcome, {student.full_name.split(' ')[0]}</h2></div>
        <div className="grid g3">
          <div className="card stat-card">
            <div className="label">Category</div>
            <div className="value" style={{ fontSize: 18 }}>{student.category || '—'}</div>
          </div>
          <div className="card stat-card">
            <div className="label">Fee balance</div>
            <div className="value">₦{balance.toLocaleString()}</div>
          </div>
          <div className="card stat-card">
            <div className="label">Admission No.</div>
            <div className="value" style={{ fontSize: 18 }}>{student.admission_no || '—'}</div>
          </div>
        </div>
        <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 24 }}>
          This is a starter dashboard — attendance, report cards, subjects and the AI tutor from the
          prototype still need porting in as their own components here.
        </p>
      </main>
    </div>
  );
}
