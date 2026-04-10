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

-- If `public.users` already exists, add the column in Supabase SQL Editor:
-- alter table public.users add column if not exists password_hash text;
