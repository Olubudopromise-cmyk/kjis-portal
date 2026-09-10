import { NextResponse } from 'next/server';
import supabaseAdmin from '../../../lib/db';
import { getSession } from '../../../lib/session';

export async function GET(request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const studentId = searchParams.get('studentId');
  const subject = searchParams.get('subject');
  const term = searchParams.get('term');

  let allowedIds = [];
  if (session.role === 'student') {
    if (!studentId || studentId !== session.id) {
      return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });
    }
    allowedIds.push(session.id);
  } else if (session.role === 'teacher') {
    if (!studentId) return NextResponse.json({ error: 'studentId required.' }, { status: 400 });
    const { data: teacher } = await supabaseAdmin.from('users').select('class_id').eq('id', session.id).single();
    const { data: student } = await supabaseAdmin.from('users').select('class_id').eq('id', studentId).single();
    if (!teacher?.class_id || !student || student.class_id !== teacher.class_id) {
      return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });
    }
    allowedIds.push(studentId);
  } else if (session.role === 'admin') {
    if (!studentId) return NextResponse.json({ error: 'studentId required.' }, { status: 400 });
    allowedIds.push(studentId);
  } else {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });
  }

  const conditions = supabaseAdmin
    .from('assessments')
    .select('*')
    .eq('student_id', allowedIds[0]);

  if (subject) conditions.eq('subject', subject);
  if (term) conditions.eq('term', term);

  const { data, error } = await conditions.order('created_at', { ascending: false });
  if (error) {
    console.error('[assessments.GET] Supabase error:', error?.message, error?.code);
    return NextResponse.json({ error: 'Could not load assessments.' }, { status: 500 });
  }
  return NextResponse.json({ assessments: data || [] });
}

export async function POST(request) {
  const session = await getSession();
  if (!session || session.role !== 'teacher') {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });
  }

  const { studentId, subject, term, label, score, maxScore } = await request.json();
  if (!studentId || !subject || !term || !label || score == null || maxScore == null) {
    return NextResponse.json({ error: 'studentId, subject, term, label, score and maxScore are required.' }, { status: 400 });
  }

  const { data: teacher } = await supabaseAdmin.from('users').select('class_id').eq('id', session.id).single();
  const { data: student } = await supabaseAdmin.from('users').select('class_id').eq('id', studentId).single();
  if (!teacher?.class_id || !student || student.class_id !== teacher.class_id) {
    return NextResponse.json({ error: 'That student is not in your class.' }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin
    .from('assessments')
    .insert({
      student_id: studentId,
      subject,
      term,
      label,
      score,
      max_score: maxScore,
    })
    .select()
    .single();

  if (error) {
    console.error('[assessments.POST] Supabase error:', error?.message, error?.code);
    return NextResponse.json({ error: 'Could not create assessment.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true, assessment: data });
}

export async function DELETE(request) {
  const session = await getSession();
  if (!session || session.role !== 'teacher') {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });
  }

  const { id, studentId } = await request.json();
  if (!id || !studentId) {
    return NextResponse.json({ error: 'id and studentId are required.' }, { status: 400 });
  }

  const { data: teacher } = await supabaseAdmin.from('users').select('class_id').eq('id', session.id).single();
  const { data: student } = await supabaseAdmin.from('users').select('class_id').eq('id', studentId).single();
  if (!teacher?.class_id || !student || student.class_id !== teacher.class_id) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });
  }

  const { error } = await supabaseAdmin.from('assessments').delete().eq('id', id).eq('student_id', studentId);
  if (error) {
    console.error('[assessments.DELETE] Supabase error:', error?.message, error?.code);
    return NextResponse.json({ error: 'Could not delete assessment.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
