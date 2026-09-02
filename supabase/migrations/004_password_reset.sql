-- Adds email column to users (nullable for existing rows, required going
-- forward for teacher/admin accounts) and a password_resets table used by
-- the self-service "Forgot password?" flow.

alter table users add column if not exists email text;

-- No unique constraint on email — multiple staff *could* share an address in
-- edge cases, and the forgot-password flow already handles lookups safely.

create table if not exists password_resets (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  token      text not null unique,
  expires_at timestamptz not null,
  used       boolean not null default false,
  created_at timestamptz not null default now()
);

alter table password_resets enable row level security;
