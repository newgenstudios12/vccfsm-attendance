create table if not exists public.cms_service_summary_photos (
  id uuid primary key default gen_random_uuid(),
  summary_id uuid not null references public.cms_service_summaries(id) on delete cascade,
  image_url text not null,
  storage_path text not null,
  caption text,
  uploaded_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cms_service_summary_photos_one_per_summary unique (summary_id)
);

alter table public.cms_service_summary_photos enable row level security;
grant select, insert, update, delete on table public.cms_service_summary_photos to authenticated;

create policy "service summary photos staff read"
on public.cms_service_summary_photos for select
to authenticated
using (
  exists (
    select 1
    from public.cms_service_summaries s
    join public.profiles p on p.user_id = (select auth.uid())
    where s.id = cms_service_summary_photos.summary_id
      and s.summary_type = 'Bible Study'
      and (
        p.role::text in ('admin','pastor')
        or (p.role::text = 'area_leader' and (s.area_id is null or s.area_id = p.area_id))
      )
  )
);

create policy "service summary photos staff insert"
on public.cms_service_summary_photos for insert
to authenticated
with check (
  uploaded_by = (select auth.uid())
  and exists (
    select 1
    from public.cms_service_summaries s
    join public.profiles p on p.user_id = (select auth.uid())
    where s.id = cms_service_summary_photos.summary_id
      and s.summary_type = 'Bible Study'
      and (
        p.role::text in ('admin','pastor')
        or (p.role::text = 'area_leader' and s.area_id = p.area_id)
      )
  )
);

create policy "service summary photos staff update"
on public.cms_service_summary_photos for update
to authenticated
using (
  exists (
    select 1
    from public.cms_service_summaries s
    join public.profiles p on p.user_id = (select auth.uid())
    where s.id = cms_service_summary_photos.summary_id
      and s.summary_type = 'Bible Study'
      and (
        p.role::text in ('admin','pastor')
        or (p.role::text = 'area_leader' and s.area_id = p.area_id)
      )
  )
)
with check (
  uploaded_by = (select auth.uid())
  and exists (
    select 1
    from public.cms_service_summaries s
    join public.profiles p on p.user_id = (select auth.uid())
    where s.id = cms_service_summary_photos.summary_id
      and s.summary_type = 'Bible Study'
      and (
        p.role::text in ('admin','pastor')
        or (p.role::text = 'area_leader' and s.area_id = p.area_id)
      )
  )
);

create policy "service summary photos staff delete"
on public.cms_service_summary_photos for delete
to authenticated
using (
  exists (
    select 1
    from public.cms_service_summaries s
    join public.profiles p on p.user_id = (select auth.uid())
    where s.id = cms_service_summary_photos.summary_id
      and s.summary_type = 'Bible Study'
      and (
        p.role::text in ('admin','pastor')
        or (p.role::text = 'area_leader' and s.area_id = p.area_id)
      )
  )
);

create policy "service_summary_gallery_upload"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'vccf-gallery'
  and (storage.foldername(name))[1] = 'service-summary'
  and exists (
    select 1
    from public.cms_service_summaries s
    join public.profiles p on p.user_id = (select auth.uid())
    where s.id::text = (storage.foldername(name))[2]
      and s.summary_type = 'Bible Study'
      and (
        p.role::text in ('admin','pastor')
        or (p.role::text = 'area_leader' and s.area_id = p.area_id)
      )
  )
);

create policy "service_summary_gallery_delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'vccf-gallery'
  and (storage.foldername(name))[1] = 'service-summary'
  and exists (
    select 1
    from public.cms_service_summaries s
    join public.profiles p on p.user_id = (select auth.uid())
    where s.id::text = (storage.foldername(objects.name))[2]
      and s.summary_type = 'Bible Study'
      and (
        p.role::text in ('admin','pastor')
        or (p.role::text = 'area_leader' and s.area_id = p.area_id)
      )
  )
);
