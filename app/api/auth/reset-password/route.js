import { NextResponse } from 'next/server';
import supabaseAdmin from '../../../../lib/db';
import { hashPassword } from '../../../../lib/password';

export async function POST(request) {
  const { token, newPassword } = await request.json();

  if (!token || !newPassword) {
    return NextResponse.json({ error: 'Missing token or new password.' }, { status: 400 });
  }

  if (typeof newPassword !== 'string' || newPassword.length < 4) {
    return NextResponse.json({ error: 'Password must be at least 4 characters.' }, { status: 400 });
  }

  // Look up the token — must exist, not be expired, and not already used.
  const { data: record, error: lookupError } = await supabaseAdmin
    .from('password_resets')
    .select('id, user_id, expires_at, used')
    .eq('token', token)
    .maybeSingle();

  if (lookupError || !record) {
    return NextResponse.json({ error: 'Invalid or expired reset link.' }, { status: 400 });
  }

  if (record.used) {
    return NextResponse.json({ error: 'This reset link has already been used. Please request a new one.' }, { status: 400 });
  }

  if (new Date(record.expires_at) < new Date()) {
    return NextResponse.json({ error: 'This reset link has expired. Please request a new one.' }, { status: 400 });
  }

  // Hash the new password and update the user.
  const hashedPassword = await hashPassword(newPassword);

  const { error: updateError } = await supabaseAdmin
    .from('users')
    .update({ password_hash: hashedPassword })
    .eq('id', record.user_id);

  if (updateError) {
    console.error('Failed to update password:', updateError);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }

  // Mark the token as used.
  await supabaseAdmin
    .from('password_resets')
    .update({ used: true })
    .eq('id', record.id);

  return NextResponse.json({ ok: true, message: 'Your password has been reset. You can now sign in.' });
}
