alter table public.cms_summary_photos
  add column if not exists storage_path text,
  add column if not exists uploaded_by uuid references auth.users(id) on delete set null;
