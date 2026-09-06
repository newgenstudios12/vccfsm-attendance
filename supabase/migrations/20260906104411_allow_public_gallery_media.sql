grant select (id, summary_type, title, summary_date, workflow_status) on table public.cms_sunday_event_summaries to anon;
grant select (id, summary_id, image_url, caption, sort_order, created_at) on table public.cms_summary_photos to anon;
grant select (id, event_id, image_url, caption, sort_order, created_at) on table public.church_event_photos to anon;

drop policy if exists "Public can read posted summaries" on public.cms_sunday_event_summaries;
create policy "Public can read posted summaries"
on public.cms_sunday_event_summaries
for select
to anon
using (workflow_status = 'posted');

drop policy if exists "Public can read posted summary photos" on public.cms_summary_photos;
create policy "Public can read posted summary photos"
on public.cms_summary_photos
for select
to anon
using (exists (
  select 1 from public.cms_sunday_event_summaries s
  where s.id = cms_summary_photos.summary_id
    and s.workflow_status = 'posted'
));

drop policy if exists "Public can read event photos" on public.church_event_photos;
create policy "Public can read event photos"
on public.church_event_photos
for select
to anon
using (exists (
  select 1 from public.church_events e
  where e.id = church_event_photos.event_id
));
