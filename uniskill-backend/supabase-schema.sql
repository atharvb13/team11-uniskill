create extension if not exists pgcrypto;

create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique,
  bio text,
  profile_picture_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  program text,
  degree_type text,
  date_of_joining date,
  contact_email text,
  linkedin_url text,
  github_url text,
  portfolio_url text,
  first_name text,
  last_name text,
  password_hash text
);

create table if not exists public.skills (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  created_at timestamptz not null default now()
);

create table if not exists public.user_skills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  skill_id uuid not null references public.skills (id) on delete cascade,
  proficiency_level text,
  can_teach boolean not null default false,
  wants_to_learn boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, skill_id)
);

-- If an older DB has a check that blocks beginner + can_teach, remove it so the API can save beginner:
--   alter table public.user_skills drop constraint if exists no_beginner_teaching;

-- If `public.users` already exists, add the column in Supabase SQL Editor:
-- alter table public.users add column if not exists password_hash text;

create table if not exists public.meetings (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references public.users (id) on delete cascade,
  participant_id uuid not null references public.users (id) on delete cascade,
  title text not null default 'Meeting',
  notes text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'cancelled')),
  created_at timestamptz not null default now(),
  constraint meetings_different_users check (organizer_id <> participant_id),
  constraint meetings_time_order check (ends_at > starts_at)
);

create index if not exists meetings_organizer_starts_idx on public.meetings (organizer_id, starts_at);
create index if not exists meetings_participant_starts_idx on public.meetings (participant_id, starts_at);

create table if not exists public.teacher_reviews (
  id uuid primary key default gen_random_uuid(),
  reviewer_id uuid not null references public.users (id) on delete cascade,
  teacher_id uuid not null references public.users (id) on delete cascade,
  rating smallint not null check (rating >= 1 and rating <= 5),
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint teacher_reviews_distinct_persons check (reviewer_id <> teacher_id),
  constraint teacher_reviews_body_short_enough check (char_length(body) <= 4000),
  constraint teacher_reviews_body_meaningful check (char_length(trim(body)) >= 3),
  unique (reviewer_id, teacher_id)
);

create index if not exists teacher_reviews_teacher_created_idx on public.teacher_reviews (teacher_id, created_at desc);
create index if not exists teacher_reviews_reviewer_idx on public.teacher_reviews (reviewer_id);

alter table public.teacher_reviews enable row level security;
