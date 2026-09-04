alter table public.church_announcements
  drop constraint if exists church_announcements_recurrence_check;

alter table public.church_announcements
  add constraint church_announcements_recurrence_check
  check (recurrence = any (array['once'::text, 'daily'::text, 'weekly'::text]));

alter table public.church_announcements
  drop constraint if exists church_announcements_daily_time_check;

alter table public.church_announcements
  add constraint church_announcements_daily_time_check
  check ((recurrence = 'once'::text) or (daily_time is not null));
