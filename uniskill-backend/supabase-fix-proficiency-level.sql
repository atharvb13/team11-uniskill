-- Run this in Supabase SQL Editor if adding/updating `expert` proficiency fails.
-- It makes `public.user_skills.proficiency_level` accept:
--   beginner, intermediate, advanced, expert

-- 1) If proficiency_level is an enum column, add 'expert' to the enum type.
do $$
declare
  enum_type_name text;
begin
  select c.udt_name
    into enum_type_name
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'user_skills'
    and c.column_name = 'proficiency_level'
    and c.data_type = 'USER-DEFINED'
  limit 1;

  if enum_type_name is not null then
    execute format('alter type %I add value if not exists ''expert'';', enum_type_name);
  end if;
end
$$;

-- 2) If there is an old check constraint, replace it with one that includes expert.
alter table public.user_skills
  drop constraint if exists user_skills_proficiency_level_check;

alter table public.user_skills
  add constraint user_skills_proficiency_level_check
  check (
    proficiency_level is null
    or proficiency_level in ('beginner', 'intermediate', 'advanced', 'expert')
  );
