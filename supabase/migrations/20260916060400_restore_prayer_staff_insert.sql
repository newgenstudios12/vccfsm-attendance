-- Restore the prayer-request staff insert behavior that existed before Phase 1.
drop policy if exists "prayers_staff_insert" on public.prayer_requests;
create policy "prayers_staff_insert"
on public.prayer_requests
for insert
to authenticated
with check (
  exists (
    select 1 from public.profiles p
    where p.user_id = (select auth.uid())
      and p.role in ('admin','pastor','area_leader')
  )
);
