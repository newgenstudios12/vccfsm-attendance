-- VCCF Connect Member Engagement Phase 1
-- Adds a privacy-safe shared prayer wall without exposing private prayer request identities.

alter table public.prayer_requests
  add column if not exists answered_note text;

revoke all on table public.prayer_requests from anon;

drop policy if exists "prayers own or leaders" on public.prayer_requests;
create policy "prayers own or leaders"
on public.prayer_requests
for select
to authenticated
using (
  member_id = (select p.member_id from public.profiles p where p.user_id = auth.uid())
  or exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid() and p.role in ('admin','pastor')
  )
  or exists (
    select 1
    from public.profiles p
    join public.members m on m.id = prayer_requests.member_id
    where p.user_id = auth.uid()
      and p.role = 'area_leader'
      and p.area_id = m.area_id
  )
);

drop policy if exists "prayers leaders update" on public.prayer_requests;
create policy "prayers leaders update"
on public.prayer_requests
for update
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid() and p.role in ('admin','pastor')
  )
  or exists (
    select 1
    from public.profiles p
    join public.members m on m.id = prayer_requests.member_id
    where p.user_id = auth.uid()
      and p.role = 'area_leader'
      and p.area_id = m.area_id
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid() and p.role in ('admin','pastor')
  )
  or exists (
    select 1
    from public.profiles p
    join public.members m on m.id = prayer_requests.member_id
    where p.user_id = auth.uid()
      and p.role = 'area_leader'
      and p.area_id = m.area_id
  )
);

drop policy if exists "prayers own update" on public.prayer_requests;
create policy "prayers own update"
on public.prayer_requests
for update
to authenticated
using (
  member_id = (select p.member_id from public.profiles p where p.user_id = auth.uid())
)
with check (
  member_id = (select p.member_id from public.profiles p where p.user_id = auth.uid())
);

create table if not exists public.prayer_wall_posts (
  id uuid primary key default gen_random_uuid(),
  prayer_request_id uuid not null unique references public.prayer_requests(id) on delete cascade,
  area_id uuid references public.areas(id) on delete set null,
  requester_label text not null default 'VCCF Member',
  request_text text not null,
  category text,
  status text not null default 'Praying',
  answered_at timestamptz,
  answered_note text,
  prayer_count integer not null default 0 check (prayer_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists prayer_wall_posts_created_at_idx
  on public.prayer_wall_posts(created_at desc);
create index if not exists prayer_wall_posts_status_idx
  on public.prayer_wall_posts(status);

alter table public.prayer_wall_posts enable row level security;
revoke all on table public.prayer_wall_posts from anon, authenticated;
grant select on table public.prayer_wall_posts to authenticated;

drop policy if exists "prayer wall authenticated read" on public.prayer_wall_posts;
create policy "prayer wall authenticated read"
on public.prayer_wall_posts
for select
to authenticated
using (true);

create table if not exists public.prayer_wall_supports (
  post_id uuid not null references public.prayer_wall_posts(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

alter table public.prayer_wall_supports enable row level security;
revoke all on table public.prayer_wall_supports from anon, authenticated;
grant select, insert, delete on table public.prayer_wall_supports to authenticated;

drop policy if exists "prayer support own read" on public.prayer_wall_supports;
create policy "prayer support own read"
on public.prayer_wall_supports
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "prayer support own insert" on public.prayer_wall_supports;
create policy "prayer support own insert"
on public.prayer_wall_supports
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (select 1 from public.prayer_wall_posts p where p.id = post_id)
);

drop policy if exists "prayer support own delete" on public.prayer_wall_supports;
create policy "prayer support own delete"
on public.prayer_wall_supports
for delete
to authenticated
using (user_id = auth.uid());

create schema if not exists vccf_private;
revoke all on schema vccf_private from public, anon, authenticated;

create or replace function vccf_private.sync_prayer_wall_post()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
  v_area uuid;
begin
  if tg_op = 'DELETE' then
    return old;
  end if;

  if new.visibility <> 'Church' or new.status = 'Closed' then
    delete from public.prayer_wall_posts where prayer_request_id = new.id;
    return new;
  end if;

  select
    coalesce(
      nullif(trim(m.display_name), ''),
      nullif(trim(concat_ws(' ', m.first_name, m.last_name)), ''),
      'VCCF Member'
    ),
    m.area_id
  into v_name, v_area
  from public.members m
  where m.id = new.member_id;

  insert into public.prayer_wall_posts (
    prayer_request_id,
    area_id,
    requester_label,
    request_text,
    category,
    status,
    answered_at,
    answered_note,
    created_at,
    updated_at
  ) values (
    new.id,
    v_area,
    case when new.is_anonymous then 'Anonymous' else coalesce(v_name, 'VCCF Member') end,
    new.request_text,
    new.category,
    new.status,
    new.answered_at,
    new.answered_note,
    new.created_at,
    now()
  )
  on conflict (prayer_request_id) do update set
    area_id = excluded.area_id,
    requester_label = excluded.requester_label,
    request_text = excluded.request_text,
    category = excluded.category,
    status = excluded.status,
    answered_at = excluded.answered_at,
    answered_note = excluded.answered_note,
    updated_at = now();

  return new;
end;
$$;

revoke all on function vccf_private.sync_prayer_wall_post() from public, anon, authenticated;

drop trigger if exists sync_prayer_wall_post on public.prayer_requests;
create trigger sync_prayer_wall_post
after insert or update of visibility, request_text, category, status, answered_at, answered_note, is_anonymous, member_id
on public.prayer_requests
for each row
execute function vccf_private.sync_prayer_wall_post();

create or replace function vccf_private.refresh_prayer_wall_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_post_id uuid;
begin
  v_post_id := coalesce(new.post_id, old.post_id);
  update public.prayer_wall_posts p
  set prayer_count = (
      select count(*)::integer
      from public.prayer_wall_supports s
      where s.post_id = v_post_id
    ),
    updated_at = now()
  where p.id = v_post_id;
  return coalesce(new, old);
end;
$$;

revoke all on function vccf_private.refresh_prayer_wall_count() from public, anon, authenticated;

drop trigger if exists refresh_prayer_wall_count on public.prayer_wall_supports;
create trigger refresh_prayer_wall_count
after insert or delete
on public.prayer_wall_supports
for each row
execute function vccf_private.refresh_prayer_wall_count();

insert into public.prayer_wall_posts (
  prayer_request_id,
  area_id,
  requester_label,
  request_text,
  category,
  status,
  answered_at,
  answered_note,
  created_at,
  updated_at
)
select
  r.id,
  m.area_id,
  case
    when r.is_anonymous then 'Anonymous'
    else coalesce(nullif(trim(m.display_name), ''), nullif(trim(concat_ws(' ', m.first_name, m.last_name)), ''), 'VCCF Member')
  end,
  r.request_text,
  r.category,
  r.status,
  r.answered_at,
  r.answered_note,
  r.created_at,
  now()
from public.prayer_requests r
join public.members m on m.id = r.member_id
where r.visibility = 'Church' and r.status <> 'Closed'
on conflict (prayer_request_id) do nothing;
