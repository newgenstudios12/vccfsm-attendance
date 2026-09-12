drop policy if exists "giving finance write" on public.giving_records;
create policy "giving finance write"
on public.giving_records for all
to authenticated
using (public.finance_access())
with check (public.finance_access());

drop policy if exists "area leader giving insert" on public.giving_records;
create policy "area leader giving insert"
on public.giving_records for insert
to authenticated
with check (
  public."current_role"() = 'area_leader'::public.app_role
  and giving_records.sunday_batch_id is null
  and giving_records.recorded_by = (select auth.uid())
  and exists (
    select 1
    from public.members m
    where m.id = giving_records.member_id
      and m.area_id = public.current_area_id()
  )
);
