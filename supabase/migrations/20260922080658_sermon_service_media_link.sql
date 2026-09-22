alter table public.vccf_sermons add column if not exists service_media_id uuid references public.cms_services(id) on delete set null;
