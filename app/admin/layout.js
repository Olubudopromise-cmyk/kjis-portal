import { getSession } from '../../lib/session';
import { cookies } from 'next/headers';
import supabaseAdmin from '../../lib/db';
import AdminShell from '../../components/AdminShell';
import AdminNotFound from './not-found';

export default async function AdminLayout({ children }) {
  const session = await getSession();
  const cookieStore = await cookies();
  const hasCookie = !!cookieStore.get('kjis_session')?.value;
  const sessionRole = session?.role || null;
  console.log('[admin/layout] session check:', { hasCookie, sessionRole, sessionExists: !!session });

  // No session cookie at all -> this is the unauthenticated case, which means
  // the page being rendered is /admin/login (middleware bounces every other
  // /admin path to it). Render that page bare, without the portal shell, and
  // crucially WITHOUT redirecting: /admin/login lives inside this segment, so
  // redirecting here is what previously caused a redirect loop.
  if (!hasCookie) return <>{children}</>;

  // A cookie exists but the token is expired/tampered with, or it belongs to
  // another role. Return the not-found page directly (not throw notFound())
  // so it replaces the entire segment — throwing renders the not-found page
  // alongside the page content, producing a broken half-rendered screen.
  if (!session || session.role !== 'admin') {
    console.log('[admin/layout] rendering AdminNotFound — session invalid');
    return <AdminNotFound />;
  }
  console.log('[admin/layout] rendering AdminShell');

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
    <AdminShell
      session={session}
      classes={classes || []}
      students={students || []}
      term={termRow?.value || 'First Term 2025/2026'}
      totalFees={totalFees}
      totalCollected={totalCollected}
    >
      {children}
    </AdminShell>
  );
}
