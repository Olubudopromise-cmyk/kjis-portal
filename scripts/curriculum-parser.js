#!/usr/bin/env node
/**
 * Nigeria NERDC 2025 Scheme of Work — PDF → structured JSON (spatial extractor)
 *
 * This version uses pdf-parse v2 (the `new PDFParse(buf)` API) and extracts text
 * spatially via `getTextContent()` + the item transform matrix, rather than the
 * naive newline-split approach. That's what this PDF needs: columns are positioned
 * by x-coordinate, rows by y-coordinate, and the text stream interleaves them.
 *
 * Output: one JSON file per class level under tmp/curriculum-parse/, plus an
 * index.json. sample-schema.json is a shape reference regenerated from the
 * real parse on every run, so it can never drift from the actual output.
 */

const fs = require('fs');
const path = require('path');

const PDF_PATH = path.resolve(process.cwd(), 'JSS & SSS - NERDC Scheme (2025).pdf');
const OUT_DIR = path.resolve(process.cwd(), 'tmp/curriculum-parse');

// ---- PDF library bootstrap (handles the v2 class-based export) ----
let PDFParse, VerbosityLevel;
try {
  const pkg = require('pdf-parse');
  PDFParse = pkg.PDFParse;
  VerbosityLevel = pkg.VerbosityLevel;
  if (!PDFParse || typeof PDFParse !== 'function') {
    console.error('pdf-parse installed but did not expose a usable PDFParse class.');
    console.error('Export shape:', JSON.stringify({
      type: typeof pkg,
      keys: typeof pkg === 'object' ? Object.keys(pkg).slice(0, 20) : null,
      hasPDFParse: typeof pkg?.PDFParse === 'function',
      hasVerbosityLevel: typeof pkg?.VerbosityLevel === 'object',
    }));
    process.exit(1);
  }
} catch (err) {
  console.error('pdf-parse could not be required:', err.message);
  process.exit(1);
}

// ---- Level normalisation (case/space-insensitive, flexible labels) ----
const LEVEL_CANON = {
  JSS1: 'JSS1', JSS2: 'JSS2', JSS3: 'JSS3',
  SSS1: 'SSS1', SSS2: 'SSS2', SSS3: 'SSS3',
};
const KNOWN_LEVELS = new Set(Object.keys(LEVEL_CANON));

function normaliseLevel(raw) {
  if (typeof raw !== 'string') return null;
  const cleaned = raw.trim().toUpperCase().replace(/\s+/g, '');
  return LEVEL_CANON[cleaned] || null;
}

// ---- Common NERDC subject labels (used to identify the subject heading) ----
const COMMON_SUBJECTS = new Set([
  'English Studies', 'English Language', 'Mathematics', 'Basic Science',
  'Basic Technology', 'Social Studies', 'Agricultural Science',
  'Creative Arts', 'Culture and Creative Arts', 'Civic Education',
  'Security Education', 'Business Studies', 'Home Economics',
  'National Values Education', 'Physical and Health Education',
  'Christian Religious Studies', 'Islamic Studies', 'Islamic Religious Studies',
  'Yoruba', 'Hausa', 'Igbo', 'French', 'Computer Science',
  'Information Technology', 'Physics', 'Chemistry', 'Biology',
  'Literature in English', 'Government', 'History', 'Economics',
  'Commerce', 'Accounting', 'Geography', 'Financial Accounting',
  'Principles of Accounts', 'Data Processing', 'CRS', 'IRS',
  'Further Mathematics', 'Integrated Science', 'Basic Science and Technology',
  'PHE', 'Physical Health Education', 'BST', 'CCA',
  'Social and Citizenship Studies', 'Nigerian History',
  'Intermediate Science', 'Digital Technologies', 'Trade Subjects',
  'Cultural and Creative Arts', 'Christian Religious Education',
  'Islamic Religious Education',
]);

// ---- Spatial text helpers ----

/**
 * Get the text content for a page as spatially-ordered items.
 * transform[4] = x, transform[5] = y (visual top-to-bottom as seen in this PDF).
 *
 * NOTE: whitespace-only items (" " text fragments) are KEPT. pdf-parse emits
 * inter-word gaps as explicit space items; dropping them (via str.trim())
 * destroys word spacing ("Useofpicturecharts..."). The line renderer below
 * uses them together with x-gap fallback spacing.
 */
async function pageItems(doc, pageNumber) {
  const page = await doc.getPage(pageNumber);
  const tc = await page.getTextContent();
  const items = (tc.items || [])
    .filter(it => it.str != null && it.str !== '')
    .map(it => ({
      str: it.str,
      x: it.transform[4],
      y: it.transform[5],
      width: it.width,
      height: it.height,
      fontName: it.fontName,
      hasEOL: it.hasEOL,
    }));
  return items;
}

/**
 * Extract a single visual line from a set of items sorted by y then x.
 * Items within yGap of each other belong to the same line.
 */
function extractLines(items, yGap = 8) {
  const sorted = items.slice().sort((a, b) => a.y - b.y || a.x - b.x);
  const lines = [];
  let current = null;
  let lastY = null;
  for (const it of sorted) {
    if (lastY !== null && Math.abs(it.y - lastY) > yGap) {
      if (current) { current.text = renderLineText(current); lines.push(current); }
      current = { y: it.y, items: [] };
    } else if (!current) {
      current = { y: it.y, items: [] };
    }
    current.items.push(it);
    lastY = it.y;
  }
  if (current) { current.text = renderLineText(current); lines.push(current); }
  return lines;
}

function renderLineText(line) {
  const parts = [];
  let lastX = null;
  for (const it of line.items) {
    if (!it.str) continue;
    if (lastX !== null && it.x - lastX > 3) parts.push(' ');
    parts.push(it.str);
    lastX = it.x + (it.width || 0);
  }
  return parts.join('');
}

/**
 * Convert a page's spatially-ordered items into visual lines (rows).
 * We sort top-to-bottom, then group items whose y-coordinates are within
 * `yGap` of each other into one visual line. Within a line, we sort by x.
 * Each line also records x0 (x of its first non-blank token) so callers can
 * tell Week-column openers (x0 ~32-41) apart from Breakdown-column wrapped
 * text (x0 ~83+) that merely *starts* with a number (e.g. the SSS1 Eng
 * week-13 tail "12: Examination. - Week 13: Closing.").
 */
function itemsToLines(items, yGap = 5) {
  const sorted = items.slice().sort((a, b) => a.y - b.y || a.x - b.x);
  const lines = [];
  let current = null;
  let lastY = null;

  for (const it of sorted) {
    if (!it.str) continue;
    const y = it.y;
    if (lastY !== null && Math.abs(y - lastY) > yGap) {
      if (current) {
        current.items.sort((a, b) => a.x - b.x);
        current.x0 = firstTokenX(current.items);
        lines.push(current);
      }
      current = { y, items: [] };
    } else if (!current) {
      current = { y, items: [] };
    }
    current.items.push(it);
    lastY = y;
  }
  if (current) {
    current.items.sort((a, b) => a.x - b.x);
    current.x0 = firstTokenX(current.items);
    lines.push(current);
  }
  return lines;
}

/** x of the first non-blank token on a line (the Week-column gate). */
function firstTokenX(items) {
  for (const it of items) {
    if (it.str && it.str.trim()) return it.x;
  }
  return Infinity;
}

/**
 * Build a single text string from a line's items, in x order.
 *
 * Gap-aware: a space is emitted between two tokens when the PDF stream
 * contains an explicit space item OR the x-gap between the previous token's
 * end (x + width) and the next token's x exceeds ~1.2pt. This restores the
 * word spacing that a naive join('') drops ("Use of picture charts ...").
 * An optional [xMin, xMax) window restricts rendering to one table column
 * (used by the JSS-English column splitter).
 */
function lineText(line, xGap = 1.2, xMin = -Infinity, xMax = Infinity) {
  const items = line.items.filter(it => it.x >= xMin && it.x < xMax);
  const parts = [];
  let prevEnd = null;
  let pendingSpace = false;
  for (const it of items) {
    const s = it.str;
    if (s == null || s === '') continue;
    if (!s.trim()) { pendingSpace = true; continue; }
    if (prevEnd !== null) {
      const gap = it.x - prevEnd;
      if (pendingSpace || gap > xGap) parts.push(' ');
    }
    pendingSpace = false;
    parts.push(s.trim());
    const w = (typeof it.width === 'number' && it.width > 0) ? it.width : 0;
    prevEnd = it.x + w;
  }
  return tidySpaces(parts.join(''));
}

