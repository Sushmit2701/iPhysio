-- Elbow Rehab sync schema. Run once in the Supabase SQL editor (or `supabase db push`).
-- One row per local record. RLS limits every row to its owner.

create sequence if not exists public.records_seq;

create table if not exists public.records (
  user_id    uuid    not null default auth.uid() references auth.users on delete cascade,
  kind       text    not null check (kind in ('days', 'assess', 'prtee', 'settings', 'appts')),
  id         text    not null,
  data       jsonb   not null,
  updated_at bigint  not null,           -- client edit time, epoch ms (the merge key)
  deleted    boolean not null default false,
  seq        bigint  not null default nextval('public.records_seq'), -- server change cursor for pulls
  primary key (user_id, kind, id)
);
create index if not exists records_user_seq on public.records (user_id, seq);

alter table public.records enable row level security;
drop policy if exists "own rows" on public.records;
create policy "own rows" on public.records
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Upsert that only replaces a row when the incoming edit is strictly newer.
-- This is what stops a late or stale device from overwriting a newer edit.
create or replace function public.push_records(rows jsonb)
returns integer
language sql
security invoker
as $$
  with incoming as (
    select r->>'kind' as kind, r->>'id' as id, r->'data' as data,
           (r->>'updated_at')::bigint as updated_at, coalesce((r->>'deleted')::boolean, false) as deleted
    from jsonb_array_elements(rows) r
  ), up as (
    insert into public.records as t (user_id, kind, id, data, updated_at, deleted)
    select auth.uid(), kind, id, data, updated_at, deleted from incoming
    on conflict (user_id, kind, id) do update
      set data = excluded.data, updated_at = excluded.updated_at, deleted = excluded.deleted,
          seq = nextval('public.records_seq')
      where t.updated_at < excluded.updated_at
    returning 1
  )
  select count(*)::int from up;
$$;
grant execute on function public.push_records(jsonb) to authenticated;

-- Web Push subscriptions (only used if you enable push reminders).
create table if not exists public.push_subs (
  endpoint   text primary key,
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  sub        jsonb not null,
  tz         text not null default 'UTC',
  enabled    boolean not null default true,
  last_rehab date,
  last_evening date,
  created_at timestamptz not null default now()
);
alter table public.push_subs enable row level security;
drop policy if exists "own subs" on public.push_subs;
create policy "own subs" on public.push_subs
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
