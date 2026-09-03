-- Church Services YouTube / live-stream management.
-- Authenticated members can watch; only Admin/Pastor can manage service media.

drop policy if exists "cms_services_admin" on public.cms_services;
drop policy if exists "cms_services_manage" on public.cms_services;

create policy "cms_services_manage"
on public.cms_services for all
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.user_id=(select auth.uid())
      and p.role::text in ('admin','pastor')
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.user_id=(select auth.uid())
      and p.role::text in ('admin','pastor')
  )
);

alter table public.cms_services
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists broadcast_status text not null default 'replay';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.cms_services'::regclass
      and conname='cms_services_broadcast_status_check'
  ) then
    alter table public.cms_services
      add constraint cms_services_broadcast_status_check
      check (broadcast_status in ('upcoming','live','replay'));
  end if;
end $$;

update public.cms_services
set broadcast_status = case
  when is_live then 'live'
  when service_date > current_date then 'upcoming'
  else 'replay'
end
where broadcast_status='replay';
