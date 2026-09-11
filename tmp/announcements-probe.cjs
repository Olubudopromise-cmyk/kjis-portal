// Run: node tmp/announcements-probe.cjs
// Hits /api/announcements the way the student dashboard does,
// plus the students/me endpoint, while echoing raw status + body.
//
// Two modes:
//   1. If you pass --cookie "kjis_session=<value>" it authenticates as whoever
//      that session belongs to.
//   2. If you omit --cookie it hits the endpoints unauthenticated and shows the
//      403 responses so you can see whether the route is even reachable.

const cookie = process.argv
  .find(a => a.startsWith('--cookie='))
  ?.split('=', 2)[1];

async function get(path, opts = {}) {
  const res = await fetch(path, {
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { Cookie: `kjis_session=${cookie}` } : {}),
      ...opts.headers,
    },
    ...opts,
  });
  let body;
  try { body = await res.json(); } catch { body = await res.text(); }
  return { status: res.status, body };
}

async function main() {
  console.log('== /api/announcements (GET) ==');
  const a = await get('/api/announcements');
  console.log('status:', a.status);
  console.log('body:', JSON.stringify(a.body, null, 2));

  console.log();
  console.log('== /api/students/me (GET) ==');
  const m = await get('/api/students/me');
  console.log('status:', m.status);
  console.log('body:', JSON.stringify(m.body, null, 2));

  if (a.status === 200) {
    const notices = Array.isArray(a.body.announcements) ? a.body.announcements : [];
    console.log();
    console.log('announcements returned:', notices.length, 'notice(s)');
    console.log('expires_at column present on first row:', notices[0] ? 'expires_at' in notices[0] : 'n/a');
  }
}

main().catch(e => { console.error(e); process.exit(1); });
