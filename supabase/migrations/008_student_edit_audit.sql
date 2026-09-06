-- Audit trail for admin edits to student records. One row per PATCH that
-- changes at least one field, written by /api/students (service-role key,
-- so RLS with no policies is fine — the browser never queries this).
create table if not exists student_edits (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid not null references users(id) on delete cascade,
  editor_id    uuid not null references users(id),
  editor_role  text not null,
  editor_name  text,
  changes      jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

create index student_edits_student_idx on student_edits (student_id, created_at desc);

alter table student_edits enable row level security;
