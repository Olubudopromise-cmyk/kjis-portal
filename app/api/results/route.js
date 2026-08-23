import { NextResponse } from 'next/server';
import supabaseAdmin from '../../../lib/db';
import { getSession } from '../../../lib/session';

// GET ?studentId= -> that student's results (self, their teacher, or admin)
export async function GET(request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const studentId = searchParams.get('studentId');
  if (!studentId) return NextResponse.json({ error: 'studentId is required.' }, { status: 400 });
  if (session.role === 'student' && session.id !== studentId) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin.from('results').select('subject, ca, exam').eq('student_id', studentId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ results: data });
}

// Teacher saves one subject's CA/exam score for one of their students.
export async function POST(request) {
  const session = await getSession();
  if (!session || session.role !== 'teacher') {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });
  }

  const { studentId, subject, ca, exam } = await request.json();
  if (!studentId || !subject) {
    return NextResponse.json({ error: 'studentId and subject are required.' }, { status: 400 });
  }

  // Confirm this student is actually in the teacher's own class.
  const { data: teacher } = await supabaseAdmin.from('users').select('class_id').eq('id', session.id).single();
  const { data: student } = await supabaseAdmin.from('users').select('class_id').eq('id', studentId).single();
  if (!teacher?.class_id || teacher.class_id !== student?.class_id) {
    return NextResponse.json({ error: 'That student is not in your class.' }, { status: 403 });
  }

  const { error } = await supabaseAdmin
    .from('results')
    .upsert({ student_id: studentId, subject, ca, exam }, { onConflict: 'student_id,subject' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
