-- Teaching reviews: 1–5 stars + text, one review per reviewer per teacher.
-- Run in Supabase SQL Editor if the table is not already applied from supabase-schema.sql.

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

-- RLS: block direct browser/anon access via PostgREST. UniSkill reads/writes this table only
-- through the FastAPI backend (Supabase service role), which bypasses RLS.
alter table public.teacher_reviews enable row level security;
