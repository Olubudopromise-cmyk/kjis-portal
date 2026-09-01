import { NextResponse } from 'next/server';
import supabaseAdmin from '../../../lib/db';
import { getSession } from '../../../lib/session';

async function teacherClassId(session) {
  const { data } = await supabaseAdmin.from('users').select('class_id').eq('id', session.id).single();
  return data?.class_id || null;
}

async function teacherMayAccessStudent(session, studentId) {
  if (session.role === 'admin') return true;
  if (session.role === 'student') return session.id === studentId;
  if (session.role === 'teacher') {
    const { data: student } = await supabaseAdmin.from('users').select('class_id').eq('id', studentId).single();
    const teacherClassId = await teacherClassId(session);
    return Boolean(student && teacherClassId && student.class_id === teacherClassId);
  }
  return false;
}

// GET ?classId=&date=          -> one day's records for a class (teacher)
// GET ?studentId=              -> a student's full attendance history (self, or admin)
export async function GET(request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const studentId = searchParams.get('studentId');
  const classId = searchParams.get('classId');
  const date = searchParams.get('date');

  if (studentId) {
    const allowed = await teacherMayAccessStudent(session, studentId);
    if (!allowed) {
      return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });
    }
    const { data, error } = await supabaseAdmin
      .from('attendance')
      .select('date, status')
      .eq('student_id', studentId)
      .order('date', { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ records: data });
  }

  if (classId && date) {
    if (session.role === 'teacher') {
      const teacherClass = await teacherClassId(session);
      if (!teacherClass || teacherClass !== classId) {
        return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });
      }
    }
    const { data, error } = await supabaseAdmin
      .from('attendance')
      .select('student_id, status')
      .eq('class_id', classId)
      .eq('date', date);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ records: data });
  }

  return NextResponse.json({ error: 'Provide studentId, or classId and date.' }, { status: 400 });
}

// Teacher marks attendance for their own class on a given date.
export async function POST(request) {
  const session = await getSession();
  if (!session || session.role !== 'teacher') {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });
  }

  const { date, records } = await request.json(); // records: { studentId: 'present'|'absent' }
  if (!date || !records) {
    return NextResponse.json({ error: 'Date and records are required.' }, { status: 400 });
  }

  const classId = await teacherClassId(session);
  if (!classId) return NextResponse.json({ error: 'You are not assigned to a class.' }, { status: 400 });

  const rows = Object.entries(records).map(([studentId, status]) => ({
    class_id: classId,
    student_id: studentId,
    date,
    status,
  }));

  const { error } = await supabaseAdmin
    .from('attendance')
    .upsert(rows, { onConflict: 'class_id,student_id,date' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
