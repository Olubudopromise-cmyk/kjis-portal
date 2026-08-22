import { NextResponse } from 'next/server';
import supabaseAdmin from '../../../../lib/db';
import { verifyPassword } from '../../../../lib/password';
import { createSessionToken, SESSION_COOKIE } from '../../../../lib/auth';

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

  // NOTE — face verification hook:
  // If you keep face verification, don't set the session cookie yet here.
  // Instead return { ok:true, pendingFaceCheck:true, userId:user.id } and have
  // the client go through a face-check screen that calls a *second* endpoint
  // (e.g. /api/auth/face-verify) which only then calls createSessionToken and
  // sets the cookie below. That keeps the trusted session gated on both
  // checks. This MVP issues the session immediately so the rest of the app
  // is testable end-to-end first.
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
