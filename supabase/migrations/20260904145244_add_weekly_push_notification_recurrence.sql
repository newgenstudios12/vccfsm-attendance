alter table public.push_notifications drop constraint if exists push_notifications_recurrence_check;
alter table public.push_notifications add constraint push_notifications_recurrence_check check (recurrence = any (array['once'::text,'daily'::text,'weekly'::text]));

alter table public.push_notifications drop constraint if exists push_notifications_check;
alter table public.push_notifications add constraint push_notifications_check check ((recurrence = 'once'::text) or (daily_time is not null));
