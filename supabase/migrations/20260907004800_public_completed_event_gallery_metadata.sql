-- Keep completed event photos public in Gallery without exposing completed event rows in the guest Events feed.
-- Safe event display metadata is denormalized onto photo rows so anon Gallery reads do not depend on church_events RLS.

create schema if not exists private;
revoke all on schema private from public;

alter table public.church_event_photos
  add column if not exists event_title text,
  add column if not exists event_start_at timestamptz,
  add column if not exists event_status text;

update public.church_event_photos p
set
  event_title = e.title,
  event_start_at = e.start_at,
  event_status = e.status
from public.church_events e
where e.id = p.event_id;

create or replace function private.vccf_sync_event_photo_public_meta()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select e.title, e.start_at, e.status
    into new.event_title, new.event_start_at, new.event_status
  from public.church_events e
  where e.id = new.event_id;
  return new;
end;
$$;

revoke execute on function private.vccf_sync_event_photo_public_meta() from public, anon, authenticated;

drop trigger if exists vccf_sync_event_photo_public_meta on public.church_event_photos;
create trigger vccf_sync_event_photo_public_meta
before insert or update of event_id
on public.church_event_photos
for each row
execute function private.vccf_sync_event_photo_public_meta();

create or replace function private.vccf_sync_event_photo_public_meta_from_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.church_event_photos
  set
    event_title = new.title,
    event_start_at = new.start_at,
    event_status = new.status
  where event_id = new.id;
  return new;
end;
$$;

revoke execute on function private.vccf_sync_event_photo_public_meta_from_event() from public, anon, authenticated;

drop trigger if exists vccf_sync_event_photo_public_meta_from_event on public.church_events;
create trigger vccf_sync_event_photo_public_meta_from_event
after update of title, start_at, status
on public.church_events
for each row
execute function private.vccf_sync_event_photo_public_meta_from_event();

revoke all on table public.church_event_photos from anon;
grant select (
  id,
  event_id,
  image_url,
  caption,
  sort_order,
  created_at,
  event_title,
  event_start_at,
  event_status
) on table public.church_event_photos to anon;

drop policy if exists "Public can read event photos" on public.church_event_photos;
create policy "Public can read event photos"
on public.church_event_photos
for select
to anon
using (true);
