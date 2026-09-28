// READ-ONLY account inventory for the manual click-through verification.
// Lists usernames / full names / roles and whether a password hash exists.
// It never prints or copies password hashes.
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');

const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
  realtime: { transport: ws },
});

(async () => {
  const { data, error } = await supa
    .from('users')
    .select('id, role, full_name, username, class_id, category, active, face_photo_url')
    .order('role');
  if (error) {
    console.error('users query failed:', error.message, error.code);
    process.exit(1);
  }
  const byRole = {};
  for (const u of data) {
    (byRole[u.role] = byRole[u.role] || []).push(u);
  }
  for (const [role, rows] of Object.entries(byRole)) {
    console.log(`\n${role} (${rows.length})`);
    for (const r of rows.slice(0, 12)) {
      console.log(
        `  name=${JSON.stringify(r.full_name)} username=${JSON.stringify(r.username)} ` +
        `active=${r.active} face=${!!r.face_photo_url} class_id=${r.class_id || '-'} cat=${r.category || '-'}`
      );
    }
  }

  const { data: classes } = await supa.from('classes').select('id, name').order('name');
  console.log('\nclasses:', (classes || []).map((c) => c.name).join(' | '));

  const { data: settings } = await supa.from('settings').select('key, value');
  console.log('settings:', JSON.stringify(settings));

  // A student whose username is NULL is the case login must keep working.
  const { data: nullU } = await supa
    .from('users')
    .select('full_name, username')
    .eq('role', 'student')
    .is('username', null)
    .limit(3);
  console.log('students with NULL username:', JSON.stringify(nullU));

  const cur = await supa.from('curriculum').select('*', { count: 'exact', head: true });
  console.log('curriculum rows:', cur.error ? `ERROR ${cur.error.message} (${cur.error.code})` : cur.count);
  process.exit(0);
})().catch((e) => { console.error('crashed:', e.message); process.exit(1); });
