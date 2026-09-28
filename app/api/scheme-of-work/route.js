import { NextResponse } from 'next/server';
import supabaseAdmin from '../../../lib/db';
import { getSession } from '../../../lib/session';
import { classLevelForClassName, termNameForSession } from '../../../lib/curriculum';

// GET — the signed-in student's scheme of work for the current term.
// Returns one entry per subject, each with its weeks (topics) for the term.
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });

  // Resolve the student's class -> curriculum class_level.
  const { data: student, error: studentError } = await supabaseAdmin
    .from('users')
    .select('class_id')
    .eq('id', session.id)
    .single();
  if (studentError || !student?.class_id) {
    return NextResponse.json({ error: 'Class not found.' }, { status: 404 });
  }

  const { data: classRow, error: classError } = await supabaseAdmin
    .from('classes')
    .select('name')
    .eq('id', student.class_id)
    .single();
  if (classError || !classRow?.name) {
    return NextResponse.json({ error: 'Class not found.' }, { status: 404 });
  }

  const classLevel = classLevelForClassName(classRow.name);
  if (!classLevel) {
    return NextResponse.json({ error: 'Class level not recognised.' }, { status: 404 });
  }

  // Resolve the current term -> curriculum term name.
  const { data: termRow } = await supabaseAdmin
    .from('settings')
    .select('value')
    .eq('key', 'current_term')
    .maybeSingle();
  const term = termNameForSession(termRow?.value);
  if (!term) {
    return NextResponse.json({ error: 'Current term not set.' }, { status: 404 });
  }

  const { data: rows, error } = await supabaseAdmin
    .from('curriculum')
    .select('subject, subject_key, week_start, week_end, is_break, topics, breakdown')
    .eq('class_level', classLevel)
    .eq('term', term)
    .order('subject')
    .order('week_start');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Group weeks by subject, preserving first-seen order.
  const bySubject = new Map();
  for (const row of rows || []) {
    if (!bySubject.has(row.subject)) {
      bySubject.set(row.subject, { subject: row.subject, subjectKey: row.subject_key, weeks: [] });
    }
    bySubject.get(row.subject).weeks.push({
      weekStart: row.week_start,
      weekEnd: row.week_end,
      isBreak: row.is_break,
      topics: row.topics || {},
      breakdown: row.breakdown || null,
    });
  }

  return NextResponse.json({
    classLevel,
    term,
    subjects: [...bySubject.values()],
  });
}
