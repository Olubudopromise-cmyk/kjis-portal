import { NextResponse } from 'next/server';
import supabaseAdmin from '../../../lib/db';
import { getSession } from '../../../lib/session';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

// An entry with class_id = NULL applies to every class (assembly, fellowship,
// etc). The admin form sends the sentinel string 'all' instead of a class id; the
// DB stores it as NULL. `class_id IS NULL` is the ONLY thing that marks an entry
// as whole-school, so the label is kept in the `subject` column — no extra column
// and no migration needed.
const ALL_CLASSES = 'all';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ── Who owns what ────────────────────────────────────────────────────────────
// class_id is read from the users table on EVERY request. It is deliberately not
// taken from the session token (which carries only {id, role, name}) and never
// from a request body, so a teacher cannot forge their class and a class
// reassignment takes effect on the next request.
async function actorScope(session) {
  if (session.role === 'admin') {
    return { role: 'admin', ownClassId: null, ownName: null };
  }
  const { data } = await supabaseAdmin
    .from('users')
    .select('class_id, full_name')
    .eq('id', session.id)
    .single();
  return {
    role: session.role,
    ownClassId: data?.class_id || null,
    ownName: data?.full_name || null,
  };
}

// The single choke point for "may this actor write this slot?".
//   targetClassId === null  means a whole-school (All Classes) row.
function canWriteSlot(actor, targetClassId) {
  if (actor.role === 'admin') {
    // Admin owns school-wide entries only; per-class schedules belong to the
    // class teacher.
    return targetClassId === null;
  }
  if (actor.role === 'teacher') {
    // The Boolean() guard is load-bearing: a teacher with NO class assigned has
    // ownClassId === null, which would compare equal to a whole-school target
    // and silently let them create school-wide entries.
    return Boolean(actor.ownClassId) && targetClassId === actor.ownClassId;
  }
  return false; // students never write
}

function forbid(message) {
  return NextResponse.json({ error: message }, { status: 403 });
}

async function classNameMap() {
  const { data } = await supabaseAdmin.from('classes').select('id, name');
  return Object.fromEntries((data || []).map((c) => [c.id, c.name]));
}

// GET ?classId= -> that class's week MERGED with every whole-school entry.
//   admin   -> may inspect any single class (oversight); no classId = whole-school only
//   teacher -> pinned to their own class; any classId in the query is ignored
//   student -> pinned to their own class
export async function GET(request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });

  const actor = await actorScope(session);
  const { searchParams } = new URL(request.url);
  const requested = searchParams.get('classId');

  let classId;
  if (actor.role === 'admin') {
    // This value is interpolated into a PostgREST .or() filter, so make sure it
    // really is a uuid before letting it near the query.
    classId = requested && UUID_RE.test(requested) ? requested : null;
  } else {
    classId = actor.ownClassId;
  }

  let query = supabaseAdmin
    .from('timetable')
    .select('*')
    .order('day_of_week')
    .order('period_label');

  if (classId) {
    query = query.or(`class_id.is.null,class_id.eq.${classId}`);
  } else {
    query = query.is('class_id', null);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ entries: data || [] });
}

// Two entries compete for the same slot when they share a day and a period
// label AND one of them is whole-school (or both belong to the same class). This
// already covers both directions:
//   new row is All Classes  -> matches a class period in ANY class
//   new row is a class period -> matches an All Classes row, or the same class
function findConflicts(existing, { classId, dayOfWeek, periodLabel, ignoreId }) {
  return existing.filter((e) => {
    if (e.id === ignoreId) return false; // an entry never conflicts with itself
    if (e.day_of_week !== dayOfWeek) return false;
    if (e.period_label !== periodLabel) return false;
    const newIsAll = !classId;
    const oldIsAll = !e.class_id;
    return newIsAll || oldIsAll || e.class_id === classId;
  });
}

function describeConflict(entry, classNames) {
  return {
    id: entry.id,
    day: entry.day_of_week,
    period: entry.period_label,
    scope: entry.class_id ? classNames[entry.class_id] || 'another class' : 'All Classes',
    isAllClasses: !entry.class_id,
    label: entry.subject,
    teacher: entry.teacher_name,
  };
}

// Soft conflict check. Returns the list of clashes, or [] when the slot is free.
async function conflictsFor({ classId, dayOfWeek, periodLabel, ignoreId }) {
  const { data, error } = await supabaseAdmin
    .from('timetable')
    .select('*')
    .eq('day_of_week', dayOfWeek)
    .eq('period_label', periodLabel);
  if (error) return { error };
  const clashes = findConflicts(data || [], { classId, dayOfWeek, periodLabel, ignoreId });
  return { clashes, classNames: clashes.length ? await classNameMap() : {} };
}

