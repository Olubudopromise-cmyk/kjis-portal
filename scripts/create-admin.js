// One-time setup script — creates your Head Admin account with a properly
// bcrypt-hashed password (never store it as plain text).
//
// Usage (after npm install and setting up .env.local):
//   npm run create-admin -- admin "a-strong-password" "Head Administrator"

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

async function main() {
  const [, , username, password, fullName] = process.argv;
  if (!username || !password) {
    console.log('Usage: npm run create-admin -- <username> <password> "<Full Name>"');
    process.exit(1);
  }
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.log('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local first.');
    process.exit(1);
  }

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const password_hash = await bcrypt.hash(password, 10);

  const { error } = await supabase.from('users').insert({
    role: 'admin',
    username,
    password_hash,
    full_name: fullName || 'Head Administrator',
  });

  if (error) {
    console.error('Failed:', error.message);
    process.exit(1);
  }
  console.log(`Admin account created — sign in with username "${username}" and the password you chose.`);
}

main();
