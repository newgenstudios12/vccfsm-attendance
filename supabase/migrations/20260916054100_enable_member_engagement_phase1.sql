insert into public.site_settings(key, value, updated_at)
values ('member_engagement_phase1_enabled', 'true', now())
on conflict (key) do nothing;
