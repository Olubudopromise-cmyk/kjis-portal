-- Adds a soft-activation flag to users. `active` is nullable on purpose:
-- existing rows keep null (treated as active), only explicitly deactivated
-- accounts get false. The login route blocks on `active = false` only, so
-- running this migration never locks anybody out.
alter table users add column if not exists active boolean default true;

alter table users enable row level security;
