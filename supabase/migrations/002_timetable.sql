-- Run this in Supabase SQL Editor if your project was already set up from the
-- original schema.sql (which didn't include this table yet).

create table if not exists timetable (
  id uuid primary key default gen_random_uuid(),
  class_id uuid references classes(id) on delete cascade,
  day_of_week text not null check (day_of_week in ('Monday','Tuesday','Wednesday','Thursday','Friday')),
  period_label text not null,   -- e.g. "8:00 - 8:40"
  subject text not null,
  teacher_name text
);
alter table timetable enable row level security;
