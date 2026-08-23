import { NextResponse } from 'next/server';
import supabaseAdmin from '../../../lib/db';
import { getSession } from '../../../lib/session';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

// GET ?classId= -> that class's full week
export async function GET(request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  let classId = searchParams.get('classId');

  if (session.role === 'student') {
    const { data: student } = await supabaseAdmin.from('users').select('class_id').eq('id', session.id).single();
    classId = student?.class_id || null;
  }
  if (!classId) return NextResponse.json({ entries: [] });

  const { data, error } = await supabaseAdmin
    .from('timetable')
    .select('*')
    .eq('class_id', classId)
    .order('day_of_week')
    .order('period_label');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ entries: data });
}

export async function POST(request) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });
  }
  const { classId, dayOfWeek, periodLabel, subject, teacherName } = await request.json();
  if (!classId || !DAYS.includes(dayOfWeek) || !periodLabel || !subject) {
    return NextResponse.json({ error: 'classId, a valid dayOfWeek, periodLabel and subject are required.' }, { status: 400 });
  }
  const { data, error } = await supabaseAdmin
    .from('timetable')
    .insert({ class_id: classId, day_of_week: dayOfWeek, period_label: periodLabel, subject, teacher_name: teacherName || null })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, entry: data });
}

export async function DELETE(request) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });
  }
  const { id } = await request.json();
  const { error } = await supabaseAdmin.from('timetable').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
