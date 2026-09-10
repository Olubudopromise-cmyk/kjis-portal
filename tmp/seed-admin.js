// Creates ONE clearly-marked test admin account for the click-through sweep.
// (The real 'admin' account's password is unknown to me — deliberately left alone.)
// Usage: node tmp/seed-admin.js
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
const ws = require('ws');

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { realtime: { transport: ws } });

(async () => {
  const username = 'sweepadmin';
  const password = 'SweepTest2026!x';

  // Reuse if a previous run left it behind.
  const { data: existing } = await sb.from('users').select('id, username').eq('username', username).maybeSingle();
  if (existing) {
    console.log('sweepadmin already exists:', existing.id);
    return;
  }

  const password_hash = await bcrypt.hash(password, 10);
  const { data, error } = await sb.from('users').insert({
    role: 'admin',
    username,
    email: 'sweepadmin@test.invalid',
    password_hash,
    full_name: 'Sweep Test Admin',
  }).select('id').single();

  if (error) {
    console.error('Failed to create sweepadmin:', error.message);
    process.exit(1);
  }
  console.log('created sweepadmin:', data.id);
})();
