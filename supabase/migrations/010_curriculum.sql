-- NERDC 2025 scheme of work — one row per class/subject/term/week.
--
-- Source: "JSS & SSS - NERDC Scheme (2025).pdf", parsed by
-- scripts/curriculum-parser.js into tmp/curriculum-parse/<LEVEL>.json and
-- loaded by scripts/seed-curriculum.js.
--
-- `subject` is deliberately NOT a foreign key to subjects(id). The curriculum
-- covers every subject the PDF lists (18-28 per level, including trade and
-- vocational ones), whereas `subjects` is the small per-student-category
-- electives list used for scoring (12 rows today). The two disagree on
-- spelling — "ENGLISH STUDIES" vs "English Language", "CHRISTIAN RELIGIOUS
-- STUDIES (CRS)" vs "CRS", "LITERATURE - IN - ENGLISH" vs "Literature" — so
-- the PDF's own wording is stored verbatim here and any reconciliation is a
-- separate, explicit decision.
--
-- `subject_key` is the one normalisation we do apply, so the same subject can be
-- grouped across levels. It is uppercase, '&' expanded to 'AND', parenthetical
-- qualifiers dropped, non-alphanumerics collapsed, plus one explicit alias
-- (CATERING AND CRAFT PRACTICE -> CATERING AND CRAFT). That takes the 43 subject
-- strings in the PDF down to 36 keys. It does NOT merge ENGLISH STUDIES with
-- ENGLISH LANGUAGE — those are two names for one subject in the source, and
-- collapsing them is a judgement call left open on purpose.
--
-- `term` is likewise the plain term name ("First Term"), not the
-- session-qualified string the rest of the app uses ("First Term 2025/2026").
-- See the seed script's output for how the two line up.

create table if not exists curriculum (
  id          uuid primary key default gen_random_uuid(),
  class_level text not null check (class_level in ('JSS1','JSS2','JSS3','SSS1','SSS2','SSS3')),
  subject     text not null,                                  -- verbatim from the PDF
  subject_key text not null,                                  -- normalised, for grouping; see below
  term        text not null check (term in ('First Term','Second Term','Third Term')),
  week_start  smallint not null check (week_start between 1 and 14),
  week_end    smallint not null check (week_end between 1 and 14),
  is_break    boolean not null default false,
  topics      jsonb not null default '{}'::jsonb, -- strand -> topic text; key set varies per subject
  breakdown   text,                               -- nullable: only the SSS "Topic | Breakdown" tables
  raw_text    text not null,                      -- full row text, so a strand split can always be re-checked
  created_at  timestamptz not null default now(),

  -- Combined-week rows ("5-10") keep a range; week_end is never below week_start.
  constraint curriculum_week_range_valid check (week_end >= week_start),

  -- Natural key: one row per class/subject/term/week. This is what makes the
  -- seed a plain upsert, so it is safe and idempotent to re-run.
  constraint curriculum_natural_key unique (class_level, subject, term, week_start)
);

-- The lookup the app needs: a whole term's scheme of work for one class.
create index if not exists curriculum_class_subject_term_idx
  on curriculum (class_level, subject, term);

-- Subject lists / "which levels take this subject" grouping.
create index if not exists curriculum_subject_key_idx
  on curriculum (subject_key);

-- Same lockdown as every other table: RLS on with no policies, so only the
-- service-role key (used by Next.js API routes) can read it. The browser never
-- talks to Supabase directly. "No policies" is intentional, not an oversight.
alter table curriculum enable row level security;
