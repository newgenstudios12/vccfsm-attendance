-- Fix for member status/delete policies when profiles.role is an enum (app_role).
-- Cast the enum to text before comparing it to a string.

alter table public.members
  add column if not exists status text not null default 'active' check (status in ('active','inactive')),
  add column if not exists status_updated_at timestamptz;

-- Admins and Area Leaders may change member status.
drop policy if exists "members_status_admin_leader_update" on public.members;
create policy "members_status_admin_leader_update"
on public.members for update
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and p.role::text = 'admin'
  )
  or exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and p.role::text in ('area leader','area_leader')
      and p.area_id = public.members.area_id
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and p.role::text = 'admin'
  )
  or exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and p.role::text in ('area leader','area_leader')
      and p.area_id = public.members.area_id
  )
);

-- Only Admins may delete members.
drop policy if exists "members_admin_delete" on public.members;
create policy "members_admin_delete"
on public.members for delete
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and p.role::text = 'admin'
  )
);

-- Admins may unlink a profile from a member before deletion.
drop policy if exists "profiles_admin_member_unlink" on public.profiles;
create policy "profiles_admin_member_unlink"
on public.profiles for update
to authenticated
using (
  exists (
    select 1 from public.profiles me
    where me.user_id = auth.uid()
      and me.role::text = 'admin'
  )
)
with check (
  exists (
    select 1 from public.profiles me
    where me.user_id = auth.uid()
      and me.role::text = 'admin'
  )
);
