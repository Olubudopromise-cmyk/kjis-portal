import { NextResponse } from 'next/server';
import supabaseAdmin from '../../../../lib/db';
import { verifyPassword } from '../../../../lib/password';
import { createSessionToken, createFaceToken, SESSION_COOKIE } from '../../../../lib/auth';
import { rateLimitKey, isRateLimited, recordFailedAttempt, clearRateLimit } from '../../../../lib/rate-limit';

export async function POST(request) {
  const { role, identifier, password } = await request.json();

  if (!role || !identifier || !password) {
    return NextResponse.json({ error: 'Missing fields.' }, { status: 400 });
  }
  if (!['student', 'teacher', 'admin'].includes(role)) {
    return NextResponse.json({ error: 'Invalid role.' }, { status: 400 });
  }

  // Fixed-window brute-force guard: 5 failed attempts per 15 minutes per
  // role+identifier. Checked before touching credentials; a successful login
  // clears the key so typos don't punish legitimate users.
  const rlKey = rateLimitKey(`login:${role}`, identifier);
  if (await isRateLimited(rlKey)) {
    return NextResponse.json(
      { error: 'Too many attempts. Please try again in a few minutes.' },
      { status: 429 }
    );
  }

  // Students log in by their registered full name; staff log in by username.
  const column = role === 'student' ? 'full_name' : 'username';

  // `active` is null for pre-migration rows and true/false afterwards — only
  // an explicit false blocks login. Deactivated students get the same "not
  // found" message as an unknown name so the account's existence never leaks.
  const { data: user, error } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('role', role)
    .neq('active', false)
    .ilike(column, identifier.trim())
    .maybeSingle();

  if (error || !user) {
    await recordFailedAttempt(rlKey);
    return NextResponse.json(
      { error: role === 'student' ? 'No student found with that name.' : 'Incorrect username or password.' },
      { status: 401 }
    );
  }

  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) {
    await recordFailedAttempt(rlKey);
    return NextResponse.json({ error: 'Incorrect password.' }, { status: 401 });
  }

  await clearRateLimit(rlKey);

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

