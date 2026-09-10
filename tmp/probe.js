// Dev-only probe: hit every new-ish backend path once from the same runtime
// the app uses, so we can catch schema/auth path issues before shipping.

import supabaseAdmin from '../lib/db.js';
import { getSession } from '../lib/session.js';

export async function probeAll() {
  const session = await getSession();
  console.log('[probe] session ok:', Boolean(session));
  console.log('[probe] role:', session?.role);

  const checks = {
    classes: supabaseAdmin.from('classes').select('id,name').limit(3),
    announcements: supabaseAdmin.from('announcements').select('id,expires_at').limit(3).or('expires_at.is.null,expires_at.gt.now()').limit(3),
    assessments: supabaseAdmin.from('assessments').select('id').limit(3),
    attendance_overview_classes: supabaseAdmin.from('classes').select('id,name').limit(3),
  };

  const results = {};
  for (const [key, query] of Object.entries(checks)) {
    try {
      const { data, error } = await query;
      results[key] = { ok: !error, rows: data?.length, error: error?.message };
    } catch (err) {
      results[key] = { ok: false, error: String(err) };
    }
  }

  console.log('[probe] results:', JSON.stringify(results, null, 2));
  return results;
}