/** Collapse whitespace and remove spaces before closing punctuation. */
function tidySpaces(s) {
  return (s || '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:)\]])/g, '$1')
    .replace(/\(\s+/g, '(')
    .trim();
}

// ---- PDF navigation: find the page where each class level starts ----

/**
 * Within a level's pages, find where each subject/term table starts and ends.
 * Uses flexible whole-text regex on raw page text (not line-by-line) to
 * tolerate inconsistent spacing and imperfect line splitting from pdf-parse.
 */
/**
 * Extract the (level, subject) key for one page's raw text.
 * Primary: standard "JSS 1 <SUBJECT> SCHEME OF WORK" headings.
 * Fallback: footer subject labels WITHOUT "SCHEME OF WORK" (trade/vocational
 * pages, e.g. "JSS1 SOLAR PHOTOVOLTAIC(PV)INSTALLATIONANDMAINTENANCE").
 * The fallback is anchored on the JSS/SSS level token so mid-table content
 * like "Review of First Term" can never match. Returns null when the page
 * carries no subject label (index/listing pages) — those pages attach to
 * the surrounding range instead of opening a new one.
 */
/**
 * Strip a trailing "SCHEME OF WORK" fragment (full or truncated, e.g. the
 * JSS2 Horticulture p139 footer whose text layer reads "SCHEME OF WOR")
 * that the fallback path can swallow into the subject name. Only strips
 * when a real subject name remains.
 */
function cleanSubject(s) {
  if (!s) return s;
  const stripped = s.replace(/\s+SCHEME\s+OF\s+\w*$/i, '').trim();
  return stripped.length >= 3 ? stripped : s;
}

function subjectKeyForPage(text) {
  if (!text) return null;
  let m = /\b(JSS|SSS?)\s*([123])\s+([A-Z][A-Z\s&()\/.\-]+?)\s+SCHEME\s+OF\s+WORK/i.exec(text);
  if (m) {
    const level = /^J/i.test(m[1]) ? `JSS${m[2]}` : `SSS${m[2]}`;
    const subject = cleanSubject(m[3].replace(/\s+/g, ' ').trim());
    if (!KNOWN_LEVELS.has(level) || subject.length < 2) return null;
    return { level, subject };
  }
  m = /\b(JSS|SSS?)\s*([123])\s+([A-Z][A-Z\s&()\/.\-]*?)(?=\s+(?:FIRST|SECOND|THIRD)\s*TERM|\s+SCHEME\s+OF\s+WORK|\s+WEEK\b|\s*$)/i.exec(text);
  if (m) {
    const level = /^J/i.test(m[1]) ? `JSS${m[2]}` : `SSS${m[2]}`;
    const subject = cleanSubject(m[3].replace(/\s+/g, ' ').trim());
    if (!KNOWN_LEVELS.has(level) || subject.length < 3) return null;
    if (/^(FIRST|SECOND|THIRD|TERM|WEEK)$/i.test(subject)) return null;
    return { level, subject, fallback: true };
  }
  return null;
}

function findSubjectBoundaries(lines, pageTexts, level) {
  const boundaries = []; // { level, subject, term, type: 'subject-heading' | 'term', pageIndex }

  // ---- Subject headings: one boundary per subject label change ----
  // A subject often spans several pages (one page per term, plus continuation
  // pages); emitting a boundary only when the label CHANGES keeps multi-page
  // terms in a single range. Pages with no label (index pages, continuations
  // whose footer didn't parse) attach to the surrounding range. Labels whose
  // level token doesn't match the level being parsed (e.g. an SS3 page inside
  // the SSS2 page range) are ignored — they belong to the neighbouring level.
  if (pageTexts) {
    let lastKey = null;
    for (let pi = 0; pi < pageTexts.length; pi++) {
      const found = subjectKeyForPage(pageTexts[pi]);
      if (!found) continue;
      if (level && found.level !== level) continue;
      const key = `${found.level}||${found.subject.toUpperCase()}`;
      if (key === lastKey) continue;
      lastKey = key;
      boundaries.push({ level: found.level, subject: found.subject, type: 'subject-heading', pageIndex: pi, idx: -1 });
    }
  }

  // ---- Term banners: strict standalone footer lines only ----
  // Banners are trailing footers (y > ~750): one visual line containing
  // nothing but the term name ("FIRSTTERM", "SECOND TERM", ...), optionally
  // followed by a parenthetical qualifier ("THIRD TERM (Pre-Exam/Break Term)").
  // Week-content rows like "5 Midterm Examination" can never match here:
  // they carry a week number plus topic text, and "Midterm" lacks the
  // FIRST|SECOND|THIRD prefix. The y-gate is skipped when y is unknown.
  const TERM_LINE_RE = /^\s*(FIRST|SECOND|THIRD)\s*TERM\s*(\([^)]*\))?\s*$/i;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const text = (line.text || '').trim();
    if (!TERM_LINE_RE.test(text)) continue;
    if (typeof line.y === 'number' && !(line.y > 750)) continue;
    boundaries.push({ idx: i, term: text, type: 'term' });
  }

  return boundaries;
}

// ---- Debug: dump raw term-boundary matches for a target subject/page range ----
// Enable by setting DEBUG_SUBJECT and DEBUG_LEVEL in the environment or here.
const DEBUG_SUBJECT = process.env.DEBUG_SUBJECT || '';
const DEBUG_LEVEL = process.env.DEBUG_LEVEL || '';
if (DEBUG_SUBJECT && DEBUG_LEVEL && typeof byLevel !== 'undefined' && byLevel[DEBUG_LEVEL]) {
  const targetEntries = byLevel[DEBUG_LEVEL].filter(e => e.subject === DEBUG_SUBJECT);
  console.log('\n===== DEBUG: subject="' + DEBUG_SUBJECT + '" level="' + DEBUG_LEVEL + '" entries (' + targetEntries.length + ') =====');
  for (const e of targetEntries) {
    console.log('  - term="' + e.term + '" weeks=' + e.weeks.length + ' strand_columns=[' + e.strand_columns.join(', ') + ']');
    for (const w of e.weeks.slice(0, 12)) {
      console.log('      weeks=' + w.week_start + (w.week_end !== w.week_start ? '-' + w.week_end : '') + ' break=' + w.break + ' topics:{' + Object.entries(w.topics).map(([k,v]) => k + ':"' + v + '"').join(', ') + '}');
    }
    if (e.weeks.length > 12) console.log('      ... (+' + (e.weeks.length - 12) + ' more weeks)');
  }
  console.log('----- raw lines that produced the term-boundary matches -----');
  // filled inside parseLevelPages below
}


/**
 * Given the spatial lines for a level's pages, extract entries.
 *
 * Approach per subject/term block:
 *  - Page-based term assignment (banner page = its term; banner-less
 *    continuation pages = the still-open term; pre-first-banner lines join
 *    the first term), grouped into one segment per term.
 *  - Within a segment, visual lines are reassembled into logical week rows
 *    (week-number line plus its wrapped continuation lines), split at week
 *    ranges, and built into week entries with strand topics + raw text.
 */
async function parseLevelPages(doc, pageRange, level) {
  // Debug: snapshot the requested level's raw term-boundary matches once,
  // but only the first time we parse the requested level so we don't
  // drown the output for levels we don't care about.
  if (DEBUG_SUBJECT && DEBUG_LEVEL && level === DEBUG_LEVEL) {
    // (boundaries are computed below; we log them right after.)
  }

  // Gather all lines and raw page text from this level's pages in order.
  const allLines = [];
  const pageTexts = [];
  const lineOffsets = []; // starting line index for each page
  let lineOffset = 0;
  for (let pn = pageRange.start; pn <= pageRange.end; pn++) {
    const items = await pageItems(doc, pn);
    const lines = itemsToLines(items, 5);
    lineOffsets.push(lineOffset);
    lineOffset += lines.length;

    // Build raw page text for flexible regex matching
    const rawText = items.map(it => it.str).join(' ');
    pageTexts.push(rawText);
    // Index / table-of-contents pages ("... (NEW NERDC SCHEME) 1. English
    // Studies 2. ...") carry enumerated subject lists whose "1. ..." items
    // would otherwise parse as week rows. Flag their lines so no segment
    // ever collects them.
    const isIndex = /NEW\s+NERDC\s+SCHEME/i.test(rawText);
    for (const line of lines) {
      line.page = pn;
      line.text = lineText(line);
      line.indexPage = isIndex;
    }
    allLines.push(...lines);
  }

  const boundaries = findSubjectBoundaries(allLines, pageTexts, level);

  // Debug: dump term-boundary raw matches for the requested subject/level
  if (DEBUG_SUBJECT && DEBUG_LEVEL && level === DEBUG_LEVEL && boundaries.length) {
    const lines = allLines;
    console.log('----- findSubjectBoundaries raw results (' + boundaries.length + ' boundaries) for level=' + level + ' -----');
    for (const b of boundaries) {
      if (b.type === 'term' && b.idx != null && b.idx >= 0 && b.idx < lines.length) {
        const ctx = lines.slice(Math.max(0,b.idx-2), b.idx+3).map(l => 'line['+l.lineIdx+'/y='+l.y.toFixed(1)+'] "' + l.text + '"').join('\n');
        console.log('TERM MATCH @line='+(b.idx)+' term="'+(b.term)+'"\n  ctx:\n' + ctx.split('\n').map(s => '    '+s).join('\n'));
      }
    }
    console.log('----- subject-heading boundaries -----');
    for (const b of boundaries) {
      if (b.type === 'subject-heading') {
        const idx = b.idx != null ? b.idx : (b.pageIndex != null ? lineOffsets[b.pageIndex] : -1);
        const line = (idx != null && idx >= 0 && idx < lines.length) ? lines[idx] : null;
        console.log('SUBJECT-HEADING level="'+(b.level)+'" subject="'+(b.subject)+'" idx='+(b.idx)+' pageIndex='+(b.pageIndex)+' line='+(line?JSON.stringify(line.text):'n/a'));
      }
    }
    console.log('----- end debug -----\n');
  }

  // Map subject-heading pageIndex to line idx using line offsets
  for (const b of boundaries) {
    if (b.type === 'subject-heading' && b.pageIndex !== undefined) {
      b.idx = lineOffsets[b.pageIndex] || 0;
    }
  }

  const entries = [];

  // Collect all subject headings, sorted by their line index
  const subjectHeadings = boundaries
    .filter(b => b.type === 'subject-heading')
    .sort((a, b2) => (a.idx || 0) - (b2.idx || 0));

  for (const heading of subjectHeadings) {
    const subject = heading.subject;
    const startIdx = heading.idx || 0;
    const endIdx = nextSubjectBoundary(allLines, boundaries, startIdx);

    // Page-based term assignment. Term banners are trailing footers, so the
    // page carrying banner k IS term k's page; a banner-less continuation
    // page still belongs to the term left open by the most recent preceding
    // banner; lines before the first banner (the opening page's head + early
    // week rows) join the first banner's term. Index/listing pages and
    // footer junk contribute no rows (see collectSegment). Ranges with no
    // banner yield no entry — never a bare 'Term' fragment, and never a
    // preamble mislabeled with the wrong term's name.
    const bannersHere = boundaries
      .filter(bb => bb.type === 'term' && bb.idx >= startIdx && bb.idx < endIdx)
      .sort((a, b2) => a.idx - b2.idx);
    if (!bannersHere.length) continue;

    // Valid (banner page -> term), in line order; last banner wins per page.
    const validBanners = [];
    for (const b of bannersHere) {
      const termName = normalizeTermName(b.term);
      if (!termName) continue;
      validBanners.push({ page: allLines[b.idx].page, term: termName });
    }
    if (!validBanners.length) continue;

    const bannerPageTerm = new Map();
    for (const vb of validBanners) bannerPageTerm.set(vb.page, vb.term);
    const firstTerm = validBanners[0].term;

    const startPage = allLines[startIdx].page;
    const endPage = allLines[endIdx - 1].page;
    const pages = [];
    for (let p = startPage; p <= endPage; p++) pages.push(p);
    const pageTerm = new Map();
    let lastSeen = null;
    for (const p of pages) {
      if (bannerPageTerm.has(p)) lastSeen = bannerPageTerm.get(p);
      pageTerm.set(p, lastSeen || firstTerm);
    }
    // Group consecutive same-term pages into one segment each.
    const segments = [];
    let cur = null;
    for (const p of pages) {
      const t = pageTerm.get(p);
      if (!cur || cur.term !== t) {
        if (cur) segments.push(cur);
        cur = { term: t, startPage: p, endPage: p };
      } else {
        cur.endPage = p;
      }
    }
    if (cur) segments.push(cur);

    const pageStartLine = (pn) => lineOffsets[pn - pageRange.start];
    const pageEndLine = (pn) => (
      pn - pageRange.start + 1 < lineOffsets.length
        ? lineOffsets[pn - pageRange.start + 1]
        : allLines.length
    );
    // JSS English Studies: locate the true strand-column header once per
    // subject so continuation pages (no header row) reuse the same x-bands.
    const colBands = /ENGLISH/i.test(subject) && !/LITERATURE/i.test(subject)
      ? findColumnBands(allLines, startIdx, endIdx, level)
      : { level, bounds: null };
    // 3-column tables (Week | Topic | Breakdown): locate the x at which the
    // Breakdown cell starts, once per subject as a fallback. This is base-table
    // geometry, NOT strand calibration — it only lets the Topic cell be
    // rendered as its own stream instead of being shredded by the Breakdown
    // cell's independently-wrapped lines. Column widths differ from table to
    // table (SSS2 English: x=266 on the First-Term page, x=213 on the
    // Second-Term page), so each term segment re-reads its own header first.
    const subjectBoundaryX = findTopicColumnBoundary(allLines, startIdx, endIdx);
    for (const seg of segments) {
      const s = seg.startPage === startPage ? startIdx : pageStartLine(seg.startPage);
      const e = seg.endPage === endPage ? endIdx : pageEndLine(seg.endPage);
      const segBoundaryX = findTopicColumnBoundary(allLines, s, e);
      const topicBoundaryX = segBoundaryX != null ? segBoundaryX : subjectBoundaryX;
      const entry = collectSegment(allLines, s, e, subject, level, seg.term, colBands, topicBoundaryX);
      if (entry) entries.push(entry);
    }
  }

  return entries;
}

