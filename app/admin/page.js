import { cookies } from 'next/headers';
import { verifySessionToken, SESSION_COOKIE } from '../../lib/auth';
import supabaseAdmin from '../../lib/db';
import LogoutButton from '../../components/LogoutButton';
import AddStudentForm from './AddStudentForm';

export default async function AdminPage() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;
  if (!session) return null;

  const { data: classes } = await supabaseAdmin.from('classes').select('*').order('name');
  const { data: students } = await supabaseAdmin
    .from('users')
    .select('id, full_name, class_id, category, total_fee, paid')
    .eq('role', 'student')
    .order('created_at', { ascending: false });

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
        <div className="page-head"><h2>Admin Desk</h2></div>

        <AddStudentForm classes={classes || []} />

        <div className="card" style={{ marginTop: 20 }}>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>Students ({(students || []).length})</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--muted)' }}>
                <th>Name</th><th>Category</th><th>Total Fee</th><th>Paid</th><th>Balance</th>
              </tr>
            </thead>
            <tbody>
              {(students || []).map((s) => (
                <tr key={s.id} style={{ borderTop: '1px solid var(--line)' }}>
                  <td>{s.full_name}</td>
                  <td>{s.category || '—'}</td>
                  <td className="mono">₦{(s.total_fee || 0).toLocaleString()}</td>
                  <td className="mono">₦{(s.paid || 0).toLocaleString()}</td>
                  <td className="mono">₦{((s.total_fee || 0) - (s.paid || 0)).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
