alter table public.push_notifications drop constraint if exists push_notifications_recurrence_check;
alter table public.push_notifications
  add constraint push_notifications_recurrence_check
  check (recurrence = any (array['once'::text,'daily'::text,'weekly'::text,'monthly'::text]));

alter table public.church_announcements drop constraint if exists church_announcements_recurrence_check;
alter table public.church_announcements
  add constraint church_announcements_recurrence_check
  check (recurrence = any (array['once'::text,'daily'::text,'weekly'::text,'monthly'::text]));