-- Plain-Postgres test of the sync schema. Emulates Supabase's auth schema, then checks
-- RLS isolation and the newer-wins upsert. Run: scripts/test-sql.sh
\set ON_ERROR_STOP 1
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key);
create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
grant usage on schema public, auth to authenticated;
insert into auth.users values ('00000000-0000-0000-0000-00000000000a'), ('00000000-0000-0000-0000-00000000000b') on conflict do nothing;

\i supabase/migrations/0001_records.sql
grant select, insert, update, delete on public.records, public.push_subs to authenticated;
grant usage on sequence public.records_seq to authenticated;

set role authenticated;
set test.uid = '00000000-0000-0000-0000-00000000000a';
select public.push_records('[{"kind":"days","id":"2026-11-12","data":{"painAM":3},"updated_at":2000}]');
-- stale write from another device: must be ignored
select public.push_records('[{"kind":"days","id":"2026-11-12","data":{"painAM":9},"updated_at":1000}]') as stale_written;
do $$ begin
  if (select (data->>'painAM')::int from public.records where id = '2026-11-12') <> 3 then raise exception 'stale write overwrote newer row'; end if;
end $$;
-- newer write wins and bumps seq
select seq as seq_before from public.records where id = '2026-11-12' \gset
select public.push_records('[{"kind":"days","id":"2026-11-12","data":{"painAM":5},"updated_at":3000,"deleted":false}]');
do $$ begin
  if (select (data->>'painAM')::int from public.records where id = '2026-11-12') <> 5 then raise exception 'newer write not applied'; end if;
end $$;
select (seq > :seq_before) as seq_bumped from public.records where id = '2026-11-12';

-- user B sees nothing of A, and cannot overwrite A's row
set test.uid = '00000000-0000-0000-0000-00000000000b';
do $$ begin
  if (select count(*) from public.records) <> 0 then raise exception 'RLS leak: B can read A rows'; end if;
end $$;
select public.push_records('[{"kind":"days","id":"2026-11-12","data":{"painAM":0},"updated_at":9999}]');
do $$ begin
  if (select count(*) from public.records) <> 1 then raise exception 'B should have its own row'; end if;
end $$;
set test.uid = '00000000-0000-0000-0000-00000000000a';
do $$ begin
  if (select (data->>'painAM')::int from public.records where id = '2026-11-12') <> 5 then raise exception 'B overwrote A'; end if;
  if (select count(*) from public.records) <> 1 then raise exception 'A can see B rows'; end if;
end $$;
-- forging another user's id is blocked by the RLS check
do $$ begin
  begin
    insert into public.records (user_id, kind, id, data, updated_at) values ('00000000-0000-0000-0000-00000000000b', 'days', 'x', '{}', 1);
    raise exception 'forged insert allowed';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
select 'ALL SQL TESTS PASSED' as result;
