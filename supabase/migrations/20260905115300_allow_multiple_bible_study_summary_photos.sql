alter table public.cms_service_summary_photos
  drop constraint if exists cms_service_summary_photos_one_per_summary;

create index if not exists cms_service_summary_photos_summary_id_created_at_idx
  on public.cms_service_summary_photos (summary_id, created_at desc);
