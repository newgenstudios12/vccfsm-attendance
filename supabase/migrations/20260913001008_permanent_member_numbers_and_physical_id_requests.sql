-- Keep the internal UUID and legacy QR code unchanged. Member numbers are permanent.
lock table public.members in share row exclusive mode;
alter table public.members add column if not exists member_number text;

-- Add the two requested pastors only when their member record is missing.
-- Resolve all links from names; never hardcode generated UUIDs.
do $$
declare
  pastor record;
  linked_id uuid;
  matches integer;
begin
  for pastor in
    select * from (values
      ('Nilo Torio', 'Nilo', 'Torio', array['nilo torio','leonilo torio','leonilo h. torio','ptr. leonilo h. torio'], 'Ptr. Leonilo H. Torio'),
      ('Mary Ann Torio', 'Mary Ann', 'Torio', array['mary ann torio','mary ann o. torio','ptra. mary ann o. torio'], 'Ptra. Mary Ann O. Torio')
    ) as p(name, first_name, last_name, aliases, leadership_name)
  loop
    select count(*), (array_agg(m.id))[1] into matches, linked_id
    from public.members m
    where lower(btrim(coalesce(m.display_name, concat_ws(' ', m.first_name, m.last_name)))) = any(pastor.aliases)
       or lower(btrim(concat_ws(' ', m.first_name, m.last_name))) = any(pastor.aliases);
    if matches > 1 then
      raise exception 'More than one member record matches pastor %; resolve the existing records first', pastor.name;
    end if;
    if matches = 0 then
      insert into public.members(first_name, last_name, member_type, photo_url)
      values(pastor.first_name, pastor.last_name, 'Pastor',
        (select p.profile_photo_url from public.profiles p
         where p.role::text = 'pastor' and lower(btrim(p.display_name)) = any(pastor.aliases)
         order by p.created_at limit 1))
      returning id into linked_id;
    end if;
    update public.profiles p set member_id = linked_id
      where p.member_id is null and p.role::text = 'pastor'
        and lower(btrim(p.display_name)) = any(pastor.aliases);
    update public.site_people s set member_id = linked_id
      where s.member_id is null and lower(s.kind) = 'pastor'
        and lower(btrim(s.name)) = lower(pastor.leadership_name);
  end loop;
end;
$$;

-- A transaction keeps the existing update guards intact during this one-time backfill.
alter table public.members disable trigger user;
with base as (
  select coalesce(max(substring(member_number from 6)::bigint), 0) as highest
  from public.members where member_number ~ '^VCCF-[0-9]{6}$'
), numbered as (
  select m.id, base.highest + row_number() over(order by
    case when lower(m.member_type) = 'pastor'
      or exists(select 1 from public.profiles p where p.member_id = m.id and p.role::text = 'pastor')
      then 0 else 1 end,
    coalesce((select min(s.sort_order) from public.site_people s where s.member_id = m.id and lower(s.kind) = 'pastor'), 2147483647),
    m.created_at, m.id) as serial
  from public.members m cross join base where m.member_number is null
)
update public.members m set member_number = 'VCCF-' || lpad(n.serial::text, 6, '0')
from numbered n where m.id = n.id;
alter table public.members enable trigger user;
alter table public.members alter column member_number set not null;
alter table public.members add constraint members_member_number_format check(member_number ~ '^VCCF-[0-9]{6}$');
alter table public.members add constraint members_member_number_key unique(member_number);

create schema if not exists vccf_private;
create sequence vccf_private.member_number_sequence as bigint minvalue 1 maxvalue 999999 no cycle;
select setval('vccf_private.member_number_sequence', (select max(substring(member_number from 6)::bigint) from public.members), true);
grant usage on schema vccf_private to authenticated, service_role;
grant usage on sequence vccf_private.member_number_sequence to authenticated, service_role;

create function vccf_private.assign_permanent_member_number()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    -- The server assigns the number even when a client submits its own value.
    new.member_number := 'VCCF-' || lpad(nextval('vccf_private.member_number_sequence')::text, 6, '0');
  elsif new.member_number is distinct from old.member_number then
    raise exception 'Member numbers are permanent and cannot be changed' using errcode = '22023';
  end if;
  return new;
