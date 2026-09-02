import { NextResponse } from 'next/server';
import supabaseAdmin from '../../../lib/db';
import { hashPassword } from '../../../lib/password';
import { getSession } from '../../../lib/session';

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });
  }
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('id, full_name, username, email, class_id')
    .eq('role', 'teacher')
    .order('full_name');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ teachers: data });
}

export async function POST(request) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });
  }
  const { fullName, username, password, classId, email } = await request.json();
  if (!fullName || !username || !password || !email) {
    return NextResponse.json({ error: 'Full name, username, email and password are required.' }, { status: 400 });
  }

  const { data: existing } = await supabaseAdmin.from('users').select('id').ilike('username', username.trim()).maybeSingle();
  if (existing) return NextResponse.json({ error: 'That username is already taken.' }, { status: 409 });

  const password_hash = await hashPassword(password);
  const { data, error } = await supabaseAdmin
    .from('users')
    .insert({
      role: 'teacher',
      full_name: fullName.trim(),
      username: username.trim(),
      email: email.trim().toLowerCase(),
      password_hash,
      class_id: classId || null,
    })
    .select('id, full_name, username, email, class_id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, teacher: data });
}

export async function DELETE(request) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });
  }
  const { id } = await request.json();
  const { error } = await supabaseAdmin.from('users').delete().eq('id', id).eq('role', 'teacher');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
