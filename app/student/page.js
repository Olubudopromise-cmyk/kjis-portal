import { redirect } from 'next/navigation';
import { getSession } from '../../lib/session';
import supabaseAdmin from '../../lib/db';
import LogoutButton from '../../components/LogoutButton';
import StudentDashboard from './StudentDashboard';

export default async function StudentPage() {
  const session = await getSession();
  if (!session) {
    // Middleware should have redirected already; this is a safety net.
    redirect('/login');
  }

  const { data: student, error } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('id', session.id)
    .single();

  if (error) {
    console.error('[student/page] DB lookup error:', error.message, error.code);
    redirect('/login');
  }

  if (!student) {
    return (
      <div className="portal-shell">
        <div className="portal-topbar">
          <div className="brand">
            <div className="crest">KJ</div>
            <div className="brand-text"><div className="name">King James International School</div></div>
          </div>
          <div className="top-right"><span>Student</span></div>
        </div>
        <div className="portal-body">
          <div className="portal-content"><div className="card empty-note">Student profile not found.</div></div>
        </div>
      </div>
    );
  }

  console.log('[student/page] rendering dashboard for:', student.full_name, 'id:', student.id);

  return (
    <div className="portal-shell">
      <div className="portal-topbar">
        <div className="brand">
          <div className="crest">KJ</div>
          <div className="brand-text"><div className="name">King James International School</div></div>
        </div>
        <div className="top-right">
          <span>{student.full_name}</span>
          <LogoutButton />
        </div>
      </div>
      <div className="portal-body">
        <StudentDashboard student={student} />
      </div>
    </div>
  );
}
