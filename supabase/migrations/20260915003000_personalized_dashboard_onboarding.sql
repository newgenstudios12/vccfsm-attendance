alter table public.profiles
  add column if not exists onboarding_completed_at timestamptz;

comment on column public.profiles.onboarding_completed_at is
  'Timestamp recorded when the signed-in user completes or skips the first-login VCCF Connect onboarding tour.';
