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
    .select('id, full_name, class_id, category, total_fee, paid, admission_no, active')
    .eq('role', 'student')
    .order('full_name');
  if (classId) query = query.eq('class_id', classId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ students: data });
}

// Admin only — student registration is no longer open to teachers.
//
// A student's password IS their Admission No. (school policy), so the admin
// never types a password: whatever Admission No. is entered is what gets
// hashed into password_hash. Only the hash is stored (schema: password_hash,
// "bcrypt hash, never plain text"); the plaintext admission number the caller
// already typed is echoed back in the response so the UI can show it.
export async function POST(request) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });
  }

  const body = await request.json();
  const { fullName, classId, category, totalFee, admissionNo, faceConsent, facePhotoBase64 } = body;

  if (!fullName || !fullName.trim()) {
    return NextResponse.json({ error: 'Full name is required.' }, { status: 400 });
  }

  // Required, because it doubles as the login password.
  if (typeof admissionNo !== 'string' || !admissionNo.trim()) {
    return NextResponse.json({ error: 'Admission No. is required — it is the student’s password.' }, { status: 400 });
  }
  const plainPassword = admissionNo.trim();

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

  // Two students sharing an Admission No. would share a password, so treat a
  // case-insensitive clash as a duplicate. Backed by a unique index in
  // supabase/migrations/011_admission_no_unique.sql once that has been run.
  const { data: admissionClash } = await supabaseAdmin
    .from('users')
    .select('id, full_name')
    .eq('role', 'student')
    .ilike('admission_no', plainPassword)
    .maybeSingle();

  if (admissionClash) {
    return NextResponse.json(
      { error: `Admission No. "${plainPassword}" is already used by ${admissionClash.full_name}. Admission numbers double as passwords, so they must be unique.` },
      { status: 409 }
    );
  }

  const password_hash = await hashPassword(plainPassword);
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
      admission_no: plainPassword,
      face_consent: faceConsent === true,
    })
    .select('id, full_name, class_id, category, total_fee, paid, admission_no, face_photo_url')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Optional reference photo, used later at login for face verification
  // (see /api/auth/face-verify). Stored in a private Supabase Storage
  // bucket — never made public. Stored ONLY when the admin ticked the
  // guardian-consent box (NDPR); a photo sent without consent is dropped
  // silently and registration continues without it.
  //
  // A failed upload must NOT fail the registration (the student record is
  // already written), but it must never be silent either: the old code
  // swallowed it, so an admin could tick consent, capture a photo, see
  // "registered", and have nothing actually stored. Log the real cause and
  // pass a warning back so the UI can say so.
  let photoWarning = null;
  if (faceConsent === true && facePhotoBase64) {
    try {
      const base64Data = facePhotoBase64.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');

      // Supabase Storage does not care what the bytes are, so a truncated or
      // malformed capture would be stored happily and then fail at login with a
      // confusing "no clear look at your face". Check the magic bytes first.
      // JPEG FF D8 FF, PNG 89 50 4E 47, WEBP 'RIFF'....'WEBP'
      const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
      const isPng = buffer.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
      const isWebp = buffer.subarray(0, 4).toString('ascii') === 'RIFF'
        && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
      if (buffer.length < 4 || !(isJpeg || isPng || isWebp)) {
        console.error('[students] Rejected a face photo that is not a valid image', {
          studentId: data.id, bytes: buffer.length,
        });
        photoWarning = 'The student was registered, but the photo could NOT be saved because it was not a readable image. Retake the photo — face verification will not work until you do.';
      } else {
        const path = `${data.id}.jpg`;
        const { error: uploadError } = await supabaseAdmin.storage
          .from('student-faces')
          .upload(path, buffer, { contentType: isPng ? 'image/png' : isWebp ? 'image/webp' : 'image/jpeg', upsert: true });
        if (uploadError) {
          console.error('[students] Face photo upload failed', {
            studentId: data.id, error: uploadError.message, status: uploadError.statusCode,
            hint: 'Does the private "student-faces" storage bucket exist?',
          });
          photoWarning = 'The student was registered, but their photo could NOT be saved, so face verification will not work for them. Check the server logs.';
        } else {
          const { error: updateError } = await supabaseAdmin
            .from('users').update({ face_photo_url: path }).eq('id', data.id);
          if (updateError) {
            console.error('[students] Face photo uploaded but could not be linked to the student', {
              studentId: data.id, path, error: updateError.message,
            });
            photoWarning = 'The photo uploaded but could not be linked to the student. Face verification will not work until this is fixed.';
          } else {
            data.face_photo_url = path;
          }
        }
      }
    } catch (err) {
      console.error('[students] Face photo upload threw', {
        studentId: data.id, error: err?.message,
      });
      photoWarning = 'The student was registered, but their photo could NOT be saved, so face verification will not work for them. Check the server logs.';
    }
  }

  // `student.admission_no` is the password — the UI reads it from here rather
  // than echoing back its own form value, so the credentials card can only ever
  // show what was actually stored.
  return NextResponse.json({
    ok: true,
    student: data,
    password: data.admission_no,
    ...(photoWarning ? { photoWarning } : {}),
  });
}