/**
 * Collect week rows from one term segment [segStart, segEnd) and build the
 * entry for `termName`. Returns null when the segment holds no real content.
 *
 * Two table shapes exist in this PDF, dispatched per subject:
 *  - JSS English Studies: a TRUE 6-column table
 *    (Week | Speech Work | Grammar | Reading & Comprehension | Composition |
 *    Literature in English) → strands are split by x-band column position.
 *  - SSS English (Studies / Language) and everything else: a 3-column table
 *    (Week | Topic | Breakdown/Content) whose strand labels
 *    ("Grammar:", "Vocabulary Development:", ...) are embedded INLINE in the
 *    single topic cell → strands are split by text-pattern matching at known
 *    label prefixes (never by x-position; there is no strand column).
 *
 * Row model: the PDF's week rows wrap across several visual lines (week
 * number first, in visual reading order, then continuation lines). Lines are
 * in y-ascending order here, which runs visual bottom-to-top, so a row's
 * continuation lines precede its week-number line: each row spans from just
 * after the previous week-number line through the current one, and its text
 * is assembled back in visual order. Combined-week rows ("5-10", "1 & 2")
 * are stored as week_start/week_end ranges, never expanded into duplicates.
 */
function collectSegment(allLines, segStart, segEnd, subject, level, termName, colBands, topicBoundaryX) {
      const mode = englishTableMode(subject, allLines, segStart, segEnd, colBands);
      if (mode && mode.columns) {
        return collectSegmentColumns(allLines, segStart, segEnd, subject, level, termName, mode);
      }
      // Every non-English subject keeps its own table columns ("Week | Topic |
      // Content", senior papers "| Breakdown", some JSS "| Learning
      // Objectives"), read from that table's header row, so Topic and Content
      // land under their own keys instead of being blanked into one cell.
      if (!isEnglishSubject(subject)) {
        const byHeader = collectSegmentByHeader(allLines, segStart, segEnd, subject, level, termName);
        if (byHeader) return byHeader;
      }
      // Split each visual line into its Topic-cell and Breakdown-cell text when
      // the table is the 3-column Week|Topic|Breakdown shape. Strand splitting
      // then runs over the Topic cell stream alone, where the labels
      // ("Grammar:", "Vocabulary Development:", ...) are intact, while the
      // Breakdown cell is kept verbatim on the week as `breakdown`.
      const banded = topicBoundaryX != null && isEnglishSubject(subject);
      // 1. Filter to content lines (index pages, footers, banners excluded).
      const content = [];
      for (let i = segStart; i < segEnd; i++) {
        const line = allLines[i];
        const text = line.text;
        // Index / table-of-contents pages never contribute rows (their
        // enumerated "1. ..." subject lists would otherwise parse as weeks).
        if (line.indexPage) continue;
        // Skip page footers, "GET ACCESS..." banners.
        if (/GET ACCESS|GET MORE EDUCATIONAL|CLICK HERE|sincere|resources archive/i.test(text)) continue;
        // Skip subject-footer label lines ("JSS1 BUSINESS STUDIES...",
        // "SS1ENGLISHSTUDIES SCHEME OF WORK" — spaced or glued) wherever
        // they appear — they are boundary markers, and must never glue
        // onto a neighbouring row's text.
        if (/^(JSS|SSS?)\s*[123]/i.test(text.trim())) continue;
        // Skip table header rows ("Week Topic Breakdown",
        // "Week Speech Work Grammar ...").
        if (/^\s*Week\s+(Topic|Speech|Content)/i.test(text)) continue;
        // Skip lone page numbers ("199", "200") — never row continuations.
        if (/^\d{1,3}$/.test(text.trim())) continue;
        // Skip the term banner line itself (strict standalone form only, so
        // content rows like "1 Review of First Term Work" are kept).
        if (/^\s*(FIRST|SECOND|THIRD)\s*TERM\s*(\([^)]*\))?\s*$/i.test(text)) continue;

        const band = banded
          ? {
              topic: lineText(line, 1.2, WEEK_COL_MAX, topicBoundaryX),
              breakdown: lineText(line, 1.2, topicBoundaryX, Infinity),
            }
          : null;
        content.push({ lineIdx: i, text, x0: line.x0, page: line.page, band });
      }

      // 2. Reassemble visual lines into logical rows, split at week ranges.
      // A line opens a row only when its week marker sits in the Week column
      // (x0 < WEEK_COL_MAX). Wrapped Breakdown text that merely starts with
      // a number ("12: Examination. - Week 13: Closing.", x0 ~284) stays a
      // continuation — this is what used to shred SSS1-English weeks 12/13.
      const rows = [];
      let buf = [];
      for (const ln of content) {
        const range = parseWeekRange(ln.text);
        if (range && (ln.x0 == null || ln.x0 < WEEK_COL_MAX)) {
          const ordered = buf.slice().reverse();
          rows.push({
            range,
            page: ln.page,
            parts: [ln.text, ...ordered.map(b => b.text)],
            topicParts: banded ? [ln.band.topic, ...ordered.map(b => b.band.topic)] : null,
            breakdownParts: banded ? [ln.band.breakdown, ...ordered.map(b => b.band.breakdown)] : null,
          });
          buf = [];
        } else {
          buf.push(ln);
        }
      }
      // Trailing number-less lines (table headers, leftover footers) belong
      // to no row and are dropped.

      // Sort rows by week range to ensure ascending order.
      rows.sort((a, b2) => (a.range.start - b2.range.start) || (a.range.end - b2.range.end));

      if (!rows.length) return null;

      const english = isEnglishSubject(subject);

      // 3. Build week entries from the content rows.
      const weekEntries = [];
      let lastKey = null;
      for (const r of rows) {
        const key = r.range.start + '-' + r.range.end;
        if (key === lastKey) continue; // dedup
        lastKey = key;
        const rawText = cleanRawText(r.parts.join(' '));
        const isBreak = /mid[-\s]?term|break|holiday/i.test(rawText);
        // Strand splitting runs over the Topic cell only; the Breakdown cell is
        // preserved separately so a split that misses an edge case loses
        // nothing. Both plus raw_text keep the full row recoverable.
        const topicStream = r.topicParts ? tidySpaces(r.topicParts.join(' ')) : '';
        const breakdownStream = r.breakdownParts ? cleanRawText(tidySpaces(r.breakdownParts.join(' '))) : '';
        if (process.env.DEBUG_STRANDS && english) {
          DEBUG_STREAMS.push({ level, subject, term: termName, week: r.range.start, topic: topicStream, detail: breakdownStream });
        }
        let topics;
        let breakdown;
        if (!english) {
          topics = englishFallbackTopics(rawText, subject);
        } else if (banded) {
          // Which cell carries the strand labels differs per senior-English
          // table. SSS1 puts them in the Topic cell ("Grammar: Nouns –
          // Numbers"); SSS2/SSS3 put a bare, comma/slash-separated list of
          // strand names in the Topic cell and the labelled detail
          // ("Grammar: ... Oral: ...") in the Content/Breakdown cell. Split
          // whichever cell actually holds recognised labels; keep the other
          // cell verbatim on the week as `breakdown` when it adds information.
          const fromTopic = splitInlineStrands(topicStream || rawText);
          const fromDetail = breakdownStream ? splitInlineStrands(breakdownStream) : {};
          // Cell holds nothing but a strand name (SSS3 "Listening
          // Comprehension", "Vocabulary Development") — the topic text for
          // that strand sits in the neighbouring cell.
          const bare = breakdownStream ? wholeCellStrand(topicStream) : null;
          if (bare && !strandScore(fromTopic)) {
            topics = { [bare]: breakdownStream };
          } else if (strandScore(fromDetail) > strandScore(fromTopic)) {
            // Score rather than "has any label": SSS2/SSS3 Topic cells are bare
            // name lists that can contain a colon-less label-like word, but
            // they never yield as many populated strands as the detail cell.
            topics = fromDetail;
          } else {
            topics = fromTopic;
            breakdown = breakdownStream;
          }
        } else {
          topics = splitInlineStrands(rawText);
        }
        const week = { week_start: r.range.start, week_end: r.range.end, break: isBreak, topics };
        if (breakdown) week.breakdown = breakdown;
        week.raw_text = rawText;
        week.source_page = r.page;
        weekEntries.push(week);
      }

      if (!weekEntries.length) return null;

      // Strand columns: union of inline labels actually present (English),
      // otherwise the known table columns for the subject.
      let strandColumns = knownStrandColumns(subject, level);
      if (english) {
        const seen = [];
        for (const w of weekEntries) {
          for (const k of Object.keys(w.topics)) {
            if (k !== 'General' && !seen.includes(k)) seen.push(k);
          }
        }
        if (seen.length) strandColumns = ['Week', ...seen];
      }

      return {
        class_level: level,
        subject,
        term: termName,
        strand_columns: strandColumns,
        weeks: weekEntries,
      };
}

