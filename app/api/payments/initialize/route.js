import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import supabaseAdmin from '../../../../lib/db';
import { verifySessionToken, SESSION_COOKIE } from '../../../../lib/auth';

export async function POST(request) {
  const token = cookies().get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;
  if (!session || session.role !== 'student') {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });
  }

  const { amount } = await request.json();
  const { data: student } = await supabaseAdmin.from('users').select('*').eq('id', session.id).single();
  if (!student) return NextResponse.json({ error: 'Student not found.' }, { status: 404 });

  const balance = (student.total_fee || 0) - (student.paid || 0);
  if (!amount || amount <= 0 || amount > balance) {
    return NextResponse.json({ error: 'Invalid amount.' }, { status: 400 });
  }

  const reference = `kjis_${student.id}_${Date.now()}`;
  const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!paystackSecretKey) {
    return NextResponse.json({ error: 'Payment processing is not configured yet. Add PAYSTACK_SECRET_KEY to the environment.' }, { status: 500 });
  }

  // Paystack requires an email on the transaction even though students log in
  // by name — this synthetic address is only ever used by Paystack, never for
  // real mail. Swap in a real guardian email field later if you collect one.
  const paystackRes = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${paystackSecretKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: `${student.id}@students.kingjamesschool.ng`,
      amount: Math.round(amount * 100), // Paystack expects kobo
      reference,
      metadata: { student_id: student.id },
    }),
  });
  const data = await paystackRes.json();

  if (!data.status) {
    return NextResponse.json({ error: 'Could not start payment. Please try again.' }, { status: 500 });
  }

  // Recorded as 'pending' — it only flips to 'success' (and the balance only
  // updates) once the webhook below confirms it from Paystack's side.
  await supabaseAdmin.from('payments').insert({
    student_id: student.id,
    amount,
    reference,
    status: 'pending',
  });

  return NextResponse.json({ authorization_url: data.data.authorization_url, reference });
}
