import { NextResponse } from 'next/server';
import { getSession } from '../../../../lib/session';
import supabaseAdmin from '../../../../lib/db';

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export async function GET(request) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date') || todayISO();

  const { data: classes } = await supabaseAdmin
    .from('classes')
    .select('id, name')
    .order('name');

  if (!classes || !classes.length) {
    return NextResponse.json({ rows: [] });
  }

  const classIds = classes.map((c) => c.id);
  const { data: activeStudents } = await supabaseAdmin
    .from('users')
    .select('id, class_id')
    .eq('role', 'student')
    .eq('active', true)
    .in('class_id', classIds);

  const totalByClass = {};
  const presentByClass = {};
  const absentByClass = {};
  for (const c of classes) {
    totalByClass[c.id] = 0;
    presentByClass[c.id] = 0;
    absentByClass[c.id] = 0;
  }

  (activeStudents || []).forEach((u) => {
    if (totalByClass[u.class_id] != null) totalByClass[u.class_id]++;
  });

  const { data: marks } = await supabaseAdmin
    .from('attendance')
    .select('class_id, student_id, status')
    .eq('date', date)
    .in('class_id', classIds);

  (marks || []).forEach((m) => {
    if (presentByClass[m.class_id] == null) return;
    if (m.status === 'present') presentByClass[m.class_id]++;
    if (m.status === 'absent') absentByClass[m.class_id]++;
  });

  const rows = classes.map((c) => {
    const total = totalByClass[c.id] || 0;
    const present = presentByClass[c.id] || 0;
    const absent = absentByClass[c.id] || 0;
    const unmarked = total - present - absent;
    const rate = total ? Math.round((present / total) * 100) : 0;
    return { classId: c.id, className: c.name, present, absent, unmarked, total, rate };
  });

  return NextResponse.json({ rows, date });
}
