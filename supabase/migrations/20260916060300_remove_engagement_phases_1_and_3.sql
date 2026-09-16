-- Remove Member Engagement Phases 1 and 3.
-- Phase 2 (Daily Devotional) and Phase 4 (Interactive Sermons) remain active.

-- Disable/remove rollout flags for deleted phases.
delete from public.site_settings
where key in ('member_engagement_phase1_enabled','member_engagement_phase3_enabled');

-- Remove Phase 1 Prayer Wall synchronization and shared data structures.
drop trigger if exists sync_prayer_wall_post on public.prayer_requests;
drop trigger if exists refresh_prayer_wall_count on public.prayer_wall_supports;

drop function if exists vccf_private.sync_prayer_wall_post();
drop function if exists vccf_private.refresh_prayer_wall_count();

drop table if exists public.prayer_wall_supports cascade;
drop table if exists public.prayer_wall_posts cascade;

-- Remove the Phase 1-only member self-edit policy and answer-note field.
drop policy if exists "prayers own update" on public.prayer_requests;
alter table public.prayer_requests drop column if exists answered_note;

-- Keep the existing confidential prayer-request policies in their pre-Phase-1 form.
drop policy if exists "prayers own or leaders" on public.prayer_requests;
create policy "prayers own or leaders" on public.prayer_requests for select to authenticated using (
  member_id=(select p.member_id from public.profiles p where p.user_id=auth.uid())
  or exists (select 1 from public.profiles p where p.user_id=auth.uid() and p.role in ('admin','pastor'))
  or exists (
    select 1 from public.profiles p
    join public.members m on m.id=prayer_requests.member_id
    where p.user_id=auth.uid() and p.role='area_leader' and p.area_id=m.area_id
  )
);

drop policy if exists "prayers leaders update" on public.prayer_requests;
create policy "prayers leaders update" on public.prayer_requests for update to authenticated using (
  exists (select 1 from public.profiles p where p.user_id=auth.uid() and p.role in ('admin','pastor'))
  or exists (
    select 1 from public.profiles p
    join public.members m on m.id=prayer_requests.member_id
    where p.user_id=auth.uid() and p.role='area_leader' and p.area_id=m.area_id
  )
) with check (
  exists (select 1 from public.profiles p where p.user_id=auth.uid() and p.role in ('admin','pastor'))
  or exists (
    select 1 from public.profiles p
    join public.members m on m.id=prayer_requests.member_id
    where p.user_id=auth.uid() and p.role='area_leader' and p.area_id=m.area_id
  )
);

-- Remove the private schema only if no other objects use it.
do $$
begin
  if exists (select 1 from pg_namespace where nspname='vccf_private')
     and not exists (
       select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='vccf_private'
     )
     and not exists (
       select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='vccf_private'
     ) then
    execute 'drop schema vccf_private';
  end if;
end $$;