end;
$$;
revoke all on function vccf_private.assign_permanent_member_number() from public, anon, authenticated;
create trigger members_permanent_number before insert or update on public.members
  for each row execute function vccf_private.assign_permanent_member_number();

create table public.member_id_requests (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check(status in ('pending','printing','ready','collected','declined','cancelled')),
  request_notes text not null default '' check(char_length(request_notes) <= 1000),
  admin_notes text not null default '' check(char_length(admin_notes) <= 1000),
  handled_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index member_id_requests_one_open_per_member on public.member_id_requests(member_id)
  where status in ('pending','printing','ready');
create index member_id_requests_requested_by_idx on public.member_id_requests(requested_by, created_at desc);
create index member_id_requests_handled_by_idx on public.member_id_requests(handled_by) where handled_by is not null;

alter table public.member_id_requests enable row level security;
revoke all on public.member_id_requests from anon;
grant select, insert, update on public.member_id_requests to authenticated;
grant all on public.member_id_requests to service_role;

create policy member_id_requests_read on public.member_id_requests for select to authenticated
using ((requested_by = (select auth.uid()) and member_id = (select public.current_member_id()))
  or (select public.current_role()::text) in ('admin','pastor'));
create policy member_id_requests_create_own on public.member_id_requests for insert to authenticated
with check (requested_by = (select auth.uid()) and member_id = (select public.current_member_id())
  and status = 'pending' and handled_by is null and admin_notes = '');
create policy member_id_requests_manage on public.member_id_requests for update to authenticated
using ((select public.current_role()::text) in ('admin','pastor'))
with check ((select public.current_role()::text) in ('admin','pastor'));
create policy member_id_requests_cancel_own on public.member_id_requests for update to authenticated
using (requested_by = (select auth.uid()) and member_id = (select public.current_member_id()) and status = 'pending')
with check (requested_by = (select auth.uid()) and member_id = (select public.current_member_id()) and status = 'cancelled');

create function vccf_private.guard_member_id_request()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  caller uuid := auth.uid();
  manager boolean := coalesce(public.current_role()::text in ('admin','pastor'), false);
begin
  if caller is null then raise exception 'Sign in to request or manage a member ID' using errcode = '42501'; end if;
  if tg_op = 'INSERT' then
    if new.member_id is distinct from public.current_member_id() or new.requested_by is distinct from caller
      or new.status <> 'pending' or new.handled_by is not null or new.admin_notes <> '' then
      raise exception 'You can request an ID only for your linked member profile' using errcode = '42501';
    end if;
    new.created_at := now();
    new.request_notes := btrim(new.request_notes);
  else
    if row(new.id, new.member_id, new.requested_by, new.created_at, new.request_notes)
      is distinct from row(old.id, old.member_id, old.requested_by, old.created_at, old.request_notes) then
      raise exception 'The original ID request details cannot be changed' using errcode = '22023';
    end if;
    if manager then
      if new.status is distinct from old.status and not (
        (old.status = 'pending' and new.status in ('printing','declined','cancelled')) or
        (old.status = 'printing' and new.status in ('ready','cancelled')) or
        (old.status = 'ready' and new.status in ('collected','cancelled'))
      ) then raise exception 'This ID request status change is not allowed' using errcode = '22023'; end if;
      new.handled_by := caller;
    else
      if old.requested_by is distinct from caller or old.member_id is distinct from public.current_member_id()
        or old.status <> 'pending' or new.status <> 'cancelled'
        or new.admin_notes is distinct from old.admin_notes or new.handled_by is distinct from old.handled_by then
        raise exception 'You can only cancel your own pending ID request' using errcode = '42501';
      end if;
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function vccf_private.guard_member_id_request() from public, anon, authenticated;
create trigger member_id_requests_guard before insert or update on public.member_id_requests
  for each row execute function vccf_private.guard_member_id_request();

comment on column public.members.member_number is 'Permanent public member number. Internal UUID and legacy member_code remain unchanged.';
comment on table public.member_id_requests is 'Physical ID fulfillment requests. Card details are always read from the current member record.';
