import { NextResponse } from 'next/server';
import supabaseAdmin from '../../../lib/db';
import { hashPassword } from '../../../lib/password';
import { getSession } from '../../../lib/session';

// List students — used for admin's full table, and for a teacher's own
// class roster (attendance/results screens pass ?classId=).
export async function GET(request) {
  const session = await getSession();
  if (!session || !['admin', 'teacher'].includes(session.role)) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  let classId = searchParams.get('classId');

  // Teachers can only ever list their own class, regardless of what's asked for.
  if (session.role === 'teacher') {
    const { data: teacher } = await supabaseAdmin.from('users').select('class_id').eq('id', session.id).single();
    classId = teacher?.class_id || null;
  }

  let query = supabaseAdmin
    .from('users')
    .select('id, full_name, class_id, category, total_fee, paid, admission_no')
    .eq('role', 'student')
    .order('full_name');
  if (classId) query = query.eq('class_id', classId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ students: data });
}

// Admin or a teacher registering their own class can create a student —
// this is the server-side version of "teacher writes the student's name in
// before the student ever logs in".
export async function POST(request) {
  const session = await getSession();
  if (!session || !['admin', 'teacher'].includes(session.role)) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });
  }

  const body = await request.json();
  const { fullName, password, classId, category, totalFee, admissionNo } = body;

  if (!fullName || !password) {
    return NextResponse.json({ error: 'Full name and password are required.' }, { status: 400 });
  }

  // Teachers can only add students into their own class.
  let effectiveClassId = classId || null;
  if (session.role === 'teacher') {
    const { data: teacher } = await supabaseAdmin.from('users').select('class_id').eq('id', session.id).single();
    effectiveClassId = teacher?.class_id || null;
  }

  const { data: existing } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('role', 'student')
    .ilike('full_name', fullName.trim())
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: 'A student with this exact name already exists. Add a middle name or initial to tell them apart.' },
      { status: 409 }
    );
  }

  const password_hash = await hashPassword(password);
  const { data, error } = await supabaseAdmin
    .from('users')
    .insert({
      role: 'student',
      full_name: fullName.trim(),
      password_hash,
      class_id: effectiveClassId,
      category: category || null,
      total_fee: totalFee || 0,
      paid: 0,
      admission_no: admissionNo || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, student: data });
}
