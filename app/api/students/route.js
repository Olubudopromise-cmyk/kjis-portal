import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import supabaseAdmin from '../../../lib/db';
import { hashPassword } from '../../../lib/password';
import { verifySessionToken, SESSION_COOKIE } from '../../../lib/auth';

async function getSession() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  return token ? verifySessionToken(token) : null;
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
      class_id: classId || null,
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
