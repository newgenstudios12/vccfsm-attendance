alter table public.member_ministries
  add column if not exists is_primary boolean not null default false;

create unique index if not exists member_ministries_member_ministry_uidx
  on public.member_ministries(member_id, ministry_id);

create unique index if not exists member_ministries_one_primary_per_member_uidx
  on public.member_ministries(member_id)
  where is_primary = true;
