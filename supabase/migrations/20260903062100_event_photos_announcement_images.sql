-- Event attendance photos and announcement images

create table if not exists public.church_event_photos (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.church_events(id) on delete cascade,
  image_url text not null,
  storage_path text,
  caption text,
  sort_order integer not null default 0,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists church_event_photos_event_idx
  on public.church_event_photos(event_id, sort_order, created_at);

alter table public.church_event_photos enable row level security;
revoke all on public.church_event_photos from anon;
grant select,insert,update,delete on public.church_event_photos to authenticated;

drop policy if exists "church_event_photos_read" on public.church_event_photos;
drop policy if exists "church_event_photos_insert" on public.church_event_photos;
drop policy if exists "church_event_photos_update" on public.church_event_photos;
drop policy if exists "church_event_photos_delete" on public.church_event_photos;

create policy "church_event_photos_read"
on public.church_event_photos for select
to authenticated
using (true);

create policy "church_event_photos_insert"
on public.church_event_photos for insert
to authenticated
with check (
  exists (
    select 1
    from public.church_events e
    join public.profiles p on p.user_id=(select auth.uid())
    where e.id=church_event_photos.event_id
      and (
        p.role::text in ('admin','pastor')
        or (p.role::text='area_leader' and p.area_id=e.area_id)
      )
  )
);

create policy "church_event_photos_update"
on public.church_event_photos for update
to authenticated
using (
  exists (
    select 1
    from public.church_events e
    join public.profiles p on p.user_id=(select auth.uid())
    where e.id=church_event_photos.event_id
      and (
        p.role::text in ('admin','pastor')
        or (p.role::text='area_leader' and p.area_id=e.area_id)
      )
  )
)
with check (
  exists (
    select 1
    from public.church_events e
    join public.profiles p on p.user_id=(select auth.uid())
    where e.id=church_event_photos.event_id
      and (
        p.role::text in ('admin','pastor')
        or (p.role::text='area_leader' and p.area_id=e.area_id)
      )
  )
);

create policy "church_event_photos_delete"
on public.church_event_photos for delete
to authenticated
using (
  exists (
    select 1
    from public.church_events e
    join public.profiles p on p.user_id=(select auth.uid())
    where e.id=church_event_photos.event_id
      and (
        p.role::text in ('admin','pastor')
        or (p.role::text='area_leader' and p.area_id=e.area_id)
      )
  )
);

drop policy if exists "event_gallery_upload" on storage.objects;
drop policy if exists "event_gallery_update" on storage.objects;
drop policy if exists "event_gallery_delete" on storage.objects;

create policy "event_gallery_upload"
on storage.objects for insert
to authenticated
with check (
  bucket_id='vccf-gallery'
  and (storage.foldername(name))[1]='event'
  and exists (
    select 1
    from public.church_events e
    join public.profiles p on p.user_id=(select auth.uid())
    where e.id::text=(storage.foldername(name))[2]
      and (
        p.role::text in ('admin','pastor')
        or (p.role::text='area_leader' and p.area_id=e.area_id)
      )
  )
);

create policy "event_gallery_delete"
on storage.objects for delete
to authenticated
using (
  bucket_id='vccf-gallery'
  and (storage.foldername(name))[1]='event'
  and exists (
    select 1
    from public.church_events e
    join public.profiles p on p.user_id=(select auth.uid())
    where e.id::text=(storage.foldername(name))[2]
      and (
        p.role::text in ('admin','pastor')
        or (p.role::text='area_leader' and p.area_id=e.area_id)
      )
  )
);

alter table public.church_announcements
  add column if not exists image_url text,
  add column if not exists image_storage_path text;

alter table public.church_announcements
  alter column body set default '';

update public.church_announcements
set body=''
where body is null;

alter table public.church_announcements
  alter column body set not null;

drop policy if exists "announcement_gallery_upload" on storage.objects;
drop policy if exists "announcement_gallery_delete" on storage.objects;

create policy "announcement_gallery_upload"
on storage.objects for insert
to authenticated
with check (
  bucket_id='vccf-gallery'
  and (storage.foldername(name))[1]='announcement'
  and exists (
    select 1
    from public.church_announcements a
    join public.profiles p on p.user_id=(select auth.uid())
    where a.id::text=(storage.foldername(name))[2]
      and (
        p.role::text in ('admin','pastor')
        or (p.role::text='area_leader' and p.area_id=a.area_id)
        or (
          p.role::text='ministry_leader'
          and exists (
            select 1
            from public.church_leadership l
            where l.member_id=p.member_id
              and l.is_active
              and l.ministry_id=a.ministry_id
          )
        )
      )
  )
);

create policy "announcement_gallery_delete"
on storage.objects for delete
to authenticated
using (
  bucket_id='vccf-gallery'
  and (storage.foldername(name))[1]='announcement'
  and exists (
    select 1
    from public.church_announcements a
    join public.profiles p on p.user_id=(select auth.uid())
    where a.id::text=(storage.foldername(name))[2]
      and (
        p.role::text in ('admin','pastor')
        or (p.role::text='area_leader' and p.area_id=a.area_id)
        or (
          p.role::text='ministry_leader'
          and exists (
            select 1
            from public.church_leadership l
            where l.member_id=p.member_id
              and l.is_active
              and l.ministry_id=a.ministry_id
          )
        )
      )
  )
);
