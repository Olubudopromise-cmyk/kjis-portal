import { NextResponse } from 'next/server';
import supabaseAdmin from '../../../../lib/db';
import { verifyPassword } from '../../../../lib/password';
import { createSessionToken, createFaceToken, SESSION_COOKIE } from '../../../../lib/auth';

export async function POST(request) {
  const { role, identifier, password } = await request.json();

  if (!role || !identifier || !password) {
    return NextResponse.json({ error: 'Missing fields.' }, { status: 400 });
  }
  if (!['student', 'teacher', 'admin'].includes(role)) {
    return NextResponse.json({ error: 'Invalid role.' }, { status: 400 });
  }

  // Students log in by their registered full name; staff log in by username.
  const column = role === 'student' ? 'full_name' : 'username';

  const { data: user, error } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('role', role)
    .ilike(column, identifier.trim())
    .maybeSingle();

  // --- TEMP DEBUG LOGGING (remove after diagnosis) ---
  console.log('[login-debug] role:', role, '| identifier:', identifier);
  console.log('[login-debug] Supabase query result →', JSON.stringify({ data: user, error }));
  // --- END TEMP DEBUG LOGGING ---

  if (error || !user) {
    return NextResponse.json(
      { error: role === 'student' ? 'No student found with that name.' : 'Incorrect username or password.' },
      { status: 401 }
    );
  }

  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) {
    return NextResponse.json({ error: 'Incorrect password.' }, { status: 401 });
  }

  // If this student has a reference photo on file, credentials alone aren't
  // enough — send them to the face-check step instead of logging in yet.
  // A short-lived token proves "password was correct" without granting a
  // real session; only /api/auth/face-verify can turn it into one.
  if (role === 'student' && user.face_photo_url) {
    const faceToken = await createFaceToken({ id: user.id, name: user.full_name });
    return NextResponse.json({ ok: true, pendingFaceCheck: true, faceToken, name: user.full_name });
  }

  const token = await createSessionToken({
    id: user.id,
    role: user.role,
    name: user.full_name || user.username,
  });

  const res = NextResponse.json({ ok: true, role: user.role });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 12,
  });
  return res;
}

