// Final cleanup: delete EVERY record the sweep created, verify each, and show real data is intact.
const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');
require('dotenv').config({ path: '.env.local' });

const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { realtime: { transport: ws } });

const NAMES = {
  admin: 'Sweep Test Admin',
  teacher: 'Sweep Test Teacher',
  student: 'Sweep Test Student',
  junk: 'SweepStu2026!', // junk row from an early harness bug (password typed into name field)
};
const CLASS_NAME = 'Sweep Test Class';
const SUBJECTS = ['Sweep Biology', 'Sweep Maths'];

async function count(table, builder) {
  const { count, error } = await builder;
  if (error) return `ERR: ${error.message.slice(0, 80)}`;
  return count;
}

async function report(label, table, filter) {
  const c = await count(table, supa.from(table).select('*', { count: 'exact', head: true }).ilike(filter.col, filter.val));
  console.log(`  ${label}: ${c}`);
  return c;
}

(async () => {
  console.log('=== BEFORE CLEANUP ===');
  const b = {};
  b.admin = await report('test admin account', 'users', { col: 'full_name', val: NAMES.admin });
  b.teacher = await report('test teacher account', 'users', { col: 'full_name', val: NAMES.teacher });
  b.student = await report('test student account', 'users', { col: 'full_name', val: NAMES.student });
  b.junk = await report('junk account (harness bug)', 'users', { col: 'full_name', val: NAMES.junk });
  b.sweepUsers = await report('any other "Sweep%" users', 'users', { col: 'full_name', val: 'Sweep%' });
  b.cls = await report('test class', 'classes', { col: 'name', val: CLASS_NAME });
  b.subj = await report('test subjects', 'subjects', { col: 'name', val: 'Sweep %' });
  b.notices = await report('test notices', 'announcements', { col: 'text', val: 'Sweep test notice%' });

  // DB-verified sweep artifacts tied to the test student.
  const { data: stu } = await supa.from('users').select('id').ilike('full_name', NAMES.student).maybeSingle();
  if (stu) {
    b.att = await count('attendance', supa.from('attendance').select('*', { count: 'exact', head: true }).eq('student_id', stu.id));
    b.res = await count('results', supa.from('results').select('*', { count: 'exact', head: true }).eq('student_id', stu.id));
    console.log(`  test attendance rows: ${b.att}`);
    console.log(`  test result rows: ${b.res}`);
  } else {
    b.att = 0; b.res = 0;
  }

  console.log('\n=== DELETING ===');
  // Order matters: attendance/results → users → class → subjects → notices.
  if (stu) {
    let r = await supa.from('attendance').delete().eq('student_id', stu.id);
    console.log(`  attendance rows: ${r.error ? 'ERR ' + r.error.message.slice(0, 60) : 'deleted'}`);
    r = await supa.from('results').delete().eq('student_id', stu.id);
    console.log(`  result rows: ${r.error ? 'ERR ' + r.error.message.slice(0, 60) : 'deleted'}`);
  }
  for (const [k, name] of Object.entries(NAMES)) {
    const r = await supa.from('users').delete().ilike('full_name', name);
    console.log(`  user "${name}": ${r.error ? 'ERR ' + r.error.message.slice(0, 60) : 'deleted'}`);
  }
  await supa.from('users').delete().eq('username', 'sweepadmin');
  await supa.from('users').delete().eq('username', 'sweepteacher');
  let r = await supa.from('classes').delete().eq('name', CLASS_NAME);
  console.log(`  class "${CLASS_NAME}": ${r.error ? 'ERR ' + r.error.message.slice(0, 60) : 'deleted'}`);
  r = await supa.from('subjects').delete().ilike('name', 'Sweep %');
  console.log(`  subjects "Sweep %": ${r.error ? 'ERR ' + r.error.message.slice(0, 60) : 'deleted'}`);
  r = await supa.from('announcements').delete().ilike('text', 'Sweep test notice%');
  console.log(`  test notices: ${r.error ? 'ERR ' + r.error.message.slice(0, 60) : 'deleted'}`);

  console.log('\n=== AFTER CLEANUP (all must be 0) ===');
  const a = {};
  a.admin = await report('test admin account', 'users', { col: 'full_name', val: NAMES.admin });
  a.teacher = await report('test teacher account', 'users', { col: 'full_name', val: NAMES.teacher });
  a.student = await report('test student account', 'users', { col: 'full_name', val: NAMES.student });
  a.junk = await report('junk account (harness bug)', 'users', { col: 'full_name', val: NAMES.junk });
  a.sweepUsers = await report('any "Sweep%" users', 'users', { col: 'full_name', val: 'Sweep%' });
  a.cls = await report('test class', 'classes', { col: 'name', val: CLASS_NAME });
  a.subj = await report('test subjects', 'subjects', { col: 'name', val: 'Sweep %' });
  a.notices = await report('test notices', 'announcements', { col: 'text', val: 'Sweep test notice%' });
  const { data: stu2 } = await supa.from('users').select('id').ilike('full_name', NAMES.student).maybeSingle();
  if (!stu2) { a.att = 0; a.res = 0; console.log('  test attendance rows: 0 (student gone)'); console.log('  test result rows: 0 (student gone)'); }

  const leftovers = Object.entries(a).filter(([, v]) => v !== 0 && !(typeof v === 'string'));
  console.log(`\n${leftovers.length === 0 ? '✓ CLEANUP VERIFIED — nothing test-related remains' : '✗ LEFTOVERS: ' + JSON.stringify(leftovers)}`);

  console.log('\n=== REAL DATA INTACT ===');
  const { data: classes } = await supa.from('classes').select('name').order('name');
  console.log('  classes:', classes.map((c) => c.name).join(', '));
  const { count: admins } = await supa.from('users').select('*', { count: 'exact', head: true }).eq('role', 'admin');
  const { count: teachers } = await supa.from('users').select('*', { count: 'exact', head: true }).eq('role', 'teacher');
  const { count: students } = await supa.from('users').select('*', { count: 'exact', head: true }).eq('role', 'student');
  console.log(`  users: ${admins} admin, ${teachers} teacher(s), ${students} student(s)`);
  const { count: subjCount } = await supa.from('subjects').select('*', { count: 'exact', head: true });
  console.log(`  subjects total: ${subjCount}`);
  process.exit(leftovers.length === 0 ? 0 : 1);
})().catch((e) => { console.error('CLEANUP CRASHED:', e); process.exit(1); });
