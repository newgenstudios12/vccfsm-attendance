-- Harden Tithes & Offerings access rules.
--
-- Church-wide finance access:
--   * Admin
--   * Pastor
--   * Treasurer account role
--   * Authenticated members assigned to an active Treasurer/Treasury ministry
--
-- Area Leader access:
--   * May read giving only for members / Bible Study sessions in the leader's assigned Area.
--   * May create general giving entries only for members in that Area.
--   * Does not receive church-wide finance access unless the same signed-in member is also
--     authorized through the Treasurer/Treasury ministry (or another finance-wide role).

create or replace function public.finance_access()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select coalesce(
    public."current_role"() = any (
      array[
        'admin'::public.app_role,
        'pastor'::public.app_role,
        'treasurer'::public.app_role
      ]
    )
    or exists (
      select 1
      from public.profiles p
      join public.member_ministries mm on mm.member_id = p.member_id
      join public.ministries m on m.id = mm.ministry_id
      where p.user_id = (select auth.uid())
        and m.is_active is not false
        and lower(trim(m.name)) in (
          'treasurer',
          'treasurer ministry',
          'treasury',
          'treasury ministry'
        )
    ),
    false
  );
$function$;

-- Finance-wide users can read all giving. Area Leaders can read only giving that
-- belongs to their assigned Area, including Bible Study giving linked to that Area.
drop policy if exists "giving finance read" on public.giving_records;
create policy "giving finance read"
on public.giving_records for select
to authenticated
using (
  public.finance_access()
  or (
    public."current_role"() = 'area_leader'::public.app_role
    and (
      (
        giving_records.bible_study_batch_id is null
        and exists (
          select 1
          from public.members m
          where m.id = giving_records.member_id
            and m.area_id = public.current_area_id()
        )
      )
      or
      (
        giving_records.bible_study_batch_id is not null
        and exists (
          select 1
          from public.bible_study_giving_batches b
          join public.cms_service_summaries s on s.id = b.service_summary_id
          where b.id = giving_records.bible_study_batch_id
            and s.summary_type = 'Bible Study'
            and s.area_id = public.current_area_id()
        )
      )
    )
  )
);

-- Only finance-wide users may update/delete ordinary giving records.
drop policy if exists "giving finance write" on public.giving_records;
create policy "giving finance write"
on public.giving_records for all
to authenticated
using (public.finance_access())
with check (public.finance_access());

-- Area Leaders may encode a new ordinary giving record only for a member in their Area.
-- Sunday and Bible Study batch entries continue to use their dedicated workflow policies.
drop policy if exists "area leader giving insert" on public.giving_records;
create policy "area leader giving insert"
on public.giving_records for insert
to authenticated
with check (
  public."current_role"() = 'area_leader'::public.app_role
  and giving_records.sunday_batch_id is null
  and giving_records.bible_study_batch_id is null
  and giving_records.recorded_by = (select auth.uid())
  and exists (
    select 1
    from public.members m
    where m.id = giving_records.member_id
      and m.area_id = public.current_area_id()
  )
);

revoke all on function public.finance_access() from public, anon;
grant execute on function public.finance_access() to authenticated;
