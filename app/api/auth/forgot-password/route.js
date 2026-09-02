import { NextResponse } from 'next/server';
import crypto from 'crypto';
import supabaseAdmin from '../../../../lib/db';

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

export async function POST(request) {
  const { email } = await request.json();

  if (!email || typeof email !== 'string') {
    return NextResponse.json({ error: 'Please enter your email address.' }, { status: 400 });
  }

  // Always return the same message to avoid leaking which emails exist.
  const SAFE_MESSAGE = 'If that email is registered, you\'ll receive a reset link shortly.';

  // Look up the user by email — only teachers and admins can self-reset.
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('id, email')
    .eq('email', email.trim().toLowerCase())
    .in('role', ['teacher', 'admin'])
    .maybeSingle();

  if (!user) {
    // Return 200 with the same safe message — don't reveal whether the email exists.
    return NextResponse.json({ ok: true, message: SAFE_MESSAGE });
  }

  // Invalidate any previously unused tokens for this user.
  await supabaseAdmin
    .from('password_resets')
    .update({ used: true })
    .eq('user_id', user.id)
    .eq('used', false);

  // Create a new reset token, valid for 30 minutes.
  const token = generateToken();
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

  const { error: insertError } = await supabaseAdmin
    .from('password_resets')
    .insert({ user_id: user.id, token, expires_at: expiresAt });

  if (insertError) {
    console.error('Failed to create password reset token:', insertError);
    return NextResponse.json({ ok: true, message: SAFE_MESSAGE });
  }

  // Send the reset email via Resend.
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    const domain = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const resetUrl = `${domain}/reset-password?token=${token}`;

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          // TODO: swap onboarding@resend.dev for your verified domain once you've
          // set one up in the Resend dashboard (e.g. noreply@yourschool.com).
          from: 'King James School Portal <onboarding@resend.dev>',
          to: user.email,
          subject: 'Reset your password — King James International School',
          html: `
            <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
              <h2 style="color: #16233F;">Password Reset Request</h2>
              <p>We received a request to reset your password for the King James International School portal.</p>
              <p>Click the button below to set a new password. This link expires in 30 minutes.</p>
              <a href="${resetUrl}" style="display: inline-block; background: #16233F; color: #F7F3E8; padding: 12px 24px; border-radius: 7px; text-decoration: none; font-weight: 600; margin: 16px 0;">Reset my password</a>
              <p style="color: #6B7280; font-size: 13px;">If you didn't request this, you can safely ignore this email — your password won't change.</p>
            </div>
          `,
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        console.error('Resend email failed:', response.status, body);
      }
    } catch (err) {
      console.error('Failed to send reset email:', err);
    }
  } else {
    // No Resend key configured — log the reset link for development.
    const domain = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    console.log(`[DEV] Password reset link: ${domain}/reset-password?token=${token}`);
  }

  return NextResponse.json({ ok: true, message: SAFE_MESSAGE });
}
