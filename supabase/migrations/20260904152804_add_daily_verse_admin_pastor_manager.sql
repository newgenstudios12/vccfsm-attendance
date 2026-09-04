create table if not exists public.daily_bible_verse_selections (
  verse_date date primary key,
  reference text not null check (length(btrim(reference)) > 0),
  verse_text text not null check (length(btrim(verse_text)) > 0),
  translation text not null check (translation = any (array['NIV'::text,'ESV'::text,'RTPV05'::text,'KJV'::text])),
  push_enabled boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.daily_bible_verse_selections enable row level security;
revoke all on table public.daily_bible_verse_selections from anon;
revoke all on table public.daily_bible_verse_selections from authenticated;
grant select, insert, update, delete on table public.daily_bible_verse_selections to authenticated;

drop policy if exists daily_bible_verse_selections_read on public.daily_bible_verse_selections;
create policy daily_bible_verse_selections_read
on public.daily_bible_verse_selections
for select to authenticated
using (true);

drop policy if exists daily_bible_verse_selections_admin_pastor_insert on public.daily_bible_verse_selections;
create policy daily_bible_verse_selections_admin_pastor_insert
on public.daily_bible_verse_selections
for insert to authenticated
with check (
  exists (
    select 1 from public.profiles p
    where p.user_id = (select auth.uid())
      and p.role::text in ('admin','pastor')
  )
  and (created_by is null or created_by = (select auth.uid()))
  and (updated_by is null or updated_by = (select auth.uid()))
);

drop policy if exists daily_bible_verse_selections_admin_pastor_update on public.daily_bible_verse_selections;
create policy daily_bible_verse_selections_admin_pastor_update
on public.daily_bible_verse_selections
for update to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.user_id = (select auth.uid())
      and p.role::text in ('admin','pastor')
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.user_id = (select auth.uid())
      and p.role::text in ('admin','pastor')
  )
  and (updated_by is null or updated_by = (select auth.uid()))
);

drop policy if exists daily_bible_verse_selections_admin_pastor_delete on public.daily_bible_verse_selections;
create policy daily_bible_verse_selections_admin_pastor_delete
on public.daily_bible_verse_selections
for delete to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.user_id = (select auth.uid())
      and p.role::text in ('admin','pastor')
  )
);

create or replace function public.vccf_daily_bible_verse(p_date date default null)
returns table(verse_date date, reference text, verse_text text, translation text)
language sql
stable
security invoker
set search_path = public
as $$
  with d as (
    select coalesce(p_date,(now() at time zone 'Asia/Manila')::date) as verse_date
  ), chosen as (
    select s.verse_date,s.reference,s.verse_text,s.translation
    from public.daily_bible_verse_selections s
    join d on d.verse_date=s.verse_date
    limit 1
  ), ranked as (
    select b.reference,b.verse_text,b.translation,
           row_number() over(order by b.sort_order,b.id) as rn,
           count(*) over() as total
    from public.bible_verses b
    where b.is_active=true
  ), fallback as (
    select d.verse_date,r.reference,r.verse_text,r.translation
    from d
    join ranked r on r.rn=1+mod(abs((d.verse_date-date '2026-01-01')::int),r.total::int)
    limit 1
  )
  select c.verse_date,c.reference,c.verse_text,c.translation from chosen c
  union all
  select f.verse_date,f.reference,f.verse_text,f.translation from fallback f
  where not exists (select 1 from chosen)
  limit 1;
$$;
revoke all on function public.vccf_daily_bible_verse(date) from public, anon;
grant execute on function public.vccf_daily_bible_verse(date) to authenticated;

create or replace function public.vccf_prepare_daily_bible_verse()
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_date date := (now() at time zone 'Asia/Manila')::date;
  v record;
  v_push_id uuid;
  v_push_enabled boolean := true;
begin
  select * into v from public.vccf_daily_bible_verse(v_date) limit 1;
  if v.reference is null then return null; end if;

  select coalesce(s.push_enabled,true) into v_push_enabled
  from public.daily_bible_verse_selections s
  where s.verse_date=v_date;
  v_push_enabled := coalesce(v_push_enabled,true);

  insert into public.daily_bible_verse_push_log(verse_date,verse_reference)
  values(v_date,v.reference)
  on conflict(verse_date) do nothing;

  if not found then
    select push_notification_id into v_push_id
    from public.daily_bible_verse_push_log where verse_date=v_date;
    if v_push_id is not null then return v_push_id; end if;
  end if;

  if not v_push_enabled then return null; end if;

  insert into public.push_notifications(
    title,body,audience,is_published,push_enabled,recurrence,daily_time,publish_at,expires_at,push_url
  ) values (
    'Today''s Word · '||v.reference,
    v.verse_text||' — '||v.reference||' ('||v.translation||')',
    'All',true,true,'once',null,now(),((v_date + 1)::timestamp at time zone 'Asia/Manila'),
    '/?daily-verse='||v_date::text
  ) returning id into v_push_id;

  update public.daily_bible_verse_push_log
  set push_notification_id=v_push_id, verse_reference=v.reference
  where verse_date=v_date;

  return v_push_id;
end;
$$;
revoke all on function public.vccf_prepare_daily_bible_verse() from public, anon, authenticated;
