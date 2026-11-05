-- Structured address hierarchy for scheduled Bible Study sessions.
alter table public.bible_study_sessions
  add column if not exists province text,
  add column if not exists city_municipality text,
  add column if not exists province_psgc_code text,
  add column if not exists city_municipality_psgc_code text,
  add column if not exists barangay_psgc_code text;

alter table public.cms_service_summaries
  add column if not exists province text,
  add column if not exists city_municipality text,
  add column if not exists province_psgc_code text,
  add column if not exists city_municipality_psgc_code text,
  add column if not exists barangay_psgc_code text;

create or replace function private.vccf_copy_bible_study_session_address_to_summary()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  if new.summary_id is null then
    return new;
  end if;
  update public.cms_service_summaries s
  set province=coalesce(nullif(s.province,''),nullif(new.province,'')),
      city_municipality=coalesce(nullif(s.city_municipality,''),nullif(new.city_municipality,'')),
      province_psgc_code=coalesce(nullif(s.province_psgc_code,''),nullif(new.province_psgc_code,'')),
      city_municipality_psgc_code=coalesce(nullif(s.city_municipality_psgc_code,''),nullif(new.city_municipality_psgc_code,'')),
      barangay_psgc_code=coalesce(nullif(s.barangay_psgc_code,''),nullif(new.barangay_psgc_code,'')),
      updated_at=now()
  where s.id=new.summary_id
    and s.summary_type='Bible Study'
    and s.workflow_status='draft'
    and s.area_id=new.area_id
    and s.summary_date=(new.start_at at time zone 'Asia/Manila')::date
    and lower(coalesce(s.barangay,''))=lower(coalesce(new.barangay,''))
    and (coalesce(s.province,'')='' or lower(s.province)=lower(coalesce(new.province,'')))
    and (coalesce(s.city_municipality,'')='' or lower(s.city_municipality)=lower(coalesce(new.city_municipality,'')))
    and (
      (coalesce(s.province,'')='' and coalesce(new.province,'')<>'')
      or (coalesce(s.city_municipality,'')='' and coalesce(new.city_municipality,'')<>'')
      or (coalesce(s.province_psgc_code,'')='' and coalesce(new.province_psgc_code,'')<>'')
      or (coalesce(s.city_municipality_psgc_code,'')='' and coalesce(new.city_municipality_psgc_code,'')<>'')
      or (coalesce(s.barangay_psgc_code,'')='' and coalesce(new.barangay_psgc_code,'')<>'')
    );
  return new;
end
$$;
revoke all on function private.vccf_copy_bible_study_session_address_to_summary()
  from public, anon, authenticated;
drop trigger if exists vccf_bible_study_session_summary_address on public.bible_study_sessions;
create trigger vccf_bible_study_session_summary_address
  after insert or update of summary_id,province,city_municipality,province_psgc_code,city_municipality_psgc_code,barangay_psgc_code
  on public.bible_study_sessions
  for each row execute function private.vccf_copy_bible_study_session_address_to_summary();
