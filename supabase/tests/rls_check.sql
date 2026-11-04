-- RLS check for public.boards. Run after 001_init.sql: SQL Editor > New query > paste > Run.
--
-- Creates two throwaway users, acts as each one, and checks that neither can read, change,
-- or delete the other's boards, and that guests (anon) can't touch the table at all.
-- Everything is rolled back at the end, so nothing is left behind.
-- Passing prints "RLS check passed". Any failure stops with an error starting "FAIL:".

begin;

insert into auth.users (id, email)
values
  ('00000000-0000-4000-8000-00000000000a', 'rls-check-a@example.test'),
  ('00000000-0000-4000-8000-00000000000b', 'rls-check-b@example.test');

-- User A creates a board.
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-00000000000a", "role": "authenticated"}';

insert into public.boards (id, title, data, rev)
values ('rls-board-a', 'A''s board', '{"columns": {}, "cards": {}}', 99);

do $$
declare
  saved public.boards;
  n integer;
begin
  select * into saved from public.boards where id = 'rls-board-a';
  if saved.user_id <> '00000000-0000-4000-8000-00000000000a' then
    raise exception 'FAIL: user_id should default to the signed-in user';
  end if;
  if saved.rev <> 1 then
    raise exception 'FAIL: a new board should start at rev 1, got %', saved.rev;
  end if;

  update public.boards set title = 'A''s board v2' where id = 'rls-board-a' and rev = 1;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL: A should update their own board'; end if;
  if (select rev from public.boards where id = 'rls-board-a') <> 2 then
    raise exception 'FAIL: rev should go up on every update';
  end if;

  -- A second device still holding rev 1 must not overwrite the newer save.
  update public.boards set title = 'stale write' where id = 'rls-board-a' and rev = 1;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: a stale rev should update nothing'; end if;
end;
$$;

-- User B tries to reach A's board.
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-00000000000b", "role": "authenticated"}';

do $$
declare
  n integer;
begin
  if exists (select 1 from public.boards) then
    raise exception 'FAIL: B can see boards that are not theirs';
  end if;

  update public.boards set title = 'hacked' where id = 'rls-board-a';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: B updated A''s board'; end if;

  delete from public.boards where id = 'rls-board-a';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: B deleted A''s board'; end if;

  begin
    insert into public.boards (user_id, id, title, data)
    values ('00000000-0000-4000-8000-00000000000a', 'planted', 'planted', '{}');
    raise exception 'FAIL: B created a board in A''s account';
  exception when insufficient_privilege then
    null; -- expected: blocked by RLS
  end;

  -- Same board id as A is fine: ids are only unique per user.
  insert into public.boards (id, title, data) values ('rls-board-a', 'B''s board', '{}');
  if (select count(*) from public.boards) <> 1 then
    raise exception 'FAIL: B should see exactly their own board';
  end if;
end;
$$;

-- Back to A: their board is untouched and B's is invisible.
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-00000000000a", "role": "authenticated"}';

do $$
begin
  if (select count(*) from public.boards) <> 1 then
    raise exception 'FAIL: A should see exactly their own board';
  end if;
  if (select title from public.boards where id = 'rls-board-a') <> 'A''s board v2' then
    raise exception 'FAIL: A''s board was changed by someone else';
  end if;
end;
$$;

-- A guest (not signed in) can't read or write the table at all.
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

do $$
begin
  begin
    perform 1 from public.boards;
    raise exception 'FAIL: anon can read boards';
  exception when insufficient_privilege then
    null;
  end;
  begin
    insert into public.boards (user_id, id, title, data)
    values ('00000000-0000-4000-8000-00000000000a', 'guest', 'guest', '{}');
    raise exception 'FAIL: anon can add boards';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;

select 'RLS check passed' as result;

rollback;
