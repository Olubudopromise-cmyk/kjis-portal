import { NextResponse } from 'next/server';
import { getSession } from '../../../../lib/session';
import supabaseAdmin from '../../../../lib/db';

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== 'student') {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });
  }

  const { data: student } = await supabaseAdmin
    .from('users')
    .select('total_fee, paid')
    .eq('id', session.id)
    .single();

  if (!student) {
    return NextResponse.json({ error: 'Student not found.' }, { status: 404 });
  }

  return NextResponse.json({
    totalFee: Number(student.total_fee || 0),
    paid: Number(student.paid || 0),
  });
}
