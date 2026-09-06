import { NextResponse } from 'next/server';
import supabaseAdmin from '../../../lib/db';
import { getSession } from '../../../lib/session';

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin.from('classes').select('*').order('name');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ classes: data });
}

export async function POST(request) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });
  }
  const { name } = await request.json();
  if (!name) return NextResponse.json({ error: 'Class name required.' }, { status: 400 });

  const { data, error } = await supabaseAdmin.from('classes').insert({ name }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, class: data });
}

// Admin only — delete a class. Refuses when the class still has students,
// teachers, or attendance records (the FKs from users/attendance don't
// cascade). Timetable entries cascade in the DB and are removed silently.
export async function DELETE(request) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });
  }

  const { classId } = await request.json();
  if (!classId) {
    return NextResponse.json({ error: 'Missing class ID.' }, { status: 400 });
  }

  const { data: existing, error: lookupError } = await supabaseAdmin
    .from('classes')
    .select('id, name')
    .eq('id', classId)
    .maybeSingle();
  if (lookupError) return NextResponse.json({ error: lookupError.message }, { status: 500 });
  if (!existing) return NextResponse.json({ error: 'Class not found.' }, { status: 404 });

  const [{ count: studentCount }, { count: teacherCount }, { count: attendanceCount }] = await Promise.all([
    supabaseAdmin.from('users').select('id', { count: 'exact', head: true }).eq('class_id', classId).eq('role', 'student'),
    supabaseAdmin.from('users').select('id', { count: 'exact', head: true }).eq('class_id', classId).eq('role', 'teacher'),
    supabaseAdmin.from('attendance').select('id', { count: 'exact', head: true }).eq('class_id', classId),
  ]);

  const blockers = [];
  if (studentCount > 0) blockers.push(`${studentCount} student${studentCount === 1 ? '' : 's'}`);
  if (teacherCount > 0) blockers.push(`${teacherCount} teacher${teacherCount === 1 ? '' : 's'}`);
  if (attendanceCount > 0) blockers.push('attendance records');
  if (blockers.length) {
    return NextResponse.json(
      { error: `Cannot delete "${existing.name}" — it still has ${blockers.join(' and ')}. Move them to another class first.` },
      { status: 409 }
    );
  }

  const { error: deleteError } = await supabaseAdmin.from('classes').delete().eq('id', classId);
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
