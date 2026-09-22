alter table public.vccf_sermons
alter column file_path drop not null,
alter column file_name drop not null,
alter column mime_type drop not null,
alter column file_size drop not null,
add column if not exists service_session_id uuid references public.church_service_sessions(id) on delete set null,
add column if not exists google_drive_url text,
add column if not exists youtube_url text,
add column if not exists facebook_url text;
create index if not exists vccf_sermons_service_session_idx on public.vccf_sermons(service_session_id) where service_session_id is not null;
grant select (service_session_id,google_drive_url,youtube_url,facebook_url) on public.vccf_sermons to anon;
