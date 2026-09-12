import { NextResponse } from 'next/server';
import supabaseAdmin from '../../../../lib/db';
import { verifyPassword } from '../../../../lib/password';
import { createSessionToken, createFaceToken, SESSION_COOKIE } from '../../../../lib/auth';
import { rateLimitKey, isRateLimited, recordFailedAttempt, clearRateLimit } from '../../../../lib/rate-limit';

export async function POST(request) {
  const { role, identifier, password } = await request.json();

  console.log('[login] Received login attempt:', { role, identifier: identifier?.trim(), hasPassword: !!password });

  if (!role || !identifier || !password) {
    console.log('[login] 400: Missing fields', { role: !!role, identifier: !!identifier, password: !!password });
    return NextResponse.json({ error: 'Missing fields.' }, { status: 400 });
  }
  if (!['student', 'teacher', 'admin'].includes(role)) {
    console.log('[login] 400: Invalid role:', role);
    return NextResponse.json({ error: 'Invalid role.' }, { status: 400 });
  }

  // Fixed-window brute-force guard: 5 failed attempts per 15 minutes per
  // role+identifier. Checked before touching credentials; a successful login
  // clears the key so typos don't punish legitimate users.
  const rlKey = rateLimitKey(`login:${role}`, identifier);
  if (await isRateLimited(rlKey)) {
    console.log('[login] 429: Rate limited for', rlKey);
    return NextResponse.json(
      { error: 'Too many attempts. Please try again in a few minutes.' },
      { status: 429 }
    );
  }

  // Students log in by their registered full name; staff log in by username.
  const column = role === 'student' ? 'full_name' : 'username';

  console.log('[login] Looking up user:', { column, identifier: identifier.trim(), role });

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

  if (error) {
    const isTimeout = error.message?.includes('timeout') || error.code === 'PGRST100' || error.message?.includes('Gateway Timeout');
    console.log('[login] DB lookup error:', { message: error.message, code: error.code, isTimeout });
    await recordFailedAttempt(rlKey);
    if (isTimeout) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable, please try again.' },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: role === 'student' ? 'No student found with that name.' : 'Incorrect username or password.' },
      { status: 401 }
    );
  }

  if (!user) {
    await recordFailedAttempt(rlKey);
    console.log('[login] 401: User not found');
    return NextResponse.json(
      { error: role === 'student' ? 'No student found with that name.' : 'Incorrect username or password.' },
      { status: 401 }
    );
  }

  const ok = await verifyPassword(password, user.password_hash);
  console.log('[login] Password comparison result:', { ok, userId: user.id });

  if (!ok) {
    await recordFailedAttempt(rlKey);
    console.log('[login] 401: Password mismatch for user', user.id, user.username || user.full_name);
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
  console.log('[login] 200: Login successful for', user.username || user.full_name, 'role:', user.role);
  return res;
}

