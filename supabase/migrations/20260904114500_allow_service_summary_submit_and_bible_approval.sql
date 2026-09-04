-- Permit service summary submission on first save and allow Area Leaders
-- to approve Bible Study summaries for their own area.

drop policy if exists "service summaries staff insert" on public.cms_service_summaries;

create policy "service summaries staff insert"
on public.cms_service_summaries for insert to authenticated
with check (
  created_by=auth.uid() and (
    exists (
      select 1 from public.profiles p
      where p.user_id=auth.uid()
        and p.role in ('admin'::app_role,'pastor'::app_role)
    )
    or exists (
      select 1 from public.profiles p
      where p.user_id=auth.uid()
        and p.role='area_leader'::app_role
        and cms_service_summaries.area_id=p.area_id
        and (
          cms_service_summaries.workflow_status in ('draft','submitted')
          or (
            cms_service_summaries.workflow_status='approved'
            and cms_service_summaries.summary_type='Bible Study'
          )
        )
    )
  )
);
