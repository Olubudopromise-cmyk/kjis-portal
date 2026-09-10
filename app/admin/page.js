import Link from 'next/link';
import { getSession } from '../../lib/session';
import supabaseAdmin from '../../lib/db';
import LogoutButton from '../../components/LogoutButton';
import AddStudentForm from './AddStudentForm';
import TermControl from './TermControl';
import StudentTable from './StudentTable';

export default async function AdminOverviewPage() {
  const session = await getSession();
  if (!session) return null;

  const classesResult = await supabaseAdmin.from('classes').select('*').order('name');
  const { data: classes } = classesResult;
  const { data: students } = await supabaseAdmin
    .from('users')
    .select('id, full_name, class_id, category, total_fee, paid, admission_no, active')
    .eq('role', 'student')
    .order('created_at', { ascending: false });
  const { data: termRow } = await supabaseAdmin.from('settings').select('value').eq('key', 'current_term').maybeSingle();

  const totalFees = (students || []).reduce((s, u) => s + (u.total_fee || 0), 0);
  const totalCollected = (students || []).reduce((s, u) => s + (u.paid || 0), 0);

  return (
    <div>
      <div className="page-head"><h2>Admin Desk</h2></div>

      <div className="grid g3" style={{ marginBottom: 20 }}>
        <div className="card stat-card"><div className="label">Active students</div><div className="value">{(students || []).length}</div></div>
        <div className="card stat-card"><div className="label">Total fees billed</div><div className="value">₦{totalFees.toLocaleString()}</div></div>
        <div className="card stat-card"><div className="label">Total collected</div><div className="value" style={{ color: 'var(--success)' }}>₦{totalCollected.toLocaleString()}</div></div>
      </div>

      <TermControl initialTerm={termRow?.value || 'First Term 2025/2026'} />

      {Array.isArray(classes) ? (
        <>
          <AddStudentForm classes={classes} />
          <StudentTable students={students || []} classes={classes} />
        </>
      ) : (
        <div className="card empty-note" style={{ marginTop: 20 }}>No classes configured yet.</div>
      )}
    </div>
  );
}
