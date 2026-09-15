create schema if not exists private;

revoke all on schema private from public;
revoke all on schema private from anon;
grant usage on schema private to authenticated;

create or replace function private.member_bible_study_gallery_rows()
returns table (
  summary_id uuid,
  summary_title text,
  summary_date date,
  area_id uuid,
  barangay text,
  photo_id uuid,
  image_url text,
  caption text,
  photo_created_at timestamptz
)
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select
    s.id as summary_id,
    coalesce(nullif(btrim(s.title), ''), 'Bible Study Summary') as summary_title,
    s.summary_date,
    s.area_id,
    s.barangay,
    p.id as photo_id,
    p.image_url,
    p.caption,
    p.created_at as photo_created_at
  from public.cms_service_summaries s
  join public.cms_service_summary_photos p on p.summary_id = s.id
  where (select auth.uid()) is not null
    and s.summary_type = 'Bible Study'
    and s.workflow_status = 'approved'
  order by s.summary_date desc, p.created_at asc;
$$;

revoke all on function private.member_bible_study_gallery_rows() from public;
revoke all on function private.member_bible_study_gallery_rows() from anon;
grant execute on function private.member_bible_study_gallery_rows() to authenticated;

create or replace function public.get_member_bible_study_gallery()
returns table (
  summary_id uuid,
  summary_title text,
  summary_date date,
  area_id uuid,
  barangay text,
  photo_id uuid,
  image_url text,
  caption text,
  photo_created_at timestamptz
)
language sql
stable
security invoker
set search_path = pg_catalog
as $$
  select * from private.member_bible_study_gallery_rows();
$$;

revoke all on function public.get_member_bible_study_gallery() from public;
revoke all on function public.get_member_bible_study_gallery() from anon;
grant execute on function public.get_member_bible_study_gallery() to authenticated;
