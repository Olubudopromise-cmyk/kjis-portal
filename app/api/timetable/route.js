import { NextResponse } from 'next/server';
import supabaseAdmin from '../../../lib/db';
import { getSession } from '../../../lib/session';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

// An entry with class_id = NULL applies to every class (assembly, fellowship,
// etc). The admin form sends the sentinel string 'all' instead of a class id;
// the DB stores it as NULL. `class_id IS NULL` is the ONLY thing that marks an
// entry as whole-school, so the label is kept in the `subject` column — no extra
// column and no migration needed.
const ALL_CLASSES = 'all';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Only an admin may ask for a specific class; students and teachers are always
// pinned to their own (see resolveClassId).
async function resolveClassId(session, requested) {
  if (session.role === 'admin') return requested || null;
  const { data } = await supabaseAdmin
    .from('users')
    .select('class_id')
    .eq('id', session.id)
    .single();
  return data?.class_id || null;
}

async function classNameMap() {
  const { data } = await supabaseAdmin.from('classes').select('id, name');
  return Object.fromEntries((data || []).map((c) => [c.id, c.name]));
}

// GET ?classId= -> that class's week MERGED with every whole-school entry.
// Admin with no classId -> just the whole-school entries.
export async function GET(request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const requested = searchParams.get('classId');
  // An untrusted classId goes into a PostgREST .or() filter below, so make sure
  // it really is a uuid before letting it near the query.
  const classId = await resolveClassId(
    session,
    session.role === 'admin' && requested && UUID_RE.test(requested) ? requested : null
  );

  let query = supabaseAdmin
    .from('timetable')
    .select('*')
    .order('day_of_week')
    .order('period_label');

  if (classId) {
    // The class's own periods plus every whole-school event.
    query = query.or(`class_id.is.null,class_id.eq.${classId}`);
  } else {
    query = query.is('class_id', null);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ entries: data || [] });
}

// Two entries compete for the same slot when they share a day and a period
// label AND one of them is whole-school (or both belong to the same class).
// A whole-school event overlapping a class's lesson is the case that matters —
// assembly shouldn't silently sit on top of a scheduled subject.
function findConflicts(existing, { classId, dayOfWeek, periodLabel }) {
  return existing.filter((e) => {
    if (e.day_of_week !== dayOfWeek) return false;
    if (e.period_label !== periodLabel) return false;
    const newIsAll = !classId;
    const oldIsAll = !e.class_id;
    return newIsAll || oldIsAll || e.class_id === classId;
  });
}

function describeConflict(entry, classNames) {
  const scope = entry.class_id ? classNames[entry.class_id] || 'another class' : 'All Classes';
  return {
    id: entry.id,
    day: entry.day_of_week,
    period: entry.period_label,
    scope,
    isAllClasses: !entry.class_id,
    label: entry.subject,
    teacher: entry.teacher_name,
  };
}

export async function POST(request) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });
  }

  const { classId: rawClassId, dayOfWeek, periodLabel, subject, teacherName, confirmOverwrite } =
    await request.json();

  const classId = rawClassId === ALL_CLASSES || !rawClassId ? null : rawClassId;
  const isAllClasses = classId === null;

  if (!DAYS.includes(dayOfWeek) || !periodLabel?.trim() || !subject?.trim()) {
    return NextResponse.json(
      { error: isAllClasses
        ? 'A day, period and label are required for a whole-school event.'
        : 'A day, period and subject are required.' },
      { status: 400 }
    );
  }
  if (classId && !UUID_RE.test(classId)) {
    return NextResponse.json({ error: 'Invalid class ID.' }, { status: 400 });
  }

  // Soft warning, never a hard block. The first attempt returns 409 with the
  // list of clashes; the admin can then confirm and we re-post with
  // confirmOverwrite to actually save.
  const { data: sameSlot, error: slotError } = await supabaseAdmin
    .from('timetable')
    .select('*')
    .eq('day_of_week', dayOfWeek)
    .eq('period_label', periodLabel.trim());
  if (slotError) return NextResponse.json({ error: slotError.message }, { status: 500 });

  const clashes = findConflicts(sameSlot || [], { classId, dayOfWeek, periodLabel: periodLabel.trim() });
  if (clashes.length && confirmOverwrite !== true) {
    const classNames = await classNameMap();
    return NextResponse.json(
      {
        needsConfirmation: true,
        conflicts: clashes.map((e) => describeConflict(e, classNames)),
        message: isAllClasses
          ? `This whole-school event overlaps ${clashes.length} existing entr${clashes.length === 1 ? 'y' : 'ies'} in that slot.`
          : `This period overlaps ${clashes.length} existing entr${clashes.length === 1 ? 'y' : 'ies'} in that slot.`,
      },
      { status: 409 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from('timetable')
    .insert({
      class_id: classId,
      day_of_week: dayOfWeek,
      period_label: periodLabel.trim(),
      subject: subject.trim(),
      teacher_name: isAllClasses ? null : teacherName?.trim() || null,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, entry: data, savedOverConflict: clashes.length > 0 });
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
