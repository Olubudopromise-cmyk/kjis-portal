import { getSession } from '../../lib/session';
import supabaseAdmin from '../../lib/db';
import LogoutButton from '../../components/LogoutButton';
import TeacherDashboard from './TeacherDashboard';

export default async function TeacherPage() {
  const session = await getSession();
  if (!session) return null;

  const { data: teacher } = await supabaseAdmin.from('users').select('*').eq('id', session.id).single();

  // Resolve the class name up front. The client can't call /api/classes (that
  // route is admin-only), and the roster only carries class_id, so without this
  // the Overview card and the Timetable tab have nothing to show but a UUID.
  let className = null;
  if (teacher?.class_id) {
    const { data: klass } = await supabaseAdmin
      .from('classes')
      .select('name')
      .eq('id', teacher.class_id)
      .maybeSingle();
    className = klass?.name || null;
  }

  return (
    <div className="portal-shell">
      <div className="portal-topbar">
        <div className="brand">
          <div className="crest">KJ</div>
          <div className="brand-text"><div className="name">King James International School</div></div>
        </div>
        <div className="top-right">
          <span>{session.name}</span>
          <LogoutButton />
        </div>
      </div>
      <div className="portal-body">
        <TeacherDashboard session={session} teacher={teacher} className={className} />
      </div>
    </div>
  );
}
