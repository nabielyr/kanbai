-- KanbAI: boards for signed-in users.
--
-- Run once in the Supabase dashboard: SQL Editor > New query > paste this file > Run.
-- Then run supabase/tests/rls_check.sql to confirm one user can't reach another's boards.
--
-- One row per board. `data` holds that board's columns, cards and labels, so a save is
-- one upsert per board. Last write wins per board, guarded by `rev`: the server bumps it
-- on every update, and the app updates with `where rev = <the rev it loaded>`. Zero rows
-- updated means another device saved first, so the app refetches instead of overwriting.

begin;

create table public.boards (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- Client-generated (nanoid), so text rather than uuid. Unique per user, not globally.
  id text not null check (char_length(id) between 1 and 100),
  title text not null check (char_length(title) between 1 and 200),
  position integer not null default 0,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  rev integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  constraint boards_data_size check (octet_length(data::text) <= 2000000)
);

comment on table public.boards is
  'One KanbAI board per row; data = columns, cards and labels as JSON.';

-- The server owns rev and the timestamps; whatever the client sends for them is ignored.
create function public.boards_set_rev()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.rev := 1;
    new.created_at := now();
  else
    new.rev := old.rev + 1;
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger boards_set_rev
before insert or update on public.boards
for each row execute function public.boards_set_rev();

-- Row Level Security: every query only ever sees the caller's own rows.
alter table public.boards enable row level security;

create policy "Users can read their own boards"
on public.boards for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can add their own boards"
on public.boards for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their own boards"
on public.boards for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete their own boards"
on public.boards for delete to authenticated
using ((select auth.uid()) = user_id);

-- Supabase grants everything on new tables to anon and authenticated by default.
-- Guests never touch this table, and TRUNCATE skips RLS, so keep only what the app needs.
revoke all on table public.boards from anon, authenticated;
grant select, insert, update, delete on table public.boards to authenticated;

commit;