function conflictResponse(clashes, classNames, isAllClasses) {
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

function validateSlot({ dayOfWeek, periodLabel, subject, isAllClasses }) {
  if (!DAYS.includes(dayOfWeek) || !periodLabel?.trim() || !subject?.trim()) {
    return NextResponse.json(
      { error: isAllClasses
        ? 'A day, period and label are required for a whole-school event.'
        : 'A day, period and subject are required.' },
      { status: 400 }
    );
  }
  return null;
}

// Resolve which class a NEW row will belong to, from who is asking — not from
// the request. Admin -> whole-school only. Teacher -> always their own class.
function targetClassForNewRow(actor, rawClassId) {
  if (actor.role === 'admin') {
    if (rawClassId && rawClassId !== ALL_CLASSES) {
      return { error: 'Admins manage whole-school entries only. Per-class schedules are built by the class teacher.' };
    }
    return { classId: null };
  }
  if (!actor.ownClassId) {
    return { error: 'You are not assigned to a class yet, so you cannot add timetable periods.' };
  }
  if (rawClassId && rawClassId !== ALL_CLASSES && rawClassId !== actor.ownClassId) {
    return { error: 'You can only edit your own class timetable.' };
  }
  return { classId: actor.ownClassId };
}

// POST — add a row. Admin: whole-school only. Teacher: own class only.
export async function POST(request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });

  const actor = await actorScope(session);
  if (actor.role === 'student') return forbid('Students cannot edit the timetable.');

  const { classId: rawClassId, dayOfWeek, periodLabel, subject, confirmOverwrite } = await request.json();

  const target = targetClassForNewRow(actor, rawClassId);
  if (target.error) return forbid(target.error);
  const { classId } = target;
  const isAllClasses = classId === null;

  const invalid = validateSlot({ dayOfWeek, periodLabel, subject, isAllClasses });
  if (invalid) return invalid;
  if (!canWriteSlot(actor, classId)) return forbid('You can only edit your own class timetable.');

  const slot = { classId, dayOfWeek, periodLabel: periodLabel.trim() };
  const { error: conflictError, clashes, classNames } = await conflictsFor(slot);
  if (conflictError) return NextResponse.json({ error: conflictError.message }, { status: 500 });
  if (clashes.length && confirmOverwrite !== true) {
    return conflictResponse(clashes, classNames, isAllClasses);
  }

  const { data, error } = await supabaseAdmin
    .from('timetable')
    .insert({
      class_id: classId,
      day_of_week: dayOfWeek,
      period_label: slot.periodLabel,
      subject: subject.trim(),
      // Recorded from the teacher's own row, ignoring any client value, so a
      // class teacher is always stored as themselves.
      teacher_name: isAllClasses ? null : actor.ownName || null,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, entry: data, savedOverConflict: clashes.length > 0 });
}

// PUT — edit an existing row. Scope comes from the row that ALREADY EXISTS, so
// passing someone else's id cannot rewrite their timetable. class_id is
// immutable: a row can be edited but never moved to another class.
export async function PUT(request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });

  const actor = await actorScope(session);
  if (actor.role === 'student') return forbid('Students cannot edit the timetable.');

  const { id, dayOfWeek, periodLabel, subject, confirmOverwrite } = await request.json();
  if (!id) return NextResponse.json({ error: 'Missing entry id.' }, { status: 400 });

  const { data: existing, error: loadError } = await supabaseAdmin
    .from('timetable').select('*').eq('id', id).maybeSingle();
  if (loadError) return NextResponse.json({ error: loadError.message }, { status: 500 });
  if (!existing) return NextResponse.json({ error: 'Entry not found.' }, { status: 404 });

  if (!canWriteSlot(actor, existing.class_id)) {
    return forbid(existing.class_id
      ? 'You can only edit your own class timetable.'
      : 'Whole-school entries are managed by an administrator.');
  }

  const isAllClasses = existing.class_id === null;
  const invalid = validateSlot({ dayOfWeek, periodLabel, subject, isAllClasses });
  if (invalid) return invalid;

  const slot = { classId: existing.class_id, dayOfWeek, periodLabel: periodLabel.trim(), ignoreId: id };
  const { error: conflictError, clashes, classNames } = await conflictsFor(slot);
  if (conflictError) return NextResponse.json({ error: conflictError.message }, { status: 500 });
  if (clashes.length && confirmOverwrite !== true) {
    return conflictResponse(clashes, classNames, isAllClasses);
  }

  const { data, error } = await supabaseAdmin
    .from('timetable')
    .update({
      day_of_week: dayOfWeek,
      period_label: slot.periodLabel,
      subject: subject.trim(),
      // keep the recorded teacher; a whole-school row stays teacher-less
      ...(isAllClasses ? { teacher_name: null } : {}),
    })
    .eq('id', id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, entry: data, savedOverConflict: clashes.length > 0 });
}

// DELETE — scope-checked against the row that exists. This used to be admin-only
// with no ownership test at all, so any teacher who guessed an id could delete
// another class's period outright.
export async function DELETE(request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });

  const actor = await actorScope(session);
  if (actor.role === 'student') return forbid('Students cannot edit the timetable.');

  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: 'Missing entry id.' }, { status: 400 });

  const { data: existing, error: loadError } = await supabaseAdmin
    .from('timetable').select('id, class_id').eq('id', id).maybeSingle();
  if (loadError) return NextResponse.json({ error: loadError.message }, { status: 500 });
  if (!existing) return NextResponse.json({ error: 'Entry not found.' }, { status: 404 });

  if (!canWriteSlot(actor, existing.class_id)) {
    return forbid(existing.class_id
      ? 'You can only remove periods from your own class timetable.'
      : 'Whole-school entries are managed by an administrator.');
  }

  const { error } = await supabaseAdmin.from('timetable').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
