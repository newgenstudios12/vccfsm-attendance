update public.profiles
set onboarding_completed_at = now()
where onboarding_completed_at is null
  and created_at < timestamptz '2026-09-14 16:30:00+00';
