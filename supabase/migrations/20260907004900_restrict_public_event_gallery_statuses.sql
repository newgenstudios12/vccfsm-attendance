-- Limit anonymous event-photo access to public event lifecycle states only.
-- Draft/cancelled event photos remain private even though completed-event albums stay visible in Gallery.

drop policy if exists "Public can read event photos" on public.church_event_photos;
create policy "Public can read event photos"
on public.church_event_photos
for select
to anon
using (event_status in ('Scheduled','Completed'));
