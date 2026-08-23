-- Run in Supabase SQL Editor. Adds term tracking to results, and a small
-- key/value settings table so admin can control "the current term" that
-- teachers score into by default.

alter table results add column if not exists term text not null default 'First Term 2025/2026';
alter table results drop constraint if exists results_student_id_subject_key;
alter table results add constraint results_student_subject_term_unique unique (student_id, subject, term);

create table if not exists settings (
  key text primary key,
  value text
);
alter table settings enable row level security;
insert into settings (key, value) values ('current_term', 'First Term 2025/2026')
  on conflict (key) do nothing;
