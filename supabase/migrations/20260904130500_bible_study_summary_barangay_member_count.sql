create or replace function public.set_bible_study_summary_barangay_member_count()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.summary_type = 'Bible Study' then
    select count(*)::integer
      into new.member_count
    from public.members m
    where m.is_active is not false
      and lower(coalesce(m.status,'active')) <> 'inactive'
      and (new.area_id is null or m.area_id = new.area_id)
      and lower(btrim(coalesce(m.barangay,''))) = lower(btrim(coalesce(new.barangay,'')));
  end if;
  return new;
end;
$$;

drop trigger if exists trg_bible_study_summary_barangay_member_count on public.cms_service_summaries;
create trigger trg_bible_study_summary_barangay_member_count
before insert or update of summary_type, area_id, barangay, member_count
on public.cms_service_summaries
for each row execute function public.set_bible_study_summary_barangay_member_count();

update public.cms_service_summaries s
set member_count = (
  select count(*)::integer
  from public.members m
  where m.is_active is not false
    and lower(coalesce(m.status,'active')) <> 'inactive'
    and (s.area_id is null or m.area_id = s.area_id)
    and lower(btrim(coalesce(m.barangay,''))) = lower(btrim(coalesce(s.barangay,'')))
),
updated_at = now()
where s.summary_type = 'Bible Study';
