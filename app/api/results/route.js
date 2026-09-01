import { NextResponse } from 'next/server';
import supabaseAdmin from '../../../lib/db';
import { getSession } from '../../../lib/session';

async function currentTerm() {
  const { data } = await supabaseAdmin.from('settings').select('value').eq('key', 'current_term').maybeSingle();
  return data?.value || 'First Term 2025/2026';
}

// GET ?studentId=&term=          -> one term's results for a student
// GET ?studentId=&listTerms=true -> the distinct terms this student has any results for
export async function GET(request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const studentId = searchParams.get('studentId');
  if (!studentId) return NextResponse.json({ error: 'studentId is required.' }, { status: 400 });
  if (session.role === 'student' && session.id !== studentId) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });
  }
  if (session.role === 'teacher') {
    const { data: student } = await supabaseAdmin.from('users').select('class_id').eq('id', studentId).single();
    const { data: teacher } = await supabaseAdmin.from('users').select('class_id').eq('id', session.id).single();
    if (!student || !teacher || student.class_id !== teacher.class_id) {
      return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });
    }
  }

  if (searchParams.get('listTerms') === 'true') {
    const { data, error } = await supabaseAdmin.from('results').select('term').eq('student_id', studentId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const terms = [...new Set((data || []).map((r) => r.term))];
    const term = await currentTerm();
    if (!terms.includes(term)) terms.unshift(term); // always offer the current term, even with no scores yet
    return NextResponse.json({ terms, currentTerm: term });
  }

  const term = searchParams.get('term') || (await currentTerm());
  const { data, error } = await supabaseAdmin
    .from('results')
    .select('subject, ca, exam, term')
    .eq('student_id', studentId)
    .eq('term', term);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ results: data, term });
}

// Teacher saves one subject's CA/exam score for one of their students.
// Always writes against the school's current term — historical terms are read-only.
export async function POST(request) {
  const session = await getSession();
  if (!session || session.role !== 'teacher') {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });
  }

  const { studentId, subject, ca, exam } = await request.json();
  if (!studentId || !subject) {
    return NextResponse.json({ error: 'studentId and subject are required.' }, { status: 400 });
  }

  const { data: teacher } = await supabaseAdmin.from('users').select('class_id').eq('id', session.id).single();
  const { data: student } = await supabaseAdmin.from('users').select('class_id').eq('id', studentId).single();
  if (!teacher?.class_id || teacher.class_id !== student?.class_id) {
    return NextResponse.json({ error: 'That student is not in your class.' }, { status: 403 });
  }

  const term = await currentTerm();
  const { error } = await supabaseAdmin
    .from('results')
    .upsert({ student_id: studentId, subject, ca, exam, term }, { onConflict: 'student_id,subject,term' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, term });
}
