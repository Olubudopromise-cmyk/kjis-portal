-- Simple fixed-window rate limiter storage for the login and
-- forgot-password endpoints. Server routes upsert rows keyed like
-- 'login:student:aname' or 'forgot:you@school.com'. RLS is enabled with
-- no policies: only the service-role key touches this table, same as the
-- other internal tables.
create table if not exists rate_limits (
  key           text primary key,
  attempt_count int default 1,
  window_start  timestamptz default now()
);

alter table rate_limits enable row level security;
