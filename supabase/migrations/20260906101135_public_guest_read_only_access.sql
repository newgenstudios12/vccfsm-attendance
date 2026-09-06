-- Public guest read-only access for VCCF Connect.
-- Only approved public-facing fields are exposed to the anon role.
-- Private member, attendance, finance, pledge, pastoral care, registration,
-- profile, report, and administrative data remain governed by existing
-- authenticated/scoped policies.

alter table public.site_people enable row level security;
alter table public.church_service_types enable row level security;
alter table public.ministries enable row level security;
alter table public.vccf_sermons enable row level security;
alter table public.church_events enable row level security;
alter table public.church_announcements enable row level security;
alter table public.daily_bible_verse_selections enable row level security;
alter table public.gallery_albums enable row level security;
alter table public.gallery_album_photos enable row level security;

revoke all on table public.site_people from anon;
grant select (id, kind, name, description, sort_order) on table public.site_people to anon;

revoke all on table public.church_service_types from anon;
grant select (id, name, description, day_of_week, start_time, location, is_active) on table public.church_service_types to anon;

revoke all on table public.ministries from anon;
grant select (id, name, description, is_active) on table public.ministries to anon;

revoke all on table public.vccf_sermons from anon;
grant select (id, title, description, file_name, mime_type, file_size, created_at, sermon_category, preacher, sermon_date) on table public.vccf_sermons to anon;

revoke all on table public.church_events from anon;
grant select (id, title, description, event_type, start_at, end_at, location, registration_required, status, participation_mode) on table public.church_events to anon;

revoke all on table public.church_announcements from anon;
grant select (id, title, body, publish_at, expires_at, image_url, show_on_dashboard) on table public.church_announcements to anon;

revoke all on table public.daily_bible_verse_selections from anon;
grant select (verse_date, reference, verse_text, translation) on table public.daily_bible_verse_selections to anon;

revoke all on table public.gallery_albums from anon;
grant select (id, title, description, album_date, created_at) on table public.gallery_albums to anon;

revoke all on table public.gallery_album_photos from anon;
grant select (id, album_id, image_url, caption, sort_order, created_at) on table public.gallery_album_photos to anon;

drop policy if exists site_people_public_guest_read on public.site_people;
create policy site_people_public_guest_read
on public.site_people for select to anon
using (true);

drop policy if exists church_service_types_public_guest_read on public.church_service_types;
create policy church_service_types_public_guest_read
on public.church_service_types for select to anon
using (is_active = true);

drop policy if exists ministries_public_guest_read on public.ministries;
create policy ministries_public_guest_read
on public.ministries for select to anon
using (is_active = true);

drop policy if exists vccf_sermons_public_guest_read on public.vccf_sermons;
create policy vccf_sermons_public_guest_read
on public.vccf_sermons for select to anon
using (true);

drop policy if exists church_events_public_guest_read on public.church_events;
create policy church_events_public_guest_read
on public.church_events for select to anon
using (status in ('Scheduled','Completed'));

drop policy if exists church_announcements_public_guest_read on public.church_announcements;
create policy church_announcements_public_guest_read
on public.church_announcements for select to anon
using (
  is_published = true
  and audience = 'All'
  and publish_at <= now()
  and (expires_at is null or expires_at > now())
);

drop policy if exists daily_bible_verse_public_guest_read on public.daily_bible_verse_selections;
create policy daily_bible_verse_public_guest_read
on public.daily_bible_verse_selections for select to anon
using (verse_date <= ((now() at time zone 'Asia/Manila')::date));

drop policy if exists gallery_albums_public_guest_read on public.gallery_albums;
create policy gallery_albums_public_guest_read
on public.gallery_albums for select to anon
using (true);

drop policy if exists gallery_album_photos_public_guest_read on public.gallery_album_photos;
create policy gallery_album_photos_public_guest_read
on public.gallery_album_photos for select to anon
using (true);
