alter table public.daily_bible_verse_selections
  drop constraint if exists daily_bible_verse_selections_translation_check;

alter table public.daily_bible_verse_selections
  add constraint daily_bible_verse_selections_translation_check
  check (translation = any (array['MBBTAG'::text,'RTPV05'::text,'NIV'::text,'ESV'::text,'KJV'::text]));

alter table public.daily_bible_verse_selections
  add column if not exists source_provider text,
  add column if not exists source_version_id text,
  add column if not exists source_license_url text,
  add column if not exists source_fetched_at timestamptz;

comment on column public.daily_bible_verse_selections.source_provider is 'Licensed Scripture source/provider, e.g. Bible Brain / Faith Comes By Hearing.';
comment on column public.daily_bible_verse_selections.source_version_id is 'Provider-specific Bible/version identifier. Do not store API keys here.';
comment on column public.daily_bible_verse_selections.source_license_url is 'Public license/terms URL governing the source text.';
comment on column public.daily_bible_verse_selections.source_fetched_at is 'When externally sourced verse text was retrieved.';
