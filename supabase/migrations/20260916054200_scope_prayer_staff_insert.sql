drop policy if exists "prayers_staff_insert" on public.prayer_requests;
create policy "prayers_staff_insert"
on public.prayer_requests
for insert
to authenticated
with check (
  exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and p.role in ('admin','pastor')
  )
  or exists (
    select 1
    from public.profiles p
    join public.members m on m.id = prayer_requests.member_id
    where p.user_id = auth.uid()
      and p.role = 'area_leader'
      and p.area_id = m.area_id
  )
);
