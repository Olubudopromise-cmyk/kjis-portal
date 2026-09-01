import { createClient } from '@supabase/supabase-js';

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error('Missing Supabase environment variables: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  }

  return createClient(url, key, { auth: { persistSession: false } });
}

// Server-only client. Uses the service-role key, which bypasses Row Level
// Security — that's why this file must NEVER be imported into a 'use client'
// component. Only API routes and Server Components should touch this.
const supabaseAdmin = new Proxy({}, {
  get(_target, prop, _receiver) {
    const client = getSupabaseAdmin();
    const value = client[prop];
    return typeof value === 'function' ? value.bind(client) : value;
  },
});

export default supabaseAdmin;
