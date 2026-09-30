import { NextResponse } from 'next/server';
import supabaseAdmin from '../../../lib/db';
import { getSession } from '../../../lib/session';
import { ALL_CATEGORIES, subjectCategoryFor } from '../../../lib/subjects';

// GET
//   (no studentId) -> { subjects: { Science: [...], Art: [...], Commercial: [...], Junior: [...] } }
//   ?studentId=...  -> { category, subjects: [names] } for that student, resolved
//                      server-side so every caller applies the same JSS/SS rule.
export async function GET(request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });

  const { data, error } = await supabaseAdmin.from('subjects').select('*').order('name');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Build every known category up front. The previous version started from a
  // literal { Science, Art, Commercial } and pushed with `if (byCategory[...])`,
  // which silently discarded any row in a category it didn't already know about
  // — so a Junior subject would have been invisible the moment it was inserted.
  const byCategory = Object.fromEntries(ALL_CATEGORIES.map((c) => [c, []]));
  for (const row of data || []) {
    if (byCategory[row.category]) byCategory[row.category].push(row);
  }

  const { searchParams } = new URL(request.url);
  const studentId = searchParams.get('studentId');

  if (!studentId) {
    return NextResponse.json({ subjects: byCategory });
  }

  // Resolved per-student. Teachers may only look up a student in their own
  // class, mirroring the ownership rule used by /api/attendance and results.
  if (session.role === 'teacher' && session.id !== studentId) {
    const { data: teacher } = await supabaseAdmin
      .from('users').select('class_id').eq('id', session.id).single();
    const { data: target } = await supabaseAdmin
      .from('users').select('class_id, role').eq('id', studentId).single();
    if (!target || target.role !== 'student' || !teacher?.class_id || target.class_id !== teacher.class_id) {
      return NextResponse.json({ error: 'You can only view subjects for students in your own class.' }, { status: 403 });
    }
  }
  if (session.role === 'student' && session.id !== studentId) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });
  }

  const { data: student } = await supabaseAdmin
    .from('users').select('id, class_id, category, full_name').eq('id', studentId).single();
  if (!student) return NextResponse.json({ error: 'Student not found.' }, { status: 404 });

  let className = null;
  if (student.class_id) {
    const { data: klass } = await supabaseAdmin
      .from('classes').select('name').eq('id', student.class_id).maybeSingle();
    className = klass?.name || null;
  }

  const category = subjectCategoryFor({ className, category: student.category });
  return NextResponse.json({
    category,
    className,
    // A null category is a real state (senior student with no stream set yet),
    // so it returns an empty list rather than everything.
    subjects: category ? (byCategory[category] || []).map((s) => s.name) : [],
  });
}

export async function POST(request) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });
  }
  const { category, name } = await request.json();
  if (!ALL_CATEGORIES.includes(category) || !name?.trim()) {
    return NextResponse.json(
      { error: `Category must be one of ${ALL_CATEGORIES.join(', ')} and a subject name is required.` },
      { status: 400 }
    );
  }
  const { data, error } = await supabaseAdmin
    .from('subjects').insert({ category, name: name.trim() }).select().single();
  if (error) {
    // The subjects.category CHECK only allows 'Junior' once
    // supabase/migrations/012_subjects_junior.sql has been run. Until then this
    // is a raw Postgres error, so say what to do rather than leaking it.
    if (error.code === '23514' && /subjects_category_check/.test(error.message || '')) {
      return NextResponse.json(
        { error: 'The database does not allow a Junior category yet. Run supabase/migrations/012_subjects_junior.sql in the Supabase SQL Editor, then try again.' },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, subject: data });
}

export async function DELETE(request) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });
  }
  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: 'Subject id required.' }, { status: 400 });
  const { error } = await supabaseAdmin.from('subjects').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
