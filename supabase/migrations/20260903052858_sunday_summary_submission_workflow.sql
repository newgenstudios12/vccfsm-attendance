alter table public.cms_sunday_event_summaries
  add column if not exists workflow_status text not null default 'draft',
  add column if not exists submitted_at timestamptz,
  add column if not exists submitted_by uuid references auth.users(id) on delete set null,
  add column if not exists posted_at timestamptz,
  add column if not exists posted_by uuid references auth.users(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now();

alter table public.cms_sunday_event_summaries
  drop constraint if exists cms_sunday_event_summaries_workflow_status_check;
alter table public.cms_sunday_event_summaries
  add constraint cms_sunday_event_summaries_workflow_status_check
  check (workflow_status in ('draft','submitted','posted'));

create unique index if not exists cms_sunday_summary_date_unique
  on public.cms_sunday_event_summaries(summary_date)
  where summary_type='sunday';

create or replace function public.cms_guard_sunday_summary_workflow()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_role text;
begin
  select p.role::text into v_role
  from public.profiles p
  where p.user_id = (select auth.uid());

  if tg_op = 'INSERT' then
    if coalesce(new.workflow_status,'draft') <> 'draft' then
      raise exception 'A Sunday summary must start as a draft';
    end if;
    new.workflow_status := 'draft';
    new.updated_at := now();

    if v_role not in ('admin','pastor') and
       (coalesce(new.tithe_total,0) <> 0 or coalesce(new.offering_total,0) <> 0) then
      raise exception 'Only Pastor or Admin can enter tithes and offerings';
    end if;

    return new;
  end if;

  if old.workflow_status = 'posted' then
    raise exception 'A posted Sunday summary is locked';
  end if;

  if v_role not in ('admin','pastor') and
     (new.tithe_total is distinct from old.tithe_total or
      new.offering_total is distinct from old.offering_total) then
    raise exception 'Only Pastor or Admin can enter tithes and offerings';
  end if;

  if old.workflow_status = 'draft' and new.workflow_status = 'posted' then
    raise exception 'Submit the Sunday summary before posting it';
  end if;

  if old.workflow_status = 'draft' and new.workflow_status = 'submitted' then
    new.submitted_at := now();
    new.submitted_by := (select auth.uid());
  elsif old.workflow_status = 'submitted' and new.workflow_status = 'posted' then
    if v_role not in ('admin','pastor') then
      raise exception 'Only Pastor or Admin can post a submitted Sunday summary';
    end if;
    new.posted_at := now();
    new.posted_by := (select auth.uid());
  elsif new.workflow_status is distinct from old.workflow_status then
    raise exception 'Invalid Sunday summary workflow transition';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_cms_guard_sunday_summary_workflow on public.cms_sunday_event_summaries;
create trigger trg_cms_guard_sunday_summary_workflow
before insert or update on public.cms_sunday_event_summaries
for each row execute function public.cms_guard_sunday_summary_workflow();

drop policy if exists "leaders_can_insert_summary" on public.cms_sunday_event_summaries;
drop policy if exists "leaders_can_read_summary" on public.cms_sunday_event_summaries;
drop policy if exists "leaders_can_update_summary" on public.cms_sunday_event_summaries;
drop policy if exists "leaders_can_delete_summary" on public.cms_sunday_event_summaries;
drop policy if exists "summary_read_posted_or_leaders" on public.cms_sunday_event_summaries;
drop policy if exists "summary_leaders_insert_draft" on public.cms_sunday_event_summaries;
drop policy if exists "summary_leaders_update_unposted" on public.cms_sunday_event_summaries;
drop policy if exists "summary_leaders_delete_unposted" on public.cms_sunday_event_summaries;

create policy "summary_read_posted_or_leaders"
on public.cms_sunday_event_summaries for select to authenticated
using (
  workflow_status='posted'
  or exists (
    select 1 from public.profiles p
    where p.user_id=(select auth.uid())
      and p.role::text in ('admin','pastor','area_leader')
  )
);

create policy "summary_leaders_insert_draft"
on public.cms_sunday_event_summaries for insert to authenticated
with check (
  created_by=(select auth.uid())
  and workflow_status='draft'
  and exists (
    select 1 from public.profiles p
    where p.user_id=(select auth.uid())
      and p.role::text in ('admin','pastor','area_leader')
  )
);

create policy "summary_leaders_update_unposted"
on public.cms_sunday_event_summaries for update to authenticated
using (
  workflow_status<>'posted'
  and (
    exists (
      select 1 from public.profiles p
      where p.user_id=(select auth.uid())
        and p.role::text in ('admin','pastor')
    )
    or (
      created_by=(select auth.uid())
      and exists (
        select 1 from public.profiles p
        where p.user_id=(select auth.uid())
          and p.role::text='area_leader'
      )
    )
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.user_id=(select auth.uid())
      and p.role::text in ('admin','pastor')
  )
  or (
    created_by=(select auth.uid())
    and exists (
      select 1 from public.profiles p
      where p.user_id=(select auth.uid())
        and p.role::text='area_leader'
    )
  )
);

create policy "summary_leaders_delete_unposted"
on public.cms_sunday_event_summaries for delete to authenticated
using (
  workflow_status<>'posted'
  and (
    exists (
      select 1 from public.profiles p
      where p.user_id=(select auth.uid())
        and p.role::text in ('admin','pastor')
    )
    or created_by=(select auth.uid())
  )
);

drop policy if exists "leaders_can_insert_summary_photos" on public.cms_summary_photos;
drop policy if exists "leaders_can_read_summary_photos" on public.cms_summary_photos;
drop policy if exists "summary_photos_insert" on public.cms_summary_photos;
drop policy if exists "summary_photos_update" on public.cms_summary_photos;
drop policy if exists "summary_photos_delete" on public.cms_summary_photos;
drop policy if exists "summary_photos_read_posted_or_leaders" on public.cms_summary_photos;
drop policy if exists "summary_photos_leaders_insert" on public.cms_summary_photos;
drop policy if exists "summary_photos_leaders_update" on public.cms_summary_photos;
drop policy if exists "summary_photos_leaders_delete" on public.cms_summary_photos;

create policy "summary_photos_read_posted_or_leaders"
on public.cms_summary_photos for select to authenticated
using (
  exists (
    select 1
    from public.cms_sunday_event_summaries s
    where s.id=cms_summary_photos.summary_id
      and (
        s.workflow_status='posted'
        or exists (
          select 1 from public.profiles p
          where p.user_id=(select auth.uid())
            and p.role::text in ('admin','pastor','area_leader')
        )
      )
  )
);

create policy "summary_photos_leaders_insert"
on public.cms_summary_photos for insert to authenticated
with check (
  exists (
    select 1
    from public.cms_sunday_event_summaries s
    join public.profiles p on p.user_id=(select auth.uid())
    where s.id=cms_summary_photos.summary_id
      and s.workflow_status<>'posted'
      and (
        p.role::text in ('admin','pastor')
        or (p.role::text='area_leader' and s.created_by=(select auth.uid()))
      )
  )
);

create policy "summary_photos_leaders_update"
on public.cms_summary_photos for update to authenticated
using (
  exists (
    select 1
    from public.cms_sunday_event_summaries s
    join public.profiles p on p.user_id=(select auth.uid())
    where s.id=cms_summary_photos.summary_id
      and s.workflow_status<>'posted'
      and (
        p.role::text in ('admin','pastor')
        or (p.role::text='area_leader' and s.created_by=(select auth.uid()))
      )
  )
)
with check (
  exists (
    select 1
    from public.cms_sunday_event_summaries s
    join public.profiles p on p.user_id=(select auth.uid())
    where s.id=cms_summary_photos.summary_id
      and s.workflow_status<>'posted'
      and (
        p.role::text in ('admin','pastor')
        or (p.role::text='area_leader' and s.created_by=(select auth.uid()))
      )
  )
);

create policy "summary_photos_leaders_delete"
on public.cms_summary_photos for delete to authenticated
using (
  exists (
    select 1
    from public.cms_sunday_event_summaries s
    join public.profiles p on p.user_id=(select auth.uid())
    where s.id=cms_summary_photos.summary_id
      and s.workflow_status<>'posted'
      and (
        p.role::text in ('admin','pastor')
        or (p.role::text='area_leader' and s.created_by=(select auth.uid()))
      )
  )
);

drop policy if exists "summary_gallery_upload" on storage.objects;
drop policy if exists "summary_gallery_update" on storage.objects;
drop policy if exists "summary_gallery_delete" on storage.objects;

create policy "summary_gallery_upload"
on storage.objects for insert to authenticated
with check (
  bucket_id='vccf-gallery'
  and (storage.foldername(name))[1]='summary'
  and exists (
    select 1
    from public.cms_sunday_event_summaries s
    join public.profiles p on p.user_id=(select auth.uid())
    where s.id::text=(storage.foldername(name))[2]
      and s.workflow_status<>'posted'
      and (
        p.role::text in ('admin','pastor')
        or (p.role::text='area_leader' and s.created_by=(select auth.uid()))
      )
  )
);

create policy "summary_gallery_update"
on storage.objects for update to authenticated
using (
  bucket_id='vccf-gallery'
  and (storage.foldername(name))[1]='summary'
  and exists (
    select 1
    from public.cms_sunday_event_summaries s
    join public.profiles p on p.user_id=(select auth.uid())
    where s.id::text=(storage.foldername(name))[2]
      and s.workflow_status<>'posted'
      and (
        p.role::text in ('admin','pastor')
        or (p.role::text='area_leader' and s.created_by=(select auth.uid()))
      )
  )
)
with check (
  bucket_id='vccf-gallery'
  and (storage.foldername(name))[1]='summary'
  and exists (
    select 1
    from public.cms_sunday_event_summaries s
    join public.profiles p on p.user_id=(select auth.uid())
    where s.id::text=(storage.foldername(name))[2]
      and s.workflow_status<>'posted'
      and (
        p.role::text in ('admin','pastor')
        or (p.role::text='area_leader' and s.created_by=(select auth.uid()))
      )
  )
);

create policy "summary_gallery_delete"
on storage.objects for delete to authenticated
using (
  bucket_id='vccf-gallery'
  and (storage.foldername(name))[1]='summary'
  and exists (
    select 1
    from public.cms_sunday_event_summaries s
    join public.profiles p on p.user_id=(select auth.uid())
    where s.id::text=(storage.foldername(name))[2]
      and s.workflow_status<>'posted'
      and (
        p.role::text in ('admin','pastor')
        or (p.role::text='area_leader' and s.created_by=(select auth.uid()))
      )
  )
);

grant select,insert,update,delete on public.cms_sunday_event_summaries to authenticated;
grant select,insert,update,delete on public.cms_summary_photos to authenticated;
