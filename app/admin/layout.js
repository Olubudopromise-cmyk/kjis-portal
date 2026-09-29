import { getSession } from '../../lib/session';
import { cookies } from 'next/headers';
import supabaseAdmin from '../../lib/db';
import AdminShell from '../../components/AdminShell';
import AdminGate from '../../components/AdminGate';
import AdminNotFound from './not-found';

export default async function AdminLayout({ children }) {
  const session = await getSession();
  const cookieStore = await cookies();
  const hasCookie = !!cookieStore.get('kjis_session')?.value;
  const sessionRole = session?.role || null;
  console.log('[admin/layout] session check:', { hasCookie, sessionRole, sessionExists: !!session });

  // Not a valid admin session (no cookie, expired/tampered token, or another
  // role). Delegate to AdminGate: /admin/login always renders its sign-in form
  // — checking the session here used to replace the form with the expired
  // screen, making admin login impossible while a bad cookie existed. Every
  // other page in this tree gets the not-found screen instead.
  if (!hasCookie || !session || session.role !== 'admin') {
    console.log('[admin/layout] gating segment — session invalid', { hasCookie, sessionRole });
    return <AdminGate expired={<AdminNotFound />}>{children}</AdminGate>;
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
