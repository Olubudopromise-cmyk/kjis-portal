import { NextResponse } from 'next/server';
import supabaseAdmin from '../../../lib/db';
import { hashPassword } from '../../../lib/password';
import { getSession } from '../../../lib/session';

// List students — used for admin's full table, and for a teacher's own
// class roster (attendance/results screens pass ?classId=).
export async function GET(request) {
  const session = await getSession();
  if (!session || !['admin', 'teacher'].includes(session.role)) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  let classId = searchParams.get('classId');

  // Teachers can only ever list their own class, regardless of what's asked for.
  if (session.role === 'teacher') {
    const { data: teacher } = await supabaseAdmin.from('users').select('class_id').eq('id', session.id).single();
    if (!teacher?.class_id) return NextResponse.json({ students: [] }); // not assigned to a class yet — see nobody, not everybody
    classId = teacher.class_id;
  }

  let query = supabaseAdmin
    .from('users')
    .select('id, full_name, class_id, category, total_fee, paid, admission_no')
    .eq('role', 'student')
    .order('full_name');
  if (classId) query = query.eq('class_id', classId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ students: data });
}

// Admin only — student registration is no longer open to teachers.
export async function POST(request) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });
  }

  const body = await request.json();
  const { fullName, password, classId, category, totalFee, admissionNo, facePhotoBase64 } = body;

  if (!fullName || !password) {
    return NextResponse.json({ error: 'Full name and password are required.' }, { status: 400 });
  }

  let effectiveClassId = classId || null;

  const { data: existing } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('role', 'student')
    .ilike('full_name', fullName.trim())
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: 'A student with this exact name already exists. Add a middle name or initial to tell them apart.' },
      { status: 409 }
    );
  }

  const password_hash = await hashPassword(password);
  const { data, error } = await supabaseAdmin
    .from('users')
    .insert({
      role: 'student',
      full_name: fullName.trim(),
      password_hash,
      class_id: effectiveClassId,
      category: category || null,
      total_fee: totalFee || 0,
      paid: 0,
      admission_no: admissionNo || null,
    })
    .select('id, full_name, class_id, category, total_fee, paid, admission_no, face_photo_url')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Optional reference photo, used later at login for face verification
  // (see /api/auth/face-verify). Stored in a private Supabase Storage
  // bucket — never made public.
  if (facePhotoBase64) {
    try {
      const base64Data = facePhotoBase64.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      const path = `${data.id}.jpg`;
      const { error: uploadError } = await supabaseAdmin.storage
        .from('student-faces')
        .upload(path, buffer, { contentType: 'image/jpeg', upsert: true });
      if (!uploadError) {
        await supabaseAdmin.from('users').update({ face_photo_url: path }).eq('id', data.id);
        data.face_photo_url = path;
      }
    } catch {
      // Student record already exists at this point — don't fail the whole
      // request over a photo upload issue; they can add it later.
    }
  }

  return NextResponse.json({ ok: true, student: data });
}

// Admin or teacher resetting a student's password directly.
export async function PUT(request) {
  const session = await getSession();
  if (!session || !['admin', 'teacher'].includes(session.role)) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });
  }

  const { studentId, newPassword } = await request.json();

  if (!studentId || !newPassword) {
    return NextResponse.json({ error: 'Missing student ID or new password.' }, { status: 400 });
  }

  if (typeof newPassword !== 'string' || newPassword.length < 4) {
    return NextResponse.json({ error: 'Password must be at least 4 characters.' }, { status: 400 });
  }

  // Verify the student exists and belongs to the teacher's class (if teacher).
  const { data: student, error: lookupError } = await supabaseAdmin
    .from('users')
    .select('id, class_id')
    .eq('id', studentId)
    .eq('role', 'student')
    .maybeSingle();

  if (lookupError || !student) {
    return NextResponse.json({ error: 'Student not found.' }, { status: 404 });
  }

  if (session.role === 'teacher') {
    const { data: teacher } = await supabaseAdmin.from('users').select('class_id').eq('id', session.id).single();
    if (!teacher?.class_id || student.class_id !== teacher.class_id) {
      return NextResponse.json({ error: 'You can only reset passwords for students in your own class.' }, { status: 403 });
    }
  }

  const password_hash = await hashPassword(newPassword);
  const { error: updateError } = await supabaseAdmin
    .from('users')
    .update({ password_hash })
    .eq('id', studentId);

  if (updateError) {
    console.error('Failed to reset student password:', updateError);
    return NextResponse.json({ error: 'Could not update password.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
