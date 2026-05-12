-- Run once in Supabase → SQL Editor if saves fail with:
--   new row for relation "user_skills" violates check constraint "no_beginner_teaching"
--
-- The API allows teaching at "beginner"; this removes the old DB rule that did not.

alter table public.user_skills drop constraint if exists no_beginner_teaching;
