// Validates the parsed curriculum against the PDF itself.
//
//   node scripts/validate-curriculum.js            # full report
//   node scripts/validate-curriculum.js --sample 40
//
// Three checks:
//   1. every `topics` object is non-empty and holds no empty-string values;
//   2. for a random sample of rows, the concatenated topic text is compared
//      word-by-word against the same page's `pdftotext -layout` output, and any
//      row where words are missing (or invented) is reported;
//   3. how many rows carry a `raw_text` longer than all their topic values
//      combined — i.e. text the parser saw but did not place under a key.
//
// Needs `pdftotext` (poppler) on PATH for checks 2 and 3.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const PDF_PATH = path.resolve(process.cwd(), 'JSS & SSS - NERDC Scheme (2025).pdf');
const INDEX_PATH = path.resolve(process.cwd(), 'tmp/curriculum-parse/index.json');
const SAMPLE_SIZE = Number((process.argv.find(a => a.startsWith('--sample=')) || '').split('=')[1]) || 40;

// ---- helpers -------------------------------------------------------------

/** Deterministic PRNG so a run is reproducible. */
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Words as a comparable multiset: lowercase, alphanumerics only. */
function words(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
}

function countMap(list) {
  const m = new Map();
  for (const w of list) m.set(w, (m.get(w) || 0) + 1);
  return m;
}

/** Words of `needle` that `haystack` does not have enough of. */
function missingWords(needleWords, haystackWords) {
  const have = countMap(haystackWords);
  const missing = [];
  for (const w of needleWords) {
    const n = have.get(w) || 0;
    if (n > 0) have.set(w, n - 1);
    else missing.push(w);
  }
  return missing;
}

function pdftotextPages(pdfPath) {
  const raw = execFileSync('pdftotext', ['-layout', pdfPath, '-'], {
    maxBuffer: 1024 * 1024 * 128,
  }).toString('utf8');
  return raw.split('\f'); // one entry per page, 0-indexed
}

/**
 * The layout-text lines of one week's row block on a page: from the line that
 * opens with the week number to the line before the next one. In `-layout`
 * output the week number sits at the left margin and wrapped cell text is
 * indented, so the opener is easy to spot.
 */
function rowBlocks(pageText) {
  const lines = pageText.split('\n');
  const blocks = [];
  let cur = null;
  let seenHeader = false;
  for (const line of lines) {
    const t = line.replace(/\s+$/, '');
    if (!seenHeader && /^\s*Week\b/i.test(t)) { seenHeader = true; continue; }
    if (!seenHeader) continue;
    if (/^\s*\d{1,3}\s*$/.test(t)) continue;              // bare page number
    if (/GET ACCESS|CLICK HERE|SCHEME OF WORK/i.test(t)) continue;
    const opener = /^(\d{1,2})(?:\s*[–—-]\s*(\d{1,2}))?\s+\S/.exec(t);
    if (opener) {
      cur = { week: Number(opener[1]), lines: [t] };
      blocks.push(cur);
    } else if (cur) {
      cur.lines.push(t);
    }
  }
  return blocks;
}

const rowText = (block) => {
  const joined = block.lines.join(' ');
  return joined.replace(/^\s*\d{1,2}(?:\s*[–—-]\s*\d{1,2})?\s+/, '').trim();
};

// ---- main ----------------------------------------------------------------

