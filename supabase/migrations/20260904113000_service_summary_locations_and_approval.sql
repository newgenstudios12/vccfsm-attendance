-- Bible Study / Midweek service attendance location and summary workflow

alter table public.cms_service_summaries add column if not exists area_id uuid references public.areas(id) on delete set null;
alter table public.cms_service_summaries add column if not exists barangay text;
alter table public.cms_service_summaries add column if not exists workflow_status text not null default 'draft';
alter table public.cms_service_summaries add column if not exists submitted_at timestamptz;
alter table public.cms_service_summaries add column if not exists submitted_by uuid references auth.users(id) on delete set null;
alter table public.cms_service_summaries add column if not exists approved_at timestamptz;
alter table public.cms_service_summaries add column if not exists approved_by uuid references auth.users(id) on delete set null;
alter table public.cms_service_summaries add column if not exists updated_at timestamptz not null default now();

alter table public.cms_service_summaries drop constraint if exists cms_service_summaries_summary_type_check;
alter table public.cms_service_summaries add constraint cms_service_summaries_summary_type_check
  check (summary_type in ('Sunday Worship','Special Event','Bible Study','Midweek Service'));
alter table public.cms_service_summaries drop constraint if exists cms_service_summaries_workflow_status_check;
alter table public.cms_service_summaries add constraint cms_service_summaries_workflow_status_check
  check (workflow_status in ('draft','submitted','approved'));

alter table public.attendance add column if not exists service_area_id uuid references public.areas(id) on delete set null;
alter table public.attendance add column if not exists service_barangay text;

create index if not exists cms_service_summaries_area_id_idx on public.cms_service_summaries(area_id);
create index if not exists cms_service_summaries_type_date_idx on public.cms_service_summaries(summary_type, summary_date desc);
create index if not exists attendance_service_location_idx on public.attendance(attendance_type, service_area_id, checked_in_at desc);
create unique index if not exists cms_service_summary_location_unique
  on public.cms_service_summaries(summary_type, summary_date, area_id, lower(coalesce(barangay,'')))
  where summary_type in ('Bible Study','Midweek Service');

alter table public.cms_service_summaries enable row level security;

drop policy if exists "service summaries staff read" on public.cms_service_summaries;
drop policy if exists "service summaries staff insert" on public.cms_service_summaries;
drop policy if exists "service summaries admin update" on public.cms_service_summaries;
drop policy if exists "service summaries admin delete" on public.cms_service_summaries;
drop policy if exists "service summaries staff update" on public.cms_service_summaries;
drop policy if exists "service summaries staff delete" on public.cms_service_summaries;

create policy "service summaries staff read"
on public.cms_service_summaries for select to authenticated
using (
  exists (select 1 from public.profiles p where p.user_id=auth.uid() and p.role in ('admin'::app_role,'pastor'::app_role))
  or exists (
    select 1 from public.profiles p
    where p.user_id=auth.uid() and p.role='area_leader'::app_role
      and (cms_service_summaries.area_id is null or cms_service_summaries.area_id=p.area_id)
  )
);

create policy "service summaries staff insert"
on public.cms_service_summaries for insert to authenticated
with check (
  created_by=auth.uid() and workflow_status='draft' and (
    exists (select 1 from public.profiles p where p.user_id=auth.uid() and p.role in ('admin'::app_role,'pastor'::app_role))
    or exists (
      select 1 from public.profiles p
      where p.user_id=auth.uid() and p.role='area_leader'::app_role and cms_service_summaries.area_id=p.area_id
    )
  )
);

create policy "service summaries staff update"
on public.cms_service_summaries for update to authenticated
using (
  exists (select 1 from public.profiles p where p.user_id=auth.uid() and p.role in ('admin'::app_role,'pastor'::app_role))
  or exists (
    select 1 from public.profiles p
    where p.user_id=auth.uid() and p.role='area_leader'::app_role and cms_service_summaries.area_id=p.area_id
  )
)
with check (
  exists (select 1 from public.profiles p where p.user_id=auth.uid() and p.role in ('admin'::app_role,'pastor'::app_role))
  or exists (
    select 1 from public.profiles p
    where p.user_id=auth.uid() and p.role='area_leader'::app_role and cms_service_summaries.area_id=p.area_id
      and (cms_service_summaries.workflow_status <> 'approved' or cms_service_summaries.summary_type='Bible Study')
  )
);

create policy "service summaries staff delete"
on public.cms_service_summaries for delete to authenticated
using (
  exists (select 1 from public.profiles p where p.user_id=auth.uid() and p.role in ('admin'::app_role,'pastor'::app_role))
  or exists (
    select 1 from public.profiles p
    where p.user_id=auth.uid() and p.role='area_leader'::app_role
      and cms_service_summaries.area_id=p.area_id and cms_service_summaries.workflow_status <> 'approved'
  )
);
