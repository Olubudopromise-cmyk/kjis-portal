-- King James International School Portal — database schema
-- Run this once in your Supabase project's SQL Editor (Dashboard → SQL Editor → New query).

create extension if not exists "pgcrypto";

create table classes (
  id uuid primary key default gen_random_uuid(),
  name text not null
);

create table users (
  id uuid primary key default gen_random_uuid(),
  role text not null check (role in ('student','teacher','admin')),
  full_name text,              -- students log in with this (their registered name)
  username text,               -- teachers/admin log in with this
  password_hash text not null, -- bcrypt hash, never plain text
  class_id uuid references classes(id),
  category text check (category in ('Science','Art','Commercial')),
  total_fee numeric default 0,
  paid numeric default 0,
  admission_no text,
  face_photo_url text,         -- storage URL of reference photo, if you keep face verification
  created_at timestamptz default now()
);
create unique index users_username_unique on users (lower(username)) where username is not null;
create unique index users_fullname_unique on users (lower(full_name)) where role = 'student';

create table subjects (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('Science','Art','Commercial')),
  name text not null
);

create table results (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references users(id) on delete cascade,
  subject text not null,
  ca numeric,
  exam numeric,
  unique(student_id, subject)
);

create table attendance (
  id uuid primary key default gen_random_uuid(),
  class_id uuid references classes(id),
  student_id uuid references users(id) on delete cascade,
  date date not null,
  status text check (status in ('present','absent')),
  unique(class_id, student_id, date)
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references users(id) on delete cascade,
  amount numeric not null,
  reference text unique,
  status text default 'pending' check (status in ('pending','success','failed')),
  created_at timestamptz default now()
);

create table announcements (
  id uuid primary key default gen_random_uuid(),
  text text not null,
  author text,
  created_at timestamptz default now()
);

-- Lock every table down by default. The browser never talks to Supabase directly —
-- only your Next.js API routes do, using the service-role key, which bypasses RLS.
-- "No policies" here is intentional, not an oversight.
alter table classes enable row level security;
alter table users enable row level security;
alter table subjects enable row level security;
alter table results enable row level security;
alter table attendance enable row level security;
alter table payments enable row level security;
alter table announcements enable row level security;

-- A few starter classes to get going — edit/add as needed.
insert into classes (name) values ('JSS 1'), ('JSS 2'), ('SS 1');

-- Your admin account is NOT created here (passwords must be hashed, not written
-- into SQL by hand). After .env.local is set up, run:
--   npm run create-admin -- admin "a-strong-password" "Head Administrator"
