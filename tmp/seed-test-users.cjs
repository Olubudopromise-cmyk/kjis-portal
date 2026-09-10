// Run from project root so it can use the project's own modules
const { hashPassword } = require('./lib/password');
const supabaseAdmin = require('./lib/db').default;

async function seed() {
  const users = [
    { full_name: 'Test Student', username: 'student', email: 'student@school.com', role: 'student', class_id: null, category: 'Science', total_fee: 50000, paid: 25000, admission_no: 'STU001' },
    { full_name: 'Test Teacher', username: 'teacher', email: 'teacher@school.com', role: 'teacher', class_id: null },
    { full_name: 'Head Admin', username: 'admin', email: 'admin@school.com', role: 'admin', class_id: null },
  ];

  const password = 'password';

  for (const u of users) {
    const hash = await hashPassword(password);
    const { data: existing, error: exErr } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('full_name', u.full_name)
      .maybeSingle();

    if (existing) {
      console.log('Updating:', u.full_name);
      await supabaseAdmin.from('users').update({
        password_hash: hash,
        role: u.role,
        category: u.category || null,
        total_fee: u.total_fee || null,
        paid: u.paid || null,
        admission_no: u.admission_no || null,
        active: true,
      }).eq('id', existing.id);
    } else {
      console.log('Creating:', u.full_name);
      await supabaseAdmin.from('users').insert({
        ...u,
        password_hash: hash,
        active: true,
      });
    }
  }

  // Classes
  const { data: classes } = await supabaseAdmin.from('classes').select('id').order('name');
  if (!classes || classes.length === 0) {
    console.log('Creating classes...');
    for (const name of ['JSS 1A', 'JSS 2A', 'SSS 1A']) {
      await supabaseAdmin.from('classes').insert({ name });
    }
  }

  // Subjects
  const { data: subs } = await supabaseAdmin.from('subjects').select('*');
  const hasSubs = subs && subs.length > 0;
  if (!hasSubs) {
    console.log('Creating subjects...');
    const data = {
      Science: ['Physics', 'Chemistry', 'Biology', 'Mathematics'],
      Art: ['Literature', 'History', 'Government', 'CRS'],
      Commercial: ['Economics', 'Accounting', 'Commerce', 'Business Studies'],
    };
    for (const [cat, names] of Object.entries(data)) {
      for (const name of names) {
        await supabaseAdmin.from('subjects').insert({ category: cat, name });
      }
    }
  }

  // Assign students to a class
  const { data: studentRows } = await supabaseAdmin.from('users').select('id, class_id').eq('role', 'student');
  if (studentRows && studentRows.length > 0 && !studentRows[0].class_id) {
    const { data: classes2 } = await supabaseAdmin.from('classes').select('id').limit(1);
    if (classes2 && classes2.length > 0) {
      await supabaseAdmin.from('users').update({ class_id: classes2[0].id }).eq('role', 'student');
      console.log('Assigned students to class');
    }
  }

  // Assign teacher to a class
  const { data: teacherRows } = await supabaseAdmin.from('users').select('id, class_id').eq('role', 'teacher');
  if (teacherRows && teacherRows.length > 0 && !teacherRows[0].class_id) {
    const { data: classes3 } = await supabaseAdmin.from('classes').select('id').limit(1);
    if (classes3 && classes3.length > 0) {
      await supabaseAdmin.from('users').update({ class_id: classes3[0].id }).eq('role', 'teacher');
      console.log('Assigned teacher to class');
    }
  }

  console.log('Done seeding.');
}

seed().catch(e => { console.error('Seed failed:', e.message); process.exit(1); });
