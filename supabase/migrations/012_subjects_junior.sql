-- Junior (JSS) students do not stream, so they need a subject list that is not
-- one of the senior Science/Art/Commercial categories. Add 'Junior' as a
-- category value on the subjects table.
--
-- This does NOT touch users.category: that column stays a senior-only stream
-- (Science/Art/Commercial). Junior-ness is derived from the student's class
-- (JSS 1/2/3) in lib/subjects.js, not stored on the user.
--
-- Safe to run with existing rows: the new constraint is a superset of the old
-- one, so no existing Science/Art/Commercial row is affected.
--
-- Verify afterwards:
--   select category, count(*) from subjects group by category order by 1;
--   -- expect Science 4, Art 4, Commercial 4, and Junior 0 until subjects are added

alter table subjects drop constraint if exists subjects_category_check;

alter table subjects
  add constraint subjects_category_check
  check (category in ('Science','Art','Commercial','Junior'));
