-- Adds optional expiry to notices. Expired notices are hidden automatically
-- by the announcements GET route (filter at read time, no background job).

alter table announcements
  add column if not exists expires_at timestamptz;
