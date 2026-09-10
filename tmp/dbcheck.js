require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { realtime: { transport: ws } });

(async () => {
  const { error } = await sb.from('assessments').select('id').limit(1);
  console.log('assessments query error:', error ? `${error.code} ${error.message}` : 'none — table exists');
  const { error: e2 } = await sb.from('student_edits').select('id').limit(1);
  console.log('student_edits query error:', e2 ? `${e2.code} ${e2.message}` : 'none — table exists');
})();