// Admin only — edit a student's details and/or deactivate/reactivate them.
// Only the fields present in the request body are updated. `active: false`
// blocks login (see /api/auth/login) but keeps the row and its history.
export async function PATCH(request) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });
  }

  const body = await request.json();
  const { studentId, fullName, classId, category, totalFee, admissionNo, active } = body;

  if (!studentId) {
    return NextResponse.json({ error: 'Missing student ID.' }, { status: 400 });
  }

  // Fetch the current row first so the audit entry can record what each
  // field changed FROM as well as to.
  const { data: before, error: beforeError } = await supabaseAdmin
    .from('users')
    .select('id, full_name, class_id, category, total_fee, paid, admission_no, active')
    .eq('id', studentId)
    .eq('role', 'student')
    .maybeSingle();
  if (beforeError) return NextResponse.json({ error: beforeError.message }, { status: 500 });
  if (!before) return NextResponse.json({ error: 'Student not found.' }, { status: 404 });

  const updates = {};
  if (fullName !== undefined) {
    if (typeof fullName !== 'string' || !fullName.trim()) {
      return NextResponse.json({ error: 'Full name cannot be empty.' }, { status: 400 });
    }
    updates.full_name = fullName.trim();
  }
  if (classId !== undefined) updates.class_id = classId || null;
  if (category !== undefined) updates.category = category || null;
  if (totalFee !== undefined) updates.total_fee = Number(totalFee) || 0;
  if (admissionNo !== undefined) {
    // Required from here on, since it doubles as the password. Changing it
    // does NOT change the password — the admin uses Reset password for that.
    if (typeof admissionNo !== 'string' || !admissionNo.trim()) {
      return NextResponse.json({ error: 'Admission No. cannot be empty — it is the student’s password.' }, { status: 400 });
    }
    updates.admission_no = admissionNo.trim();
    const { data: clash } = await supabaseAdmin
      .from('users')
      .select('id, full_name')
      .eq('role', 'student')
      .ilike('admission_no', updates.admission_no)
      .neq('id', studentId)
      .maybeSingle();
    if (clash) {
      return NextResponse.json(
        { error: `Admission No. "${updates.admission_no}" is already used by ${clash.full_name}. Admission numbers double as passwords, so they must be unique.` },
        { status: 409 }
      );
    }
  }
  if (active !== undefined) {
    if (typeof active !== 'boolean') {
      return NextResponse.json({ error: '"active" must be true or false.' }, { status: 400 });
    }
    updates.active = active;
  }

  if (!Object.keys(updates).length) {
    return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('users')
    .update(updates)
    .eq('id', studentId)
    .eq('role', 'student')
    .select('id, full_name, class_id, category, total_fee, paid, admission_no, active')
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Student not found.' }, { status: 404 });

  // Record what changed (field → { from, to }) in the audit trail. Only
  // fields whose value actually differs are listed, so a no-op save (or a
  // pure toggle to the same state) writes nothing.
  const COLUMN_BY_FIELD = {
    fullName: 'full_name',
    classId: 'class_id',
    category: 'category',
    totalFee: 'total_fee',
    admissionNo: 'admission_no',
    active: 'active',
  };
  const changes = {};
  for (const [field, column] of Object.entries(COLUMN_BY_FIELD)) {
    if (!(column in updates)) continue;
    const beforeVal = before[column] ?? null;
    const afterVal = data[column] ?? null;
    if (String(beforeVal) !== String(afterVal)) {
      changes[field] = { from: beforeVal, to: afterVal };
    }
  }
  if (Object.keys(changes).length) {
    const { error: auditError } = await supabaseAdmin.from('student_edits').insert({
      student_id: studentId,
      editor_id: session.id,
      editor_role: session.role,
      editor_name: session.name || null,
      changes,
    });
    if (auditError) {
      // The edit itself succeeded; log the audit failure but don't fail the request.
      console.error('Failed to write student edit audit entry:', auditError);
    }
  }

  return NextResponse.json({ ok: true, student: data });
}

// Admin or teacher resetting a student's password directly.
//
// Two modes:
//   { useAdmissionNo: true }  — restore school policy: the password becomes the
//     Admission No. again. The value is read from the student's own row, never
//     from the request, and the 4-character floor doesn't apply (the admin
//     isn't picking a weak password, they're undoing a custom one).
//   { newPassword: '...' }    — an explicit custom password instead.
export async function PUT(request) {
  const session = await getSession();
  if (!session || !['admin', 'teacher'].includes(session.role)) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });
  }

  const { studentId, newPassword, useAdmissionNo } = await request.json();

  if (!studentId) {
    return NextResponse.json({ error: 'Missing student ID.' }, { status: 400 });
  }

  const resetToAdmissionNo = useAdmissionNo === true;

  if (!resetToAdmissionNo && (typeof newPassword !== 'string' || newPassword.length < 4)) {
    return NextResponse.json({ error: 'Password must be at least 4 characters.' }, { status: 400 });
  }

  // Verify the student exists and belongs to the teacher's class (if teacher).
  const { data: student, error: lookupError } = await supabaseAdmin
    .from('users')
    .select('id, class_id, admission_no')
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

  const plainPassword = resetToAdmissionNo ? student.admission_no : newPassword.trim();

  if (!plainPassword) {
    return NextResponse.json(
      { error: 'This student has no Admission No. on file, so there is nothing to reset to. Set a custom password instead.' },
      { status: 400 }
    );
  }

  const password_hash = await hashPassword(plainPassword);
  const { error: updateError } = await supabaseAdmin
    .from('users')
    .update({ password_hash })
    .eq('id', studentId);

  if (updateError) {
    console.error('Failed to reset student password:', updateError);
    return NextResponse.json({ error: 'Could not update password.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, resetTo: resetToAdmissionNo ? 'admission_no' : 'custom' });
}
