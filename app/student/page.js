import { getSession } from '../../lib/session';
import supabaseAdmin from '../../lib/db';
import LogoutButton from '../../components/LogoutButton';
import StudentDashboard from './StudentDashboard';

export default async function StudentPage() {
  const session = await getSession();
  if (!session) return null;

  const { data: student } = await supabaseAdmin.from('users').select('*').eq('id', session.id).single();

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
        <StudentDashboard student={student} />
      </main>
    </div>
  );
}
