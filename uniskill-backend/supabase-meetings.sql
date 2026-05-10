-- Run once in Supabase SQL Editor: meetings between accepted connections only (enforced in API).

create table if not exists public.meetings (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references public.users (id) on delete cascade,
  participant_id uuid not null references public.users (id) on delete cascade,
  title text not null default 'Meeting',
  notes text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'cancelled')),
  created_at timestamptz not null default now(),
  constraint meetings_different_users check (organizer_id <> participant_id),
  constraint meetings_time_order check (ends_at > starts_at)
);

create index if not exists meetings_organizer_starts_idx on public.meetings (organizer_id, starts_at);
create index if not exists meetings_participant_starts_idx on public.meetings (participant_id, starts_at);