/** Debug sink for DEBUG_STRANDS (topic-cell streams of every English row). */
const DEBUG_STREAMS = [];

/** Max x for a line to count as opening in the Week column. */
const WEEK_COL_MAX = 70;

/**
 * x-position where the third column ("Breakdown" / "Content") starts, read
 * from the "Week | Topic | Breakdown" header row. Returns null when the
 * subject's header is not of the 3-column shape (e.g. JSS English Studies,
 * whose header names a strand per column). This is base-table geometry only:
 * it never invents strand bands, it just isolates the Topic cell from the
 * Breakdown cell.
 */
function findTopicColumnBoundary(allLines, startIdx, endIdx) {
  for (let i = startIdx; i < endIdx; i++) {
    const line = allLines[i];
    if (!/^\s*Week\b/i.test(line.text || '')) continue;
    for (const it of line.items) {
      if (it.str && /^(Breakdown|Content)$/i.test(it.str.trim())) return it.x;
    }
  }
  return null;
}

/**
 * Decide the English table shape for this segment. Returns
 * `{ columns: [...] }` (JSS true-column tables) or `null` (inline-label
 * tables + every non-English subject). Detection is by header row: a
 * "Week ... Speech Work ... Grammar ... Composition" header means real
 * strand columns; "Week Topic Breakdown/Content" means inline labels.
 */
function englishTableMode(subject, allLines, segStart, segEnd, colBands) {
  if (!/ENGLISH/i.test(subject || '') || /LITERATURE/i.test(subject || '')) return null;
  if (!colBands || !colBands.bounds) return null;
  // Confirm a true strand-column header exists in this subject's range.
  for (let i = segStart; i < segEnd; i++) {
    const t = allLines[i].text || '';
    if (/^\s*Week\b/i.test(t) && /Speech/i.test(t) && /Composition/i.test(t)) {
      return { columns: JSS_ENGLISH_COLUMNS, bounds: colBands.bounds };
    }
  }
  // Fallback: header lives on a sibling page of the same subject (continuation
  // pages carry no header). Trust pre-scanned bands when the subject is a JSS
  // English Studies table.
  if (/JSS/i.test(colBands.level || '') && /ENGLISH STUDIES/i.test(subject)) {
    return { columns: JSS_ENGLISH_COLUMNS, bounds: colBands.bounds };
  }
  return null;
}

/** Fixed strand columns of the JSS English Studies tables. */
const JSS_ENGLISH_COLUMNS = ['Speech Work', 'Grammar', 'Reading & Comprehension', 'Composition', 'Literature in English'];

/**
 * Content lines of a segment: index pages, footers, "GET ACCESS" banners,
 * subject-footer labels, table headers, bare page numbers and standalone term
 * banners removed. Used by every collector so row building and cell text share
 * exactly one definition of "what counts as table content".
 */
/** True for a table-content line — excludes index pages, footers, "GET
 * ACCESS" banners, subject-footer labels, table header rows, bare page numbers
 * and standalone term banners. One definition, shared by every collector. */
function isContentLine(line) {
  const text = line.text || '';
  if (line.indexPage) return false;
  if (/GET ACCESS|GET MORE EDUCATIONAL|CLICK HERE|sincere|resources archive/i.test(text)) return false;
  if (/^(JSS|SSS?)\s*[123]/i.test(text.trim())) return false;
  if (/^\s*Week\s+(Topic|Speech|Content)/i.test(text)) return false;
  if (/^\d{1,3}$/.test(text.trim())) return false;
  if (/^\s*(FIRST|SECOND|THIRD)\s*TERM\s*(\([^)]*\))?\s*$/i.test(text)) return false;
  return true;
}

function filterContentLines(allLines, segStart, segEnd) {
  const out = [];
  for (let i = segStart; i < segEnd; i++) {
    const line = allLines[i];
    if (!isContentLine(line)) continue;
    out.push({ idx: i, line, text: line.text || '', x0: line.x0, y: line.y, page: line.page, items: line.items });
  }
  return out;
}

/**
 * Week rows are y-bands grouped PER PAGE. Every page carries its own run of
 * week openers, so a row's band must close at the next opener ON THE SAME
 * PAGE. Ordering all openers together by y let page 5's week 1 band end where
 * page 6's week 9 began, which truncated every wrapped cell after two lines.
 * On each page the last opener runs to the bottom of the page.
 */
function pageBands(openers) {
  const byPage = new Map();
  for (const o of openers) {
    if (!byPage.has(o.page)) byPage.set(o.page, []);
    byPage.get(o.page).push(o);
  }
  const bands = [];
  for (const [, list] of byPage) {
    list.sort((a, b) => b.y - a.y); // visual top-to-bottom
    list.forEach((o, i) => {
      bands.push({
        opener: o,
        range: o.range,
        yTop: o.y,
        // +2pt: cell items can sit a hair above the week number's baseline.
        yBottom: i + 1 < list.length ? list[i + 1].y + 2 : -Infinity,
        page: o.page,
      });
    });
  }
  return bands;
}

/** Items of one x-band inside one row band, in reading order. */
function cellItems(content, band, bLo, bHi) {
  const items = [];
  for (const ln of content) {
    if (ln.page !== band.page) continue;
    if (ln.y > band.yTop + 2 || ln.y < band.yBottom) continue;
    for (const it of ln.items) {
      if (it.x >= bLo && it.x < bHi && it.str != null && it.str !== '') items.push(it);
    }
  }
  return items;
}

/**
 * Render a cell: group items into visual lines (top-to-bottom), render each
 * line left-to-right, then join the lines in reading order.
 */
function renderCellItems(items) {
  const sorted = items.slice().sort((a, b) => a.y - b.y || a.x - b.x);
  const cellLines = [];
  let cur = null, lastY = null;
  for (const it of sorted) {
    if (lastY !== null && Math.abs(it.y - lastY) > 5) { if (cur) cellLines.push(cur); cur = []; }
    else if (!cur) cur = [];
    cur.push(it);
    lastY = it.y;
  }
  if (cur) cellLines.push(cur);
  cellLines.sort((a, b) => b[0].y - a[0].y);
  return tidySpaces(cellLines.map(ln => lineText({ items: ln.slice().sort((x, y) => x.x - y.x) })).join(' '));
}

/**
 * Column-mode collector for JSS English Studies: each week row is a y-band
 * between consecutive Week-column openers on the same page; cell text is
 * rendered per x-band (top-to-bottom within the cell). No label guessing —
 * position decides.
 */
function collectSegmentColumns(allLines, segStart, segEnd, subject, level, termName, mode) {
  const content = filterContentLines(allLines, segStart, segEnd);
  const openers = [];
  for (const ln of content) {
    const range = parseWeekRange(ln.text);
    if (range && (ln.x0 == null || ln.x0 < WEEK_COL_MAX)) openers.push({ ...ln, range });
  }
  if (!openers.length) return null;
  const bounds = mode.bounds; // 5 boundaries → 6 bands (week + 5 strands)
  const bands = pageBands(openers).sort(
    (a, b) => (a.range.start - b.range.start) || (a.range.end - b.range.end)
  );

  const weekEntries = [];
  let lastKey = null;
  for (const band of bands) {
    // Headers occasionally use a different abbreviated label/width on a
    // continuation page (notably JSS3 p145's "Comprehension / Vocabulary").
    // Recalibrate from the six repeated cell-start x positions on THIS page
    // when its geometry materially differs from the subject-header geometry.
    const pageBounds = jssEnglishPageBounds(
      content, band.page, bounds, level === 'JSS3' && termName === 'Third Term'
    );
    const topics = {};
    const cellTexts = [];
    for (let c = 0; c < mode.columns.length; c++) {
      const t = renderCellItems(cellItems(content, band, pageBounds[c + 1].lo, pageBounds[c + 1].hi));
      cellTexts.push(t);
      if (t) topics[mode.columns[c]] = t;
    }
    if (!Object.keys(topics).length) continue;
    const key = band.range.start + '-' + band.range.end;
    if (key === lastKey) continue;
    lastKey = key;
    const rawText = cleanRawText(band.range.start + (band.range.end !== band.range.start ? '-' + band.range.end : '') + ' ' + cellTexts.join(' '));
    const isBreak = /mid[-\s]?term|break|holiday/i.test(rawText);
    weekEntries.push({
      week_start: band.range.start,
      week_end: band.range.end,
      break: isBreak,
      topics,
      raw_text: rawText,
      source_page: band.page,
    });
  }
  if (!weekEntries.length) return null;
  return {
    class_level: level,
    subject,
    term: termName,
    strand_columns: ['Week', ...mode.columns],
    weeks: weekEntries,
  };
}

