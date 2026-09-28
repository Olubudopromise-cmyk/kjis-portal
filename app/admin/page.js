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

  // Every read is tolerated: a slow or failing Supabase call must not blank the
  // whole admin page (the shell and the register-a-student form stay usable),
  // so each query degrades to "no data" and the sections below say so.
  const classesResult = await supabaseAdmin.from('classes').select('*').order('name');
  const classes = classesResult.error ? null : classesResult.data;
  const studentsResult = await supabaseAdmin
    .from('users')
    .select('id, full_name, class_id, category, total_fee, paid, admission_no, active')
    .eq('role', 'student')
    .order('created_at', { ascending: false });
  const students = studentsResult.error ? [] : studentsResult.data || [];
  const { data: termRow } = await supabaseAdmin.from('settings').select('value').eq('key', 'current_term').maybeSingle();
  const { data: startDateRow } = await supabaseAdmin.from('settings').select('value').eq('key', 'term_start_date').maybeSingle();

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

      <TermControl initialTerm={termRow?.value || 'First Term 2025/2026'} initialStartDate={startDateRow?.value || ''} />

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
