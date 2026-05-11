-- Legacy migration (optional). The API no longer reads this column; "verified session" is derived from `meetings`.
-- Safe to run on older DBs; harmless no-op if you skip it.

alter table public.teacher_reviews
  add column if not exists session_verified boolean not null default false;

comment on column public.teacher_reviews.session_verified is
  'Deprecated: verification is computed from completed meetings in the application.';