/**
 * The JSS English pages have five real content columns.  Their headings can
 * wrap or abbreviate, but their cells start in six stable horizontal lanes.
 * Recover those lanes from the most frequent item x-coordinate in each lane,
 * then use their midpoints as boundaries.  `fallback` retains the subject
 * header geometry if a sparse continuation page supplies too little data.
 */
function jssEnglishPageBounds(content, page, fallback, allowRecalibration) {
  if (!allowRecalibration) return fallback;
  const lanes = [[-Infinity, 65], [65, 140], [140, 220], [220, 320], [320, 450], [450, Infinity]];
  const starts = lanes.map(([lo, hi], i) => {
    const counts = new Map();
    for (const ln of content) {
      if (ln.page !== page) continue;
      for (const it of ln.items) {
        if (!it.str || !it.str.trim() || it.x < lo || it.x >= hi) continue;
        const key = Math.round(it.x * 2) / 2;
        counts.set(key, (counts.get(key) || 0) + 1);
      }
    }
    // A wrapped line can make an interior word the most frequent x value;
    // the leftmost repeated position is the cell's actual start.
    const repeated = [...counts.entries()].filter(([, count]) => count >= 3).sort((a, b) => a[0] - b[0]);
    const best = repeated[0] || [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0];
    return best ? best[0] : fallback[i].lo;
  });
  // A malformed/sparse page must never produce crossing bands.
  if (starts.some((x, i) => !Number.isFinite(x) || (i && x <= starts[i - 1]))) return fallback;
  // Normal pages already have reliable header geometry. Only replace it
  // when an abbreviated continuation header has actually moved a column.
  if (!starts.some((x, i) => i > 1 && Math.abs(x - fallback[i].lo) > 20)) return fallback;
  // These PDFs position each cell flush to its x lane. Using the next lane
  // start (rather than a midpoint) keeps long words such as "Diphthongs"
  // in their column while assigning a new cell at its true x start.
  return starts.map((start, i) => ({
    lo: i === 0 ? -Infinity : start,
    hi: i === starts.length - 1 ? Infinity : starts[i + 1],
  }));
}

/**
 * Column labels that actually appear as headers in this PDF, longest form
 * first so "Content / Subtopics" beats "Content". Taken from a scan of every
 * header row in the document (174x "Week Topic Content", 93x "Week Topic
 * Content Breakdown", 47x "Week Topic Breakdown (Subtopics)", ...), not
 * guessed from subject names.
 */
const HEADER_COL_NAME_RE = new RegExp(
  [
    'Week',
    'Thème\\s*\\/\\s*Unité',
    'Theme\\s*\\/\\s*Topic',
    'Performance\\s+Objectives',
    'Learning\\s+Objectives',
    'Content\\s*\\/\\s*(?:Subtopics|Activities)',
    'Breakdown\\s*\\(\\s*Subtopics\\s*\\)',
    'Breakdown\\s*\\/\\s*Subtopics',
    'Topics?',
    'Thème',
    'Theme',
    'Contenu',
    'Content',
    'Breakdown',
    'Subtopics',
    'Activities',
  ].join('|'),
  'gi'
);

/**
 * Header labels are printed in mixed case across the document ("Week Topic
 * Content" on 174 pages, "WEEK TOPIC CONTENT" on 8). Column keys are compared
 * and grouped, so normalise the casing to one display form.
 */
function canonicalHeaderName(s) {
  return tidySpaces(s)
    .toLowerCase()
    .replace(/(?:^|[^\p{L}])\p{L}/gu, ch => ch.toUpperCase());
}

/** How close a data item must sit to a header label to confirm a column there. */
const HEADER_COL_TOLERANCE = 2.5;

/** Minimum empty space before a column start (pt) — a smaller gap means the
 * text of the previous cell simply continues (merged header cell). */
const COLUMN_GUTTER = 12;

/**
 * Read a table's own header row into named columns.
 *
 * Column NAMES come from the header text; the column BOUNDARIES are confirmed
 * against the page's own data, because a header cell can print two words for
 * one column. "Week Topic Content Breakdown" is 93 pages of a single merged
 * content column: the word "Breakdown" sits 46pt right of "Content", and the
 * content text runs straight across that position — the item before it ends
 * hard against it — so a label whose position the cell text flows through is
 * folded into the label before it rather than starting a column of its own.
 * Returns null when the lines hold no recognisable header.
 */
function findHeaderColumns(pageLines) {
  const header = pageLines.find(ln => /^\s*Week\b/i.test(ln.text || ''));
  if (!header) return null;
  const items = header.items.filter(it => it.str && it.str.trim()).slice().sort((a, b) => a.x - b.x);
  if (!items.length) return null;

  // Rebuild the header text, remembering the character offset and x of each
  // item, so a matched label can be mapped back to the x where it starts.
  let text = '';
  const offsets = [];
  let prevEnd = null;
  for (const it of items) {
    if (prevEnd !== null && it.x - prevEnd > 1.2) text += ' ';
    offsets.push({ start: text.length, x: it.x });
    text += it.str.trim();
    prevEnd = it.x + (typeof it.width === 'number' && it.width > 0 ? it.width : 0);
  }

  // Is x a real cell boundary on this page? Two independent x-only signals
  // (item widths in this PDF are unreliable — short tokens often report the
  // whole run's width): either a cell's wrapped text starts a line at x, or
  // there is a clear gutter before x. Where the cell text flows straight
  // through x, neither holds — which is how the merged "Content Breakdown"
  // heading is recognised as one column.
  const lineStarts = [];
  const dataXs = [];
  for (const ln of pageLines) {
    if (ln === header) continue;
    const its = ln.items.filter(it => it.str && it.str.trim()).sort((a, b) => a.x - b.x);
    if (its.length) lineStarts.push(its[0].x);
    for (const it of its) dataXs.push(it.x);
  }
  dataXs.sort((a, b) => a - b);
  const isColumnStart = (x) => {
    if (lineStarts.some(sx => Math.abs(sx - x) <= HEADER_COL_TOLERANCE)) return true;
    const before = dataXs.filter(dx => dx < x).pop();
    return before === undefined || x - before >= COLUMN_GUTTER;
  };

  const cols = [];
  HEADER_COL_NAME_RE.lastIndex = 0;
  let m;
  while ((m = HEADER_COL_NAME_RE.exec(text))) {
    const off = offsets.filter(o => o.start <= m.index).pop() || offsets[0];
    const name = canonicalHeaderName(m[0]);
    if (!cols.length) {
      if (!/^week$/i.test(name)) return null; // not a table header row
      cols.push({ name: 'Week', x: off.x });
    } else if (isColumnStart(off.x)) {
      cols.push({ name, x: off.x });
    } else {
      // No data under this label — it is the second word of the previous
      // column's heading ("Content Breakdown", "Breakdown (Subtopics)").
      cols[cols.length - 1].name = canonicalHeaderName(cols[cols.length - 1].name + ' ' + name);
    }
    HEADER_COL_NAME_RE.lastIndex = m.index + m[0].length;
  }
  if (process.env.DEBUG_HEADER) {
    console.error(`[hdr2] header=${JSON.stringify(header.text)} cols=${JSON.stringify(cols.map(c => [c.name, c.x]))}`);
  }
  if (cols.length < 3) return null;
  return cols;
}

/**
 * Header-driven collector for the non-English subjects. Each week row is a
 * y-band on one page; every column is rendered from its own x-band, so Topic
 * and Content land under their own keys. A cell that holds no text is simply
 * absent from `topics` — never an empty string. Columns are per page (every
 * page carries its own header row here) and inherited by any continuation page
 * that does not.
 */
