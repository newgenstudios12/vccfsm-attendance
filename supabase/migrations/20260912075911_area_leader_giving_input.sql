drop policy if exists "giving finance read" on public.giving_records;
create policy "giving finance read"
on public.giving_records for select
to authenticated
using (
  public.finance_access()
  or (
    public."current_role"() = 'area_leader'::public.app_role
    and exists (
      select 1
      from public.members m
      where m.id = giving_records.member_id
        and m.area_id = public.current_area_id()
    )
  )
);

drop policy if exists "giving finance write" on public.giving_records;
create policy "giving finance write"
on public.giving_records for all
to authenticated
using (
  public.finance_access()
  or (
    public."current_role"() = 'area_leader'::public.app_role
    and giving_records.sunday_batch_id is null
    and giving_records.recorded_by = (select auth.uid())
    and exists (
      select 1
      from public.members m
      where m.id = giving_records.member_id
        and m.area_id = public.current_area_id()
    )
  )
)
with check (
  public.finance_access()
  or (
    public."current_role"() = 'area_leader'::public.app_role
    and giving_records.sunday_batch_id is null
    and giving_records.recorded_by = (select auth.uid())
    and exists (
      select 1
      from public.members m
      where m.id = giving_records.member_id
        and m.area_id = public.current_area_id()
    )
  )
);

create or replace function private.get_giving_member_directory()
returns table (
  id uuid,
  display_name text,
  first_name text,
  last_name text,
  member_code text,
  area_id uuid,
  is_active boolean,
  status text
)
language sql
stable
security definer
set search_path to ''
as $function$
  select m.id,m.display_name,m.first_name,m.last_name,m.member_code,m.area_id,m.is_active,m.status
  from public.members m
  where public.finance_access()
     or (
       public."current_role"() = 'area_leader'::public.app_role
       and m.area_id = public.current_area_id()
     )
  order by coalesce(m.display_name,m.first_name,m.member_code),m.last_name;
$function$;

revoke all on function private.get_giving_member_directory() from public,anon;
grant usage on schema private to authenticated;
grant execute on function private.get_giving_member_directory() to authenticated;

grant select, insert, update, delete on table public.giving_records to authenticated;
