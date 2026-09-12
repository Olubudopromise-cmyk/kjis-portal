import { getSession } from '../../lib/session';
import { cookies } from 'next/headers';
import supabaseAdmin from '../../lib/db';
import AdminShell from '../../components/AdminShell';

export default async function AdminLayout({ children }) {
  const session = await getSession();
  const cookieStore = await cookies();
  const isLoggedIn = !!cookieStore.get('kjis_session')?.value;
  if (!isLoggedIn) return <>{children}</>;
  if (!session || session.role !== 'admin') return null;

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