function collectSegmentByHeader(allLines, segStart, segEnd, subject, level, termName) {
  const pageLines = new Map();
  for (let i = segStart; i < segEnd; i++) {
    const line = allLines[i];
    if (line.indexPage) continue;
    if (!pageLines.has(line.page)) pageLines.set(line.page, []);
    pageLines.get(line.page).push(line);
  }
  let lastCols = null;
  const colsByPage = new Map();
  for (const page of [...pageLines.keys()].sort((a, b) => a - b)) {
    const cols = findHeaderColumns(pageLines.get(page));
    if (cols) { colsByPage.set(page, cols); lastCols = cols; }
    else if (lastCols) colsByPage.set(page, lastCols);
  }
  if (process.env.DEBUG_HEADER && /COMPUTER HARDWARE/i.test(subject)) {
    console.error(`[hdr] ${level} ${subject} ${termName}: pages=${[...pageLines.keys()].join(',')} cols=${[...colsByPage.keys()].join(',')}`);
    for (const p of pageLines.keys()) {
      const h = (pageLines.get(p) || []).find(ln => /^\s*Week\b/i.test(ln.text || ''));
      console.error(`      page ${p}: header=${h ? JSON.stringify(h.text) : 'NONE'}`);
    }
  }
  if (!colsByPage.size) return null;

  const content = filterContentLines(allLines, segStart, segEnd);
  const openers = [];
  for (const ln of content) {
    const range = parseWeekRange(ln.text);
    if (range && (ln.x0 == null || ln.x0 < WEEK_COL_MAX)) openers.push({ ...ln, range });
  }
  if (!openers.length) return null;
  const bands = pageBands(openers).sort(
    (a, b) => (a.range.start - b.range.start) || (a.range.end - b.range.end)
  );

  const weekEntries = [];
  const strandColumns = ['Week'];
  let lastKey = null;
  for (const band of bands) {
    const cols = colsByPage.get(band.page);
    if (!cols) continue;
    for (const c of cols.slice(1)) if (!strandColumns.includes(c.name)) strandColumns.push(c.name);
    const topics = {};
    const cellTexts = [];
    for (let c = 1; c < cols.length; c++) {
      const bHi = c + 1 < cols.length ? cols[c + 1].x : Infinity;
      // The Week glyph can slightly overhang the Topic boundary on a few
      // pages. It belongs to row metadata, never to a topic value.
      const rendered = renderCellItems(cellItems(content, band, cols[c].x, bHi));
      const t = c === 1 ? stripWeekPrefix(rendered) : rendered;
      cellTexts.push(t);
      if (t) topics[cols[c].name] = t;
    }
    if (!Object.keys(topics).length) continue;
    const key = band.range.start + '-' + band.range.end;
    if (key === lastKey) continue;
    lastKey = key;
    const rawText = cleanRawText(band.range.start + (band.range.end !== band.range.start ? '-' + band.range.end : '') + ' ' + cellTexts.join(' '));
    weekEntries.push({
      week_start: band.range.start,
      week_end: band.range.end,
      break: /mid[-\s]?term|break|holiday/i.test(rawText),
      topics,
      raw_text: rawText,
      source_page: band.page,
    });
  }
  if (!weekEntries.length) return null;
  return {
    class_level: level,
    subject,
    term: termName,
    strand_columns: strandColumns,
    weeks: weekEntries,
  };
}

/**
 * Scan a subject's line range for the JSS English strand-column header and
 * derive x-band boundaries from its cell positions. Returns
 * `{ level, bounds }` (bounds[0] = Week band, bounds[1..5] = strands) or
 * `{ level, bounds: null }` when no column header exists (inline tables).
 */
function findColumnBands(allLines, startIdx, endIdx, level) {
  const out = { level, bounds: null };
  for (let i = startIdx; i < endIdx; i++) {
    const line = allLines[i];
    const t = line.text || '';
    if (!/^\s*Week\b/i.test(t) || !/Composition/i.test(t)) continue;
    const byX = line.items.slice().sort((a, b) => a.x - b.x);
    const findStart = (names) => {
      for (const it of byX) {
        if (it.str && names.includes(it.str.trim())) return it;
      }
      return null;
    };
    const week = findStart(['Week', 'WEEK']);
    const speech = findStart(['Speech', 'S', 'Work']);
    const grammar = findStart(['Grammar', 'GRAMMAR']);
    const reading = findStart(['Reading', 'READING']);
    const comp = findStart(['Composition']);
    const lit = findStart(['Literature', 'Lit', 'LITERATURE']);
    if (!(week && grammar && reading && comp)) continue;
    // Column starts (JSS3 letter-spaced headers: 'Work' doubles for Speech).
    const starts = [
      week.x,
      speech ? Math.min(speech.x, (findStart(['Work']) || speech).x) : week.x + 41,
      grammar.x, reading.x, comp.x,
      lit ? lit.x : comp.x + 80,
    ];
    const ends = [
      week.x + (week.width || 30), speech ? speech.x + 70 : starts[1] + 70,
      grammar.x + (grammar.width || 52), reading.x + 60, comp.x + (comp.width || 68),
      Infinity,
    ];
    const bounds = [{ lo: -Infinity, hi: null }];
    // bounds[0] = Week band, bounds[1..5] = strand bands.
    bounds[0] = { lo: -Infinity, hi: (ends[0] + starts[1]) / 2 };
    for (let c = 1; c <= 5; c++) {
      bounds[c] = { lo: bounds[c - 1].hi, hi: c < 5 ? (ends[c] + starts[c + 1]) / 2 : Infinity };
    }
    out.bounds = bounds;
    out.headerText = t;
    return out;
  }
  return out;
}

/**
 * Remove footer/page-number contamination from assembled row text:
 * "GET ACCESS..." banners, subject-scheme footers (spaced or glued), and
 * trailing page numbers ("...countries). 199").
 */
function cleanRawText(s) {
  let t = (s || '').replace(/\s+/g, ' ').trim();
  t = t.replace(/GET ACCESS.*$/i, '').trim();
  t = t.replace(/(JSS|SSS?)\s*[123]\s*[A-Z][A-Z\s&()\/.\-]*SCHEME OF WORK.*$/i, '').trim();
  t = t.replace(/\s+\d{3}\s*$/, '').trim();
  return t.replace(/\s+/g, ' ').trim();
}

/** True for subjects whose topic cells carry inline strand labels. */
function isEnglishSubject(subject) {
  return /ENGLISH|LITERATURE/i.test(subject || '');
}

/**
 * Last-resort shape when a subject's table header could not be read: keep the
 * whole row text under the subject's last known column. Only that one key is
 * emitted — a column this row has nothing for is absent, never "".
 */
function englishFallbackTopics(rawText, subject) {
  // Fallback rows are assembled from the Week-column opener, so remove that
  // structural marker before storing the single available content cell.
  const text = stripWeekPrefix((rawText || '').replace(/\s+/g, ' ').trim());
  if (!text) return {};
  const cols = knownStrandColumns(subject);
  return { [cols[cols.length - 1]]: text };
}

/**
 * Known inline strand labels for the 3-column (Week | Topic | Breakdown)
 * English tables. Built from a scan of the Topic-cell text that actually
 * occurs in this PDF, so it lists the spellings the source really uses
 * rather than an idealised set. `bare` marks labels distinctive enough to
 * split on even when the trailing colon is missing (the PDF drops it on a
 * few wrapped labels, e.g. SSS1 English week 3 "Reading Comprehension");
 * short ambiguous labels (Oral, Writing, Reading, ...) always require the
 * colon, so ordinary topic prose can never be mistaken for a label.
 */
const STRAND_LABELS = [
  // [alias, canonical strand, allowWithoutColon]
  ['Literature in English', 'Literature in English', true],
  ['Literary Appreciation', 'Literature in English', true],
  ['Shakespearean Text', 'Literature in English', true],
  ['Non-African Drama', 'Literature in English', true],
  ['Non-African Prose', 'Literature in English', true],
  ['African Drama', 'Literature in English', true],
  ['African Prose', 'Literature in English', true],
  ['Figures of Speech', 'Literature in English', true],
  ['Listening Comprehension', 'Listening Comprehension', true],
  ['Comprehension/Listening', 'Listening Comprehension', false],
  ['Reading Comprehension', 'Reading Comprehension', true],
  ['Vocabulary/Comprehension', 'Reading Comprehension', false],
  ['Vocabulary Development', 'Vocabulary Development', true],
  ['Continuous Writing', 'Continuous Writing', true],
  ['Spoken English', 'Spoken English', true],
  ['Speech Work', 'Spoken English', true],
  ['Composition', 'Continuous Writing', false],
  ['Literature', 'Literature in English', false],
  ['Vocabulary', 'Vocabulary Development', false],
  ['Comprehension', 'Reading Comprehension', false],
  ['Structure', 'Structure', false],
  ['Dictation', 'Dictation', false],
  ['Writing', 'Continuous Writing', false],
  ['Grammar', 'Grammar', false],
  ['Summary', 'Summary', false],
  ['Reading', 'Reading Comprehension', false],
  ['Oral', 'Oral', false],
  ['Prose', 'Literature in English', false],
  ['Drama', 'Literature in English', false],
  ['Poetry', 'Literature in English', false],
];

const STRAND_LABEL_LOOKUP = new Map(
  STRAND_LABELS.map(([alias, canon, bare]) => [alias.toLowerCase(), { canon, bare }])
);

