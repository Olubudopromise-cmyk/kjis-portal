import Link from 'next/link';
import { getSession } from '../../lib/session';
import supabaseAdmin from '../../lib/db';
import LogoutButton from '../../components/LogoutButton';
import AddStudentForm from './AddStudentForm';
import TermControl from './TermControl';

export default async function AdminPage() {
  const session = await getSession();
  if (!session) return null;

  const { data: classes } = await supabaseAdmin.from('classes').select('*').order('name');
  const { data: students } = await supabaseAdmin
    .from('users')
    .select('id, full_name, class_id, category, total_fee, paid')
    .eq('role', 'student')
    .order('created_at', { ascending: false });
  const { data: termRow } = await supabaseAdmin.from('settings').select('value').eq('key', 'current_term').maybeSingle();

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

        <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
          <Link href="/admin/subjects" className="btn btn-ghost btn-sm">Categories &amp; Subjects</Link>
          <Link href="/admin/teachers" className="btn btn-ghost btn-sm">Teachers</Link>
          <Link href="/admin/timetable" className="btn btn-ghost btn-sm">Timetable</Link>
          <Link href="/admin/announcements" className="btn btn-ghost btn-sm">Notices</Link>
        </div>

        <TermControl initialTerm={termRow?.value || 'First Term 2025/2026'} />

        <div className="grid g3" style={{ marginBottom: 20 }}>
          <div className="card stat-card"><div className="label">Active students</div><div className="value">{(students || []).length}</div></div>
          <div className="card stat-card"><div className="label">Total fees billed</div><div className="value">₦{(students || []).reduce((s, u) => s + (u.total_fee || 0), 0).toLocaleString()}</div></div>
          <div className="card stat-card"><div className="label">Total collected</div><div className="value" style={{ color: 'var(--success)' }}>₦{(students || []).reduce((s, u) => s + (u.paid || 0), 0).toLocaleString()}</div></div>
        </div>

        <AddStudentForm classes={classes || []} />

        <div className="card" style={{ marginTop: 20 }}>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>Students ({(students || []).length})</div>
          <table>
            <thead><tr><th>Name</th><th>Category</th><th>Total Fee</th><th>Paid</th><th>Balance</th></tr></thead>
            <tbody>
              {(students || []).map((s) => (
                <tr key={s.id}>
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
