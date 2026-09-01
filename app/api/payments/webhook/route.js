import { NextResponse } from 'next/server';
import crypto from 'crypto';
import supabaseAdmin from '../../../../lib/db';

// Paystack calls this URL directly (server-to-server) — set it in your
// Paystack Dashboard → Settings → API Keys & Webhooks once deployed:
//   https://yourdomain.com/api/payments/webhook
// The signature check below is what makes this trustworthy: only requests
// genuinely signed with your Paystack secret key are accepted. This is the
// ONLY place a payment should ever be marked successful — never the browser.
export async function POST(request) {
  const rawBody = await request.text();
  const signature = request.headers.get('x-paystack-signature');
  const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;

  if (!paystackSecretKey) {
    return NextResponse.json({ error: 'Payment webhook is not configured yet.' }, { status: 500 });
  }

  const expected = crypto
    .createHmac('sha512', paystackSecretKey)
    .update(rawBody)
    .digest('hex');

  if (signature !== expected) {
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 401 });
  }

  const event = JSON.parse(rawBody);

  if (event.event === 'charge.success') {
    const { reference, amount, metadata } = event.data;

    const { data: payment } = await supabaseAdmin
      .from('payments')
      .select('*')
      .eq('reference', reference)
      .maybeSingle();

    if (payment && payment.status !== 'success') {
      await supabaseAdmin.from('payments').update({ status: 'success' }).eq('reference', reference);

      const { data: student } = await supabaseAdmin
        .from('users')
        .select('paid')
        .eq('id', metadata.student_id)
        .single();

      if (student) {
        await supabaseAdmin
          .from('users')
          .update({ paid: (student.paid || 0) + amount / 100 })
          .eq('id', metadata.student_id);
      }
    }
  }

  return NextResponse.json({ received: true });
}