/** Longest alias first so "Reading Comprehension" beats "Reading". */
const STRAND_LABEL_ALT = STRAND_LABELS
  .map(([alias]) => alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  .sort((a, b) => b.length - a.length)
  .join('|');

/** Label must start a word; a trailing colon is optional (see STRAND_LABELS). */
const STRAND_LABEL_RE = new RegExp(
  `(?<![A-Za-z])(?:[A-E]\\.\\s*)?(${STRAND_LABEL_ALT})(\\s*:)?`,
  'gi'
);

/**
 * Dash form: "<label> – <topic>" with no colon. A few SSS3 rows write the
 * strand that way ("Comprehension – Silent Reading"). Only labels that open
 * the cell or are distinctive multi-word labels may use it, so an ordinary
 * topic such as "Summary Writing – Summarizing a Talk/Lecture" is not
 * mistaken for a lone "Writing" label and stays whole.
 */
const STRAND_LABEL_DASH_RE = new RegExp(
  `(?<![A-Za-z])(?:[A-E]\\.\\s*)?(${STRAND_LABEL_ALT})(\\s*[\u2013\u2014-]\\s+)`,
  'gi'
);

/**
 * Split an assembled English row into strand segments at KNOWN inline labels
 * ("Grammar: ... Vocabulary Development: ..."). Only labels in STRAND_LABELS
 * cause a split, so sub-detail heads ("Pronunciation:", "Week 11:") stay
 * glued to the strand they belong to instead of spawning noise strands.
 * The full row text is always preserved separately as raw_text, so a split
 * that misses an edge case loses nothing.
 */
function splitInlineStrands(rawText) {
  const text = stripWeekPrefix(rawText).replace(/\s+/g, ' ');
  const hits = collectLabelHits(text);
  const topics = {};
  if (!hits.length) {
    if (text) topics['General'] = text;
    return topics;
  }
  // Text before the first label (e.g. a topic head like "Consonants -") is
  // treated as that label's topic name rather than discarded.
  for (let i = 0; i < hits.length; i++) {
    const bodyStart = hits[i].end;
    const bodyEnd = i + 1 < hits.length ? hits[i + 1].start : text.length;
    let segText = text.slice(bodyStart, bodyEnd).trim();
    if (i === 0) {
      const pre = text.slice(0, hits[0].start).trim();
      if (pre) segText = (pre + ' ' + segText).trim();
    }
    const clean = tidySpaces(segText);
    if (!clean) continue;
    const canon = hits[i].canon;
    topics[canon] = topics[canon] ? topics[canon] + ' ' + clean : clean;
  }
  // Labels present but every one of them carried no topic text (e.g. a row
  // whose cells sit entirely in the Breakdown column) — keep the row instead
  // of emitting an entry with no strands at all.
  if (!Object.keys(topics).length && text) topics['General'] = text;
  return topics;
}

/**
 * Every strande-label occurrence in `text`, as { canon, start, end } in
 * position order. Colon form first, then the dash form, then overlaps are
 * resolved in favour of the match that consumes the most separator text.
 */
function collectLabelHits(text) {
  const hits = [];
  let m;
  STRAND_LABEL_RE.lastIndex = 0;
  while ((m = STRAND_LABEL_RE.exec(text))) {
    const aliasRaw = m[1];
    const colon = m[2] || '';
    const hitEnd = m.index + m[0].length;
    const labelStart = hitEnd - colon.length - aliasRaw.length;
    const entry = STRAND_LABEL_LOOKUP.get(aliasRaw.toLowerCase());
    if (!entry || (!colon && !entry.bare)) {
      // Unusable candidate: resume just past this alias (not its colon) so a
      // real label hidden later in the same phrase still gets its chance.
      STRAND_LABEL_RE.lastIndex = labelStart + aliasRaw.length;
      continue;
    }
    hits.push({ canon: entry.canon, start: labelStart, end: hitEnd });
  }
  STRAND_LABEL_DASH_RE.lastIndex = 0;
  while ((m = STRAND_LABEL_DASH_RE.exec(text))) {
    const aliasRaw = m[1];
    const dash = m[2];
    const hitEnd = m.index + m[0].length;
    const labelStart = hitEnd - dash.length - aliasRaw.length;
    const entry = STRAND_LABEL_LOOKUP.get(aliasRaw.toLowerCase());
    if (!entry || !(labelStart === 0 || entry.bare)) continue;
    hits.push({ canon: entry.canon, start: labelStart, end: hitEnd });
  }
  // Earliest first, longest first at a given start; then drop overlaps.
  hits.sort((a, b) => a.start - b.start || b.end - a.end);
  const kept = [];
  for (const h of hits) {
    if (kept.length && h.start < kept[kept.length - 1].end) continue;
    kept.push(h);
  }
  return kept;
}

/**
 * The canonical strand when a cell is nothing but a strand name — "Listening
 * Comprehension", "Vocabulary Development". Used where the topic text for
 * that strand lives in the neighbouring cell instead of next to the label.
 */
function wholeCellStrand(text) {
  const t = tidySpaces(stripWeekPrefix(text || ''));
  if (!t) return null;
  const entry = STRAND_LABEL_LOOKUP.get(t.toLowerCase());
  return entry ? entry.canon : null;
}

/**
 * How many real strands a split produced with non-empty topic text. Used to
 * pick between the Topic cell and the detail cell when both are candidates.
 */
function strandScore(topics) {
  if (!topics) return 0;
  return Object.keys(topics).filter(k => k !== 'General' && topics[k]).length;
}

/** Strip the leading week expression ("6", "11-13", "WEEK 1:", "1 & 2") from row text. */
function stripWeekPrefix(text) {
  return (text || '')
    // PDF item runs sometimes glue the number to the first Topic word
    // ("13Closing").  The number is still row metadata, not topic text.
    // Do not eat a leading dash: in rows such as "12 – –" it is meaningful
    // cell content, not punctuation after the week marker.
    .replace(/^\s*(?:week\s*)?\d{1,2}(?!\d)(?:\s*(?:[–—\-]|&|\band\b|\bto\b)\s*\d{1,2})?\s*[.)\s:]*/, '')
    .trim();
}

/**
 * Find the index of the next subject heading boundary after `startIdx`.
 * Scans all boundaries for the minimum (robust to insertion order).
 */
function nextSubjectBoundary(allLines, boundaries, startIdx) {
  let next = allLines.length;
  for (const b of boundaries) {
    if (b.type === 'subject-heading' && b.idx > startIdx && b.idx < next) next = b.idx;
  }
  return next;
}

/** Normalize term name from strict standalone banner (e.g. "FIRSTTERM" → "First Term").
 *  Returns null when there is no FIRST|SECOND|THIRD match — callers drop that
 *  segment entirely (no preamble entries, no bare 'Term' fallback). */
function normalizeTermName(raw) {
  if (typeof raw !== 'string') return null;
  const m = /\b(FIRST|SECOND|THIRD)\s*TERM\b/i.exec(raw);
  if (!m) return null;
  const num = m[1].toUpperCase();
  return `${num === 'FIRST' ? 'First' : num === 'SECOND' ? 'Second' : 'Third'} Term`;
}

/**
 * Extract a week range from a text line. Returns {start, end} or null.
 * Combined-week rows ("5-10", "2 - 3", "1 & 2") yield a range; ordinary
 * rows yield start === end. Verse/angle/page-number guards from the
 * week-validation pass are enforced here for both shapes.
 */
function parseWeekRange(text) {
  if (typeof text !== 'string') return null;
  const t = text.trim();
  if (!t) return null;
  // Pure page-number footer lines ("45", "46") are not weeks.
  if (/^\d{1,3}$/.test(t)) return null;
  const body = t.replace(/^week\s*/i, '');
  // Combined-week row first ("5–10", "2 - 3", "1 & 2", "1 and 2").
  let m = /^(\d{1,2})\s*(?:[–—\-]|&|\band\b|\bto\b)\s*(\d{1,2})\b/.exec(body);
  if (m) {
    const a = parseInt(m[1], 10);
    const b = parseInt(m[2], 10);
    const rest = body.slice(m[0].length);
    if (a >= 1 && b <= 14 && a <= b && !/^[);°]/.test(rest) && !/^:\d/.test(rest)) {
      return { start: a, end: b };
    }
  }
  // Shared validation for the single-week shape below.
  const valid = (n, rest) => {
    // NERDC terms run 1-14 weeks; anything above is a verse/article
    // fragment, never a week row (census: legit max is 14).
    if (!Number.isInteger(n) || n < 1 || n > 14) return null;
    // Bible-verse tails ("25);...", "19)", "18:21-22"), angle measures
    // ("45°,60°,90°") and kin are not week rows: a real week number opens
    // topic text (space/punctuation), never a closing paren, semicolon,
    // degree sign, or colon glued to another digit. "WEEK 1: Intro" still
    // passes — its colon is followed by a space, not a digit.
    if (/^[);°]/.test(rest)) return null;
    if (/^:\d/.test(rest)) return null;
    return { start: n, end: n };
  };
  m = /^(\d{1,2})\b/.exec(body);
  if (m) return valid(parseInt(m[1], 10), body.slice(m[0].length));
  return null;
}

/**
 * Known strand column sets per subject (table columns for non-English
 * subjects, whose rows keep the whole text in the Content cell).
 */
function knownStrandColumns(subject, level) {
  const lower = (subject || '').toLowerCase();
  if (lower.includes('literature')) return ['Week', 'Literature in English'];
  if (lower.includes('english')) {
    // JSS: true strand columns; SSS: inline labels (union override per entry).
    if (/^sss/i.test(level || '')) return ['Week', 'Grammar', 'Oral', 'Spoken English', 'Vocabulary Development', 'Reading Comprehension', 'Listening Comprehension', 'Continuous Writing', 'Summary', 'Dictation'];
    return ['Week', 'Speech Work', 'Grammar', 'Reading & Comprehension', 'Composition', 'Literature in English'];
  }
  if (lower.includes('mathematics') || lower.includes('maths')) return ['Week', 'Topic', 'Content / Activities', 'Performance Objectives'];
  if (lower.includes('physics') || lower.includes('chemistry') || lower.includes('biology')) return ['Week', 'Topic', 'Content', 'Performance Objectives'];
  if (lower.includes('creative') || lower.includes('cultural') || lower.includes('arts')) return ['Week', 'Topic', 'Content'];
  if (lower.includes('physical') || lower.includes('health')) return ['Week', 'Topic', 'Activities'];
  if (lower.includes('civic') || lower.includes('social') || lower.includes('citizenship')) return ['Week', 'Topic', 'Content'];
  if (lower.includes('agricultural') || lower.includes('agric')) return ['Week', 'Topic', 'Content'];
  if (lower.includes('business') || lower.includes('commerce') || lower.includes('accounting')) return ['Week', 'Topic', 'Content'];
  if (lower.includes('computer') || lower.includes('digital') || lower.includes('information')) return ['Week', 'Topic', 'Content'];
  if (lower.includes('french')) return ['Week', 'Topic', 'Content'];
  if (lower.includes('yoruba') || lower.includes('hausa') || lower.includes('igbo')) return ['Week', 'Topic', 'Content'];
  if (lower.includes('history') || lower.includes('government') || lower.includes('economics')) return ['Week', 'Topic', 'Content'];
  if (lower.includes('religious') || lower.includes('crs') || lower.includes('irs') || lower.includes('christian') || lower.includes('islam')) return ['Week', 'Topic', 'Content'];
  if (lower.includes('home economics')) return ['Week', 'Topic', 'Content'];
  if (lower.includes('security')) return ['Week', 'Topic', 'Content'];
  if (lower.includes('national values')) return ['Week', 'Topic', 'Content'];
  if (lower.includes('trade')) return ['Week', 'Topic', 'Content'];
  // default
  return ['Week', 'Topic', 'Content'];
}

