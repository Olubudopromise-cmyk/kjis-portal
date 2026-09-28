// Loads the parsed NERDC curriculum into the `curriculum` table.
//
// DRY RUN BY DEFAULT — nothing is written unless you pass --commit:
//   node scripts/seed-curriculum.js            # plan, counts, samples, exit
//   node scripts/seed-curriculum.js --commit   # upsert for real
//
// Input is tmp/curriculum-parse/index.json, written by scripts/curriculum-parser.js.
// Refresh it first with:
//   node scripts/curriculum-parser.js && node scripts/seed-curriculum.js
//
// The upsert key is (class_level, subject, term, week_start), so re-running
// --commit is idempotent — existing weeks are updated in place, never duplicated.

require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const TABLE = 'curriculum';
const BATCH_SIZE = 500;
const CLASS_LEVELS = ['JSS1', 'JSS2', 'JSS3', 'SSS1', 'SSS2', 'SSS3'];
const TERMS = ['First Term', 'Second Term', 'Third Term'];

// One explicit alias on top of the mechanical normalisation below: the PDF
// calls the same subject "CATERING AND CRAFT PRACTICE" (SSS1) and "CATERING
// AND CRAFT" (SSS2). Everything else the brief listed (CCA, PHE, Fashion,
// Solar, CRS/IRS parentheticals) already collapses once '&' -> 'AND' and the
// parentheticals are dropped.
const SUBJECT_KEY_ALIASES = {
  'CATERING AND CRAFT PRACTICE': 'CATERING AND CRAFT',
};

/**
 * Grouping key for a subject. `subject` itself stays verbatim from the PDF —
 * this only exists so the same subject can be listed across class levels.
 * NOTE: it deliberately does NOT merge ENGLISH STUDIES with ENGLISH LANGUAGE.
 */
