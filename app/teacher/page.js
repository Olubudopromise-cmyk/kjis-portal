import { getSession } from '../../lib/session';
import LogoutButton from '../../components/LogoutButton';
import TeacherDashboard from './TeacherDashboard';

export default async function TeacherPage() {
  const session = await getSession();
  if (!session) return null;

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
        <TeacherDashboard />
      </div>
    </div>
  );
}