// ---- Main ----

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  if (!fs.existsSync(PDF_PATH)) {
    console.error(`PDF not found at: ${PDF_PATH}`);
    process.exit(1);
  }

  const buf = fs.readFileSync(PDF_PATH);
  const instance = new PDFParse(new Uint8Array(buf), { verbosity: VerbosityLevel.DEBUG });
  await instance.load();
  const doc = instance.doc;

  // Use the doc's internal page count (more reliable than getInfo for v2)
  const pageCount = (doc._pdfInfo && doc._pdfInfo.numPages) || 0;
  console.log(`PDF loaded: ${pageCount} pages`);

  // ---- Step 1: level start pages (verified by scanning footer text) ----
  const KNOWN_LEVEL_START_PAGES = {
    JSS1: 5,
    JSS2: 75,
    JSS3: 141,
    SSS1: 200,
    SSS2: 292,
    SSS3: 382,
  };
  const levelStartPages = {};
  for (const [level, pn] of Object.entries(KNOWN_LEVEL_START_PAGES)) {
    if (pn > pageCount) { console.warn(`Level ${level}: start ${pn} > pageCount ${pageCount}`); continue; }
    const items = await pageItems(doc, pn);
    const foot = items.filter(it => it.y > 775 && it.x < 260).sort((a,b)=>a.x-b.x).map(it => it.str).join(' ');
    const norm = foot.toUpperCase().replace(/[^A-Z0-9 ]/g,'').replace(/\s+/g,' ').trim();
    const expected = level.startsWith('SS') ? `SS${level.slice(3)}` : level;
    levelStartPages[level] = pn;
    console.log(`Level ${level} -> page ${pn}  footer: ${JSON.stringify(norm)}`);
  }
  const levels = ['JSS1','JSS2','JSS3','SSS1','SSS2','SSS3'];
  const levelRanges = {};
  for (let i = 0; i < levels.length; i++) {
    const level = levels[i];
    const start = levelStartPages[level];
    if (!start) { console.warn(`No start page for ${level}`); continue; }
    let end = pageCount;
    for (let j = i + 1; j < levels.length; j++) {
      const ns = levelStartPages[levels[j]];
      if (ns) { end = ns - 1; break; }
    }
    levelRanges[level] = { start, end };
  }

  // Step 2: parse each level's pages into entries
  const byLevel = {};
  for (const [level, range] of Object.entries(levelRanges)) {
    console.log(`Parsing ${level} (pages ${range.start}-${range.end})...`);
    const entries = await parseLevelPages(doc, range, level);
    byLevel[level] = entries;
    console.log(`  ${level}: ${entries.length} entries`);
    for (const e of entries) {
      console.log(`    - ${e.subject} · ${e.term} · strands: ${e.strand_columns.join(', ')} · weeks: ${e.weeks.length}`);
    }
  }

  // Step 3: write output files
  for (const [level, entries] of Object.entries(byLevel)) {
    const outPath = path.join(OUT_DIR, `${level}.json`);
    fs.writeFileSync(outPath, JSON.stringify(entries, null, 2), 'utf8');
    console.log(`Wrote ${outPath} (${entries.length} entries)`);
  }

  if (process.env.DEBUG_STRANDS) {
    fs.writeFileSync(path.join(OUT_DIR, 'debug-topic-streams.json'), JSON.stringify(DEBUG_STREAMS, null, 2), 'utf8');
    console.log(`Wrote debug-topic-streams.json (${DEBUG_STREAMS.length} rows)`);
  }

  const indexPath = path.join(OUT_DIR, 'index.json');
  fs.writeFileSync(indexPath, JSON.stringify(byLevel, null, 2), 'utf8');
  console.log(`Wrote ${indexPath} (combined)`);

  // Step 4: write a focused sample for review — the first entry of the first level
  const firstLevel = levels.find(l => byLevel[l] && byLevel[l].length);
  if (firstLevel) {
    const sample = byLevel[firstLevel][0];
    const samplePath = path.join(OUT_DIR, 'sample-first-entry.json');
    fs.writeFileSync(samplePath, JSON.stringify(sample, null, 2), 'utf8');
    console.log(`\nSample (first entry of ${firstLevel}) → ${samplePath}`);
    console.log('Subject:', sample.subject);
    console.log('Term:', sample.term);
    console.log('Strand columns:', sample.strand_columns.join(', '));
    console.log('Number of weeks:', sample.weeks.length);
    console.log('\nFirst 4 weeks:');
    sample.weeks.slice(0, 4).forEach(w => {
      console.log(`  Week ${w.week_start}${w.week_end !== w.week_start ? '-' + w.week_end : ''}${w.break ? ' [BREAK]' : ''}:`);
      Object.entries(w.topics).forEach(([strand, topic]) => {
        console.log(`    ${strand}: ${topic}`);
      });
    });
  }

  // Step 5: focused review sample — SSS1 English Studies, First Term. This is
  // the level that exercises the inline strand-label split (3-column
  // Week | Topic | Breakdown table), so it is written out on its own.
  const sss1English = (byLevel.SSS1 || []).find(e => /^ENGLISH/i.test(e.subject || ''));
  if (sss1English) {
    const p = path.join(OUT_DIR, 'sample-sss1-english.json');
    fs.writeFileSync(p, JSON.stringify(sss1English, null, 2), 'utf8');
    console.log(`\nSSS1 English sample → ${p}`);
    fmtEntry(sss1English);
  }

  // Step 6: shape reference for the downstream Supabase schema/seed work.
  // Generated from the real parse (it had already drifted once when it was
  // hand-written), one entry per table shape, trimmed to a few weeks each.
  const schemaPath = path.join(OUT_DIR, 'sample-schema.json');
  fs.writeFileSync(schemaPath, JSON.stringify(buildSchemaSample(byLevel), null, 2), 'utf8');
  console.log(`Wrote ${schemaPath} (shape reference)`);
}

/**
 * One real (trimmed) entry per table shape plus a combined-week example, so
 * sample-schema.json documents what the parser actually emits rather than an
 * idealised sketch.
 */
function buildSchemaSample(byLevel) {
  const pick = (level, subjectRe, term) => {
    const pool = (byLevel[level] || []).filter(e => subjectRe.test(e.subject || ''));
    return (term && pool.find(e => e.term === term)) || pool[0] || null;
  };

  // First combined-week row in the corpus (week_start !== week_end).
  let combined = null;
  for (const lv of Object.keys(byLevel)) {
    for (const e of byLevel[lv]) {
      const w = e.weeks.find(x => x.week_end !== x.week_start);
      if (w) { combined = { ...e, weeks: [w] }; break; }
    }
    if (combined) break;
  }

  const shapes = [
    ['JSS English Studies — a true 6-column table (Week | Speech Work | Grammar | Reading & | ' +
     'Composition | Literature in English). Strands come from column position, so there is no ' +
     '`breakdown` key. `class_level` is on the entry, not the week.',
      pick('JSS1', /ENGLISH/i, 'First Term'), 5],
    ['SSS English Studies — a 3-column table (Week | Topic | Breakdown) whose strand labels are ' +
     'inline in one cell. `topics` is split at those labels and the other cell is kept verbatim ' +
     'as the optional `breakdown` key. Week 5 shows the break row (`break: true`).',
      pick('SSS1', /ENGLISH/i, 'First Term'), 5],
    ['Every other subject — no strand splitting: the whole row text lands in the last column of ' +
     '`strand_columns`, and the remaining topic keys are emitted as empty strings. There is no ' +
     '`breakdown`. Which columns those are comes from `strand_columns` and varies per subject.',
      pick('JSS1', /MATHEMATIC/i, 'First Term'), 4],
    ['Combined-week row — the source has ONE row covering a span of weeks, so it stays a ' +
     '`week_start`/`week_end` range and is never expanded into per-week duplicates.',
      combined, 1],
  ];

  return {
    comment: [
      'Shape reference for the parsed curriculum JSON, generated by scripts/curriculum-parser.js.',
      'Each level file (tmp/curriculum-parse/<LEVEL>.json) is a bare array of entries, one per ' +
        '(subject, term); sample-first-entry.json and sample-sss1-english.json are single entries, ' +
        'and index.json is the same data keyed by class level.',
      'Entry keys: class_level, subject, term, strand_columns, weeks[].',
      'Week keys: week_start, week_end, break, topics, raw_text — plus an optional `breakdown`.',
      'weeks are truncated to a few rows in this file for readability; the per-level files hold all of them.',
    ],
    shapes: shapes
      .filter(([, entry]) => entry)
      .map(([label, entry, weekCount]) => ({
        label,
        entry: { ...entry, weeks: entry.weeks.slice(0, weekCount) },
      })),
  };
}

/** Print one entry in the human review format used by the samples above. */
function fmtEntry(entry) {
  console.log(`Subject: ${entry.subject} · ${entry.term} · weeks: ${entry.weeks.length}`);
  console.log('Strand columns:', entry.strand_columns.join(', '));
  for (const w of entry.weeks) {
    console.log(`\n  Week ${w.week_start}${w.week_end !== w.week_start ? '-' + w.week_end : ''}${w.break ? ' [BREAK]' : ''}`);
    for (const [strand, topic] of Object.entries(w.topics)) console.log(`    ${strand}: ${topic}`);
    if (w.breakdown) console.log(`    [breakdown] ${w.breakdown}`);
  }
}

main().catch(err => {
  console.error('Parser failed:', err.message);
  console.error(err.stack);
  process.exit(1);
});
