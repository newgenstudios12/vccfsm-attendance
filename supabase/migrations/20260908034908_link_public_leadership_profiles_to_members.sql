alter table public.site_people
  add column if not exists member_id uuid references public.members(id) on delete set null;

create index if not exists site_people_member_id_idx
  on public.site_people(member_id)
  where member_id is not null;

revoke select on table public.site_people from anon;
grant select (id, kind, name, description, sort_order, created_at) on table public.site_people to anon;
