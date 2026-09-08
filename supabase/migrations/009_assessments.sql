-- Individual teacher-recorded tests/exams. Kept separate from the official
-- CA / exam columns on results until real weighting rules are confirmed.

create table if not exists assessments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references users(id) on delete cascade not null,
  subject text not null,
  term text not null,
  label text not null,
  score numeric not null,
  max_score numeric not null default 100,
  created_at timestamptz default now()
);

alter table assessments enable row level security;
