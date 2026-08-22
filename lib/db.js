import { createClient } from '@supabase/supabase-js';

// Server-only client. Uses the service-role key, which bypasses Row Level
// Security — that's why this file must NEVER be imported into a 'use client'
// component. Only API routes and Server Components should touch this.
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

export default supabaseAdmin;