function subjectKey(name) {
  const norm = String(name || '')
    .toUpperCase()
    .replace(/&/g, ' AND ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
  return SUBJECT_KEY_ALIASES[norm] || norm;
}

// The app's own class names, from the `classes` table ("JSS 1", "SS 1" ...).
// Used only for the report below — nothing here is written.
function classIdHint(classLevel) {
  return classLevel.replace('SSS', 'SS').replace(/^(JSS|SS)(\d)$/, '$1 $2');
}

function flatten(byLevel) {
  const rows = [];
  for (const classLevel of Object.keys(byLevel)) {
    for (const entry of byLevel[classLevel]) {
      for (const week of entry.weeks) {
        rows.push({
          class_level: classLevel,
          subject: entry.subject,
          subject_key: subjectKey(entry.subject),
          term: entry.term,
          week_start: week.week_start,
          week_end: week.week_end,
          is_break: week.break,
          topics: week.topics,
          breakdown: week.breakdown ?? null,
          raw_text: week.raw_text,
          // week.source_page is parser provenance for validation and is
          // deliberately not a column on the table.
        });
      }
    }
  }
  return rows;
}

/** The table's own constraints, checked up front so --commit can't half-fail. */
function validate(rows) {
  const problems = [];
  const seen = new Set();
  for (const r of rows) {
    const where = `${r.class_level} ${r.subject} ${r.term} w${r.week_start}`;
    if (!CLASS_LEVELS.includes(r.class_level)) problems.push(`${where}: bad class_level`);
    if (!TERMS.includes(r.term)) problems.push(`${where}: bad term`);
    if (!r.subject) problems.push(`${where}: empty subject`);
    if (!r.subject_key) problems.push(`${where}: empty subject_key`);
    if (r.subject_key !== subjectKey(r.subject)) problems.push(`${where}: subject_key does not match subject`);
    // The table's own contract: a topics object with no empty-string values.
    const topicValues = Object.entries(r.topics || {});
    if (!topicValues.length) problems.push(`${where}: topics is empty`);
    for (const [col, val] of topicValues) {
      if (typeof val !== 'string' || !val.trim()) problems.push(`${where}: topics[${col}] is empty`);
    }
    if (!(r.week_start >= 1 && r.week_start <= 14)) problems.push(`${where}: week_start out of range`);
    if (!(r.week_end >= r.week_start && r.week_end <= 14)) problems.push(`${where}: week_end out of range`);
    if (typeof r.is_break !== 'boolean') problems.push(`${where}: is_break not boolean`);
    if (!r.topics || typeof r.topics !== 'object' || Array.isArray(r.topics)) problems.push(`${where}: topics not an object`);
    if (!r.raw_text) problems.push(`${where}: missing raw_text`);
    const key = `${r.class_level}|${r.subject}|${r.term}|${r.week_start}`;
    if (seen.has(key)) problems.push(`${where}: duplicate natural key`);
    seen.add(key);
  }
  return problems;
}

function printPlan(rows) {
  console.log(`Table:  ${TABLE}`);
  console.log(`Rows:   ${rows.length}`);
  console.log(`\nRows per class level:`);
  for (const lv of CLASS_LEVELS) {
    const mine = rows.filter(r => r.class_level === lv);
    const subjects = new Set(mine.map(r => r.subject));
    console.log(
      `  ${lv.padEnd(5)} ${String(mine.length).padStart(5)} weeks   ` +
      `${String(subjects.size).padStart(2)} subjects / terms   ` +
      `-> classes.name ${JSON.stringify(classIdHint(lv))}`
    );
  }

  const combined = rows.filter(r => r.week_end !== r.week_start);
  console.log(`\nCombined-week rows (week_start !== week_end): ${combined.length}`);
  console.log(`Break weeks (is_break):                       ${rows.filter(r => r.is_break).length}`);
  console.log(`Rows carrying a breakdown:                    ${rows.filter(r => r.breakdown).length}`);

  const samples = [];
  if (rows.length) samples.push(['first row', rows[0]]);
  const c = combined[0];
  if (c) samples.push(['combined-week row', c]);
  const b = rows.find(r => r.is_break);
  if (b) samples.push(['break row', b]);

  console.log(`\nSample rows:`);
  for (const [label, row] of samples) console.log(`\n  --- ${label} ---\n  ${JSON.stringify(row, null, 2).replace(/\n/g, '\n  ')}`);

  // Where the curriculum's own naming will and won't line up downstream.
  const subjects = new Set(rows.flatMap(r => r.subject));
  const byKey = new Map();
  for (const r of rows) {
    if (!byKey.has(r.subject_key)) byKey.set(r.subject_key, new Set());
    byKey.get(r.subject_key).add(r.subject);
  }
  console.log(`\nSubjects: ${subjects.size} verbatim names -> ${byKey.size} subject_key values`);
  for (const [key, variants] of [...byKey.entries()].sort()) {
    if (variants.size > 1) console.log(`  ${key}  <-  ${[...variants].join('  +  ')}`);
  }
  console.log(`(vs 12 rows in \`subjects\`; see README findings — ENGLISH STUDIES and`);
  console.log(`ENGLISH LANGUAGE are intentionally left as separate keys.)`);
  console.log(`App-side term strings look like "First Term 2025/2026" (settings.current_term);`);
  console.log(`this table stores the bare term name, so joins need the session appended.`);
}

async function commit(rows) {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local first.');
    process.exit(1);
  }
  const ws = require('ws');
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
    realtime: { transport: ws },
  });

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from(TABLE).upsert(batch, {
      onConflict: 'class_level,subject,term,week_start',
    });
    if (error) {
      console.error(`\nUpsert failed on batch starting at row ${i}:`, error.message);
      process.exit(1);
    }
    console.log(`  upserted ${Math.min(i + BATCH_SIZE, rows.length)}/${rows.length}`);
  }

  const { count, error } = await supabase.from(TABLE).select('*', { count: 'exact', head: true });
  if (error) {
    console.error('Wrote the rows but could not re-count:', error.message);
    process.exit(1);
  }
  console.log(`\n${TABLE} now holds ${count} rows.`);
}

async function main() {
  const args = process.argv.slice(2);
  const doCommit = args.includes('--commit');
  const explicit = args.find(a => !a.startsWith('--'));
  const indexPath = explicit
    ? path.resolve(process.cwd(), explicit)
    : path.resolve(process.cwd(), 'tmp/curriculum-parse/index.json');

  if (!fs.existsSync(indexPath)) {
    console.error(`Parsed curriculum not found at ${indexPath}\nRun: node scripts/curriculum-parser.js`);
    process.exit(1);
  }

  const byLevel = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
  const rows = flatten(byLevel);

  console.log(doCommit ? '=== COMMIT: writing to Supabase ===\n' : '=== DRY RUN — nothing will be written ===\n');
  console.log(`Input: ${indexPath}\n`);
  printPlan(rows);

  const problems = validate(rows);
  if (problems.length) {
    console.error(`\n${problems.length} row(s) violate the table's constraints:`);
    for (const p of problems.slice(0, 20)) console.error('  - ' + p);
    process.exit(1);
  }
  console.log('\nValidation: all rows satisfy the table constraints.');

  if (!doCommit) {
    console.log('\nDry run only — re-run with --commit to write.');
    return;
  }
  console.log('');
  await commit(rows);
}

main().catch(err => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
