require('dotenv').config({ path: '.env.local' });
const https = require('https');

const url = new URL(process.env.SUPABASE_URL + '/rest/v1/');
https.get(url, {
  headers: {
    apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: 'Bearer ' + process.env.SUPABASE_SERVICE_ROLE_KEY,
  },
}, (res) => {
  let body = '';
  res.on('data', (c) => (body += c));
  res.on('end', () => {
    const spec = JSON.parse(body);
    const defs = spec.definitions || {};
    for (const table of Object.keys(defs).sort()) {
      const cols = Object.keys(defs[table].properties || {});
      console.log(table + ': ' + cols.join(', '));
    }
  });
});