function main() {
  if (!fs.existsSync(INDEX_PATH)) {
    console.error(`Parsed curriculum not found at ${INDEX_PATH}\nRun: node scripts/curriculum-parser.js`);
    process.exit(1);
  }
  let pdftotextOk = true;
  let pages = [];
  try {
    pages = pdftotextPages(PDF_PATH);
  } catch (err) {
    pdftotextOk = false;
    console.error(`pdftotext unavailable (${err.message.slice(0, 80)}) — checks 2 and 3 will be skipped.`);
  }
  console.log(`pdftotext ground truth: ${pdftotextOk ? pages.length + ' pages' : 'MISSING'}`);

  const byLevel = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
  const rows = [];
  for (const classLevel of Object.keys(byLevel)) {
    for (const entry of byLevel[classLevel]) {
      for (const week of entry.weeks) {
        rows.push({ classLevel, entry, week });
      }
    }
  }

  let failures = 0;

  // --- Check 1: topics shape ---------------------------------------------
  const emptyObjects = [];
  const emptyValues = [];
  for (const r of rows) {
    const entries = Object.entries(r.week.topics || {});
    if (!entries.length) emptyObjects.push(r);
    for (const [col, val] of entries) {
      if (typeof val !== 'string' || !val.trim()) emptyValues.push({ ...r, col });
    }
  }
  console.log('\n=== CHECK 1 — topics shape ===');
  console.log(`  rows:                        ${rows.length}`);
  console.log(`  rows with no topics at all:  ${emptyObjects.length}`);
  console.log(`  empty-string topic values:   ${emptyValues.length}`);
  if (emptyObjects.length) {
    failures += emptyObjects.length + emptyValues.length;
    for (const r of emptyObjects.slice(0, 5)) {
      console.log(`    ! ${r.classLevel} ${r.entry.subject} ${r.entry.term} w${r.week.week_start}`);
    }
  }
  for (const r of emptyValues.slice(0, 5)) {
    console.log(`    ! ${r.classLevel} ${r.entry.subject} ${r.entry.term} w${r.week.week_start} [${r.col}]`);
  }

  // --- Check 2: raw_text heavier than the topics it was split into --------
  const heavier = [];
  for (const r of rows) {
    const topicsLen = Object.values(r.week.topics || {}).reduce((a, v) => a + String(v || '').length, 0);
    if (String(r.week.raw_text || '').length > topicsLen) heavier.push({ ...r, topicsLen });
  }
  console.log('\n=== CHECK 3 — raw_text longer than all topic values combined ===');
  console.log(`  rows: ${heavier.length} of ${rows.length} (${((heavier.length / rows.length) * 100).toFixed(1)}%)`);
  const heaviest = heavier.slice().sort((a, b) =>
    (b.week.raw_text.length - b.topicsLen) - (a.week.raw_text.length - a.topicsLen));
  for (const r of heaviest.slice(0, 5)) {
    console.log(`    - ${r.classLevel} ${r.entry.subject} ${r.entry.term} w${r.week.week_start} ` +
      `raw=${r.week.raw_text.length} topics=${r.topicsLen}`);
  }

  // --- Check 2: word-level comparison against pdftotext -layout ----------
  console.log(`\n=== CHECK 2 — ${SAMPLE_SIZE} random rows vs pdftotext -layout ===`);
  if (!pdftotextOk) {
    console.log('  skipped (pdftotext not available)');
    return;
  }

  const rand = mulberry32(20260928);
  const levels = Object.keys(byLevel);
  const perLevel = Math.floor(SAMPLE_SIZE / levels.length);
  const sample = [];
  for (const lv of levels) {
    const pool = rows.filter(r => r.classLevel === lv);
    for (let i = 0; i < perLevel && pool.length; i++) {
      sample.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
    }
  }
  while (sample.length < SAMPLE_SIZE) {
    const lv = levels[Math.floor(rand() * levels.length)];
    const pool = rows.filter(r => r.classLevel === lv);
    sample.push(pool[Math.floor(rand() * pool.length)]);
  }

  const results = [];
  for (const r of sample) {
    const page = r.week.source_page;
    const rec = { ...r, page, ok: false, missing: [], invented: [], pdfText: '', parsedText: '', note: '' };
    if (!page || !pages[page - 1]) {
      rec.note = `no source_page / page ${page} not in pdftotext output`;
      results.push(rec);
      continue;
    }
    const blocks = rowBlocks(pages[page - 1]);
    // Match on the week number, and on the fallback of the first block whose
    // text shares words with what we parsed (combined-week rows line up too).
    const block = blocks.find(b => b.week === r.week.week_start)
      || blocks.find(b => b.week >= r.week.week_start && b.week <= r.week.week_end);
    if (!block) {
      rec.note = `no row block for week ${r.week.week_start} on page ${page}`;
      results.push(rec);
      continue;
    }
    rec.pdfText = rowText(block);
    const parsedParts = Object.values(r.week.topics || {});
    if (r.week.breakdown) parsedParts.push(r.week.breakdown);
    rec.parsedText = parsedParts.join(' ');
    const pdfWords = words(rec.pdfText);
    const parsedWords = words(rec.parsedText);
    rec.missing = missingWords(pdfWords, parsedWords);
    rec.invented = missingWords(parsedWords, pdfWords);
    // The text layer occasionally letter-spaces a word ("ques tions"), which
    // pdftotext reports split while the parser joins it. Same letters in the
    // same order means nothing is actually missing.
    if ((rec.missing.length || rec.invented.length) &&
        pdfWords.join('') === parsedWords.join('')) {
      rec.missing = [];
      rec.invented = [];
      rec.spacingArtifact = true;
    }
    rec.ok = rec.missing.length === 0 && rec.invented.length === 0;
    if (!rec.ok) failures++;
    results.push(rec);
  }

  const clean = results.filter(r => r.ok).length;
  const spacy = results.filter(r => r.spacingArtifact).length;
  console.log(`  rows compared:  ${results.length}`);
  console.log(`  rows matching:  ${clean}${spacy ? ` (${spacy} after allowing pdftotext letter-spacing splits)` : ''}`);
  console.log(`  rows with missing/invented words: ${results.length - clean}`);
  for (const r of results) {
    if (r.ok) continue;
    console.log(`    ! ${r.classLevel} ${r.entry.subject} ${r.entry.term} w${r.week.week_start} ` +
      `(page ${r.page})${r.note ? ' — ' + r.note : ''}`);
    if (r.missing.length) console.log(`        missing from parsed (${r.missing.length}): ${r.missing.slice(0, 14).join(' ')}`);
    if (r.invented.length) console.log(`        not in PDF (${r.invented.length}): ${r.invented.slice(0, 14).join(' ')}`);
  }

  // --- Worked comparisons for review -------------------------------------
  const show = (label, picks) => {
    console.log(`\n----- ${label} -----`);
    if (!picks.length) { console.log('  (no rows with a page comparison)'); return; }
    for (const r of picks) {
      console.log(`\n  ${r.classLevel} ${r.entry.subject} · ${r.entry.term} · week ${r.week.week_start}` +
        `${r.week.week_start !== r.week.week_end ? '-' + r.week.week_end : ''}  [source page ${r.page}]  ${r.ok ? 'MATCH' : 'MISMATCH'}`);
      console.log(`    PDF   : ${r.pdfText.slice(0, 340)}`);
      console.log(`    parsed: ${r.parsedText.slice(0, 340)}`);
      if (!r.ok) {
        if (r.missing.length) console.log(`    missing: ${r.missing.slice(0, 20).join(' ')}`);
        if (r.invented.length) console.log(`    invented: ${r.invented.slice(0, 20).join(' ')}`);
        if (r.note) console.log(`    note: ${r.note}`);
      }
    }
  };
  show('5 JSS comparisons', results.filter(r => /JSS/.test(r.classLevel)).slice(0, 5));
  show('5 SSS comparisons', results.filter(r => /SSS/.test(r.classLevel)).slice(0, 5));

  console.log(`\n=== RESULT: ${failures === 0 ? 'PASS' : 'FAIL'} (${failures} problem(s)) ===`);
  if (failures) process.exitCode = 1;
}

main();
