// READ-ONLY probe — no inserts/updates/deletes. Used to check how the app names
// classes and subjects before proposing the curriculum migration/seed.
const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');
require('dotenv').config({ path: '.env.local' });

const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
  realtime: { transport: ws },
});

(async () => {
  const classes = await supa.from('classes').select('id, name').order('name');
  if (classes.error) throw new Error('classes: ' + classes.error.message);
  const subjects = await supa.from('subjects').select('id, category, name').order('category, name');
  if (subjects.error) throw new Error('subjects: ' + subjects.error.message);

  console.log('=== classes (' + classes.data.length + ') ===');
  for (const c of classes.data) console.log('  ' + JSON.stringify(c.name) + '   id=' + c.id);

  console.log('\n=== subjects (' + subjects.data.length + ') ===');
  for (const s of subjects.data) console.log('  ' + s.category.padEnd(11) + JSON.stringify(s.name));

  // Free-text subject strings actually in use on the academic tables.
  for (const table of ['results', 'assessments']) {
    const { data, error } = await supa.from(table).select('subject');
    if (error) { console.log('\n=== ' + table + '.subject: ' + error.message + ' ==='); continue; }
    const tally = {};
    for (const r of data) tally[r.subject] = (tally[r.subject] || 0) + 1;
    const rows = Object.entries(tally).sort((a, b) => b[1] - a[1]);
    console.log('\n=== ' + table + '.subject distinct (' + rows.length + ', from ' + data.length + ' rows) ===');
    for (const [name, n] of rows) console.log('  ' + String(n).padStart(4) + '  ' + JSON.stringify(name));
  }

  // Curriculum subject names per level, for the comparison.
  const fs = require('fs');
  const idx = JSON.parse(fs.readFileSync('tmp/curriculum-parse/index.json', 'utf8'));
  console.log('\n=== curriculum subject names per level ===');
  for (const lv of Object.keys(idx)) {
    const names = [...new Set(idx[lv].map(e => e.subject))].sort();
    console.log('  ' + lv + ' (' + names.length + '): ' + names.join(' | '));
  }
})().catch(err => { console.error('FAILED:', err.message); process.exit(1); });
