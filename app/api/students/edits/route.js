import { NextResponse } from 'next/server';
import supabaseAdmin from '../../../../lib/db';
import { getSession } from '../../../../lib/session';

// Admin only — recent audit-trail entries for one student's record edits.
// Written by PATCH /api/students (see supabase/migrations/008).
export async function GET(request) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const studentId = searchParams.get('studentId');
  if (!studentId) {
    return NextResponse.json({ error: 'Missing studentId.' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('student_edits')
    .select('id, editor_name, editor_role, changes, created_at')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ edits: data || [] });
}
