-- A student's password is their Admission No., so two students must never
-- share one. The app already rejects a case-insensitive clash at registration
-- and edit time; this makes the database enforce it too.
--
-- NOTE: run this AFTER checking for existing duplicates, or the index
-- creation will fail. Safe to run when there are none:
--
--   select lower(admission_no) as no, count(*)
--   from users
--   where role = 'student' and admission_no is not null
--   group by lower(admission_no)
--   having count(*) > 1;
--
-- Case-insensitive to match the application check (ilike) and the partial
-- index idiom already used for username / full_name in schema.sql.

create unique index if not exists users_student_admission_no_unique
  on users (lower(admission_no))
  where role = 'student' and admission_no is not null;
