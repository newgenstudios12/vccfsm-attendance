drop policy if exists "church_events_public_guest_read" on public.church_events;

create policy "church_events_public_guest_read"
on public.church_events
for select
to anon
using (
  status = 'Scheduled'
  and start_at is not null
  and coalesce(end_at, start_at) >= now()
);
