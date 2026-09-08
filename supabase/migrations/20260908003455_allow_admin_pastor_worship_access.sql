-- Allow Admin and Pastor accounts to access/manage Worship Ministry even when
-- they are not linked to a member/ministry assignment. All other roles retain
-- the existing Worship/Creative/Music/Band ministry rules.

alter policy "worship schedules team read"
on public.worship_service_schedules
using (
  exists (select 1 from public.profiles p where p.user_id=(select auth.uid()) and lower(p.role::text) in ('admin','pastor'))
  or exists (
    select 1 from public.profiles p
    join public.member_ministries mm on mm.member_id=p.member_id
    join public.ministries mn on mn.id=mm.ministry_id
    where p.user_id=(select auth.uid())
      and lower(trim(mn.name)) in ('worship','worship ministry','creative ministry','creative arts','creative arts ministry','music','music ministry','band','band ministry')
  )
);

alter policy "worship schedules manager write"
on public.worship_service_schedules
using (
  exists (select 1 from public.profiles p where p.user_id=(select auth.uid()) and lower(p.role::text) in ('admin','pastor'))
  or exists (
    select 1 from public.profiles p
    join public.member_ministries mm on mm.member_id=p.member_id
    join public.ministries mn on mn.id=mm.ministry_id
    where p.user_id=(select auth.uid())
      and lower(trim(mn.name)) in ('worship','worship ministry','creative ministry','creative arts','creative arts ministry','music','music ministry','band','band ministry')
      and lower(coalesce(mm.role_title,'')) ~ '(leader|head|coordinator|director)'
  )
)
with check (
  exists (select 1 from public.profiles p where p.user_id=(select auth.uid()) and lower(p.role::text) in ('admin','pastor'))
  or exists (
    select 1 from public.profiles p
    join public.member_ministries mm on mm.member_id=p.member_id
    join public.ministries mn on mn.id=mm.ministry_id
    where p.user_id=(select auth.uid())
      and lower(trim(mn.name)) in ('worship','worship ministry','creative ministry','creative arts','creative arts ministry','music','music ministry','band','band ministry')
      and lower(coalesce(mm.role_title,'')) ~ '(leader|head|coordinator|director)'
  )
);

alter policy "worship assignments team read"
on public.worship_schedule_assignments
using (
  exists (select 1 from public.profiles p where p.user_id=(select auth.uid()) and lower(p.role::text) in ('admin','pastor'))
  or exists (
    select 1 from public.profiles p
    join public.member_ministries mm on mm.member_id=p.member_id
    join public.ministries mn on mn.id=mm.ministry_id
    where p.user_id=(select auth.uid())
      and lower(trim(mn.name)) in ('worship','worship ministry','creative ministry','creative arts','creative arts ministry','music','music ministry','band','band ministry')
  )
);

alter policy "worship assignments manager write"
on public.worship_schedule_assignments
using (
  exists (select 1 from public.profiles p where p.user_id=(select auth.uid()) and lower(p.role::text) in ('admin','pastor'))
  or exists (
    select 1 from public.profiles p
    join public.member_ministries mm on mm.member_id=p.member_id
    join public.ministries mn on mn.id=mm.ministry_id
    where p.user_id=(select auth.uid())
      and lower(trim(mn.name)) in ('worship','worship ministry','creative ministry','creative arts','creative arts ministry','music','music ministry','band','band ministry')
      and lower(coalesce(mm.role_title,'')) ~ '(leader|head|coordinator|director)'
  )
)
with check (
  exists (select 1 from public.profiles p where p.user_id=(select auth.uid()) and lower(p.role::text) in ('admin','pastor'))
  or exists (
    select 1 from public.profiles p
    join public.member_ministries mm on mm.member_id=p.member_id
    join public.ministries mn on mn.id=mm.ministry_id
    where p.user_id=(select auth.uid())
      and lower(trim(mn.name)) in ('worship','worship ministry','creative ministry','creative arts','creative arts ministry','music','music ministry','band','band ministry')
      and lower(coalesce(mm.role_title,'')) ~ '(leader|head|coordinator|director)'
  )
);

alter policy "worship lineups team read"
on public.worship_lineups
using (
  exists (select 1 from public.profiles p where p.user_id=(select auth.uid()) and lower(p.role::text) in ('admin','pastor'))
  or exists (
    select 1 from public.profiles p
    join public.member_ministries mm on mm.member_id=p.member_id
    join public.ministries mn on mn.id=mm.ministry_id
    where p.user_id=(select auth.uid())
      and lower(trim(mn.name)) in ('worship','worship ministry','creative ministry','creative arts','creative arts ministry','music','music ministry','band','band ministry')
  )
);

alter policy "worship lineups leader insert"
on public.worship_lineups
with check (
  exists (select 1 from public.profiles p where p.user_id=(select auth.uid()) and lower(p.role::text) in ('admin','pastor'))
  or exists (
    select 1 from public.profiles p
    join public.member_ministries mm on mm.member_id=p.member_id
    join public.ministries mn on mn.id=mm.ministry_id
    where p.user_id=(select auth.uid())
      and lower(trim(mn.name)) in ('worship','worship ministry','creative ministry','creative arts','creative arts ministry','music','music ministry','band','band ministry')
      and (
        lower(coalesce(mm.role_title,'')) ~ '(leader|head|coordinator|director)'
        or exists (
          select 1 from public.worship_schedule_assignments wa
          where wa.schedule_id=worship_lineups.schedule_id
            and wa.member_id=p.member_id
            and lower(trim(wa.ministry_role))='worship leader'
        )
      )
  )
);

alter policy "worship lineups leader update"
on public.worship_lineups
using (
  exists (select 1 from public.profiles p where p.user_id=(select auth.uid()) and lower(p.role::text) in ('admin','pastor'))
  or exists (
    select 1 from public.profiles p
    join public.member_ministries mm on mm.member_id=p.member_id
    join public.ministries mn on mn.id=mm.ministry_id
    where p.user_id=(select auth.uid())
      and lower(trim(mn.name)) in ('worship','worship ministry','creative ministry','creative arts','creative arts ministry','music','music ministry','band','band ministry')
      and (
        lower(coalesce(mm.role_title,'')) ~ '(leader|head|coordinator|director)'
        or exists (
          select 1 from public.worship_schedule_assignments wa
          where wa.schedule_id=worship_lineups.schedule_id
            and wa.member_id=p.member_id
            and lower(trim(wa.ministry_role))='worship leader'
        )
      )
  )
)
with check (
  exists (select 1 from public.profiles p where p.user_id=(select auth.uid()) and lower(p.role::text) in ('admin','pastor'))
  or exists (
    select 1 from public.profiles p
    join public.member_ministries mm on mm.member_id=p.member_id
    join public.ministries mn on mn.id=mm.ministry_id
    where p.user_id=(select auth.uid())
      and lower(trim(mn.name)) in ('worship','worship ministry','creative ministry','creative arts','creative arts ministry','music','music ministry','band','band ministry')
      and (
        lower(coalesce(mm.role_title,'')) ~ '(leader|head|coordinator|director)'
        or exists (
          select 1 from public.worship_schedule_assignments wa
          where wa.schedule_id=worship_lineups.schedule_id
            and wa.member_id=p.member_id
            and lower(trim(wa.ministry_role))='worship leader'
        )
      )
  )
);

alter policy "worship lineups manager delete"
on public.worship_lineups
using (
  exists (select 1 from public.profiles p where p.user_id=(select auth.uid()) and lower(p.role::text) in ('admin','pastor'))
  or exists (
    select 1 from public.profiles p
    join public.member_ministries mm on mm.member_id=p.member_id
    join public.ministries mn on mn.id=mm.ministry_id
    where p.user_id=(select auth.uid())
      and lower(trim(mn.name)) in ('worship','worship ministry','creative ministry','creative arts','creative arts ministry','music','music ministry','band','band ministry')
      and lower(coalesce(mm.role_title,'')) ~ '(leader|head|coordinator|director)'
  )
);

alter policy "worship songs team read"
on public.worship_lineup_songs
using (
  exists (select 1 from public.profiles p where p.user_id=(select auth.uid()) and lower(p.role::text) in ('admin','pastor'))
  or exists (
    select 1 from public.profiles p
    join public.member_ministries mm on mm.member_id=p.member_id
    join public.ministries mn on mn.id=mm.ministry_id
    where p.user_id=(select auth.uid())
      and lower(trim(mn.name)) in ('worship','worship ministry','creative ministry','creative arts','creative arts ministry','music','music ministry','band','band ministry')
  )
);

alter policy "worship songs leader insert"
on public.worship_lineup_songs
with check (
  exists (select 1 from public.profiles p where p.user_id=(select auth.uid()) and lower(p.role::text) in ('admin','pastor'))
  or exists (
    select 1 from public.worship_lineups wl
    join public.profiles p on p.user_id=(select auth.uid())
    join public.member_ministries mm on mm.member_id=p.member_id
    join public.ministries mn on mn.id=mm.ministry_id
    where wl.id=worship_lineup_songs.lineup_id
      and lower(trim(mn.name)) in ('worship','worship ministry','creative ministry','creative arts','creative arts ministry','music','music ministry','band','band ministry')
      and (
        lower(coalesce(mm.role_title,'')) ~ '(leader|head|coordinator|director)'
        or exists (
          select 1 from public.worship_schedule_assignments wa
          where wa.schedule_id=wl.schedule_id and wa.member_id=p.member_id and lower(trim(wa.ministry_role))='worship leader'
        )
      )
  )
);

alter policy "worship songs leader update"
on public.worship_lineup_songs
using (
  exists (select 1 from public.profiles p where p.user_id=(select auth.uid()) and lower(p.role::text) in ('admin','pastor'))
  or exists (
    select 1 from public.worship_lineups wl
    join public.profiles p on p.user_id=(select auth.uid())
    join public.member_ministries mm on mm.member_id=p.member_id
    join public.ministries mn on mn.id=mm.ministry_id
    where wl.id=worship_lineup_songs.lineup_id
      and lower(trim(mn.name)) in ('worship','worship ministry','creative ministry','creative arts','creative arts ministry','music','music ministry','band','band ministry')
      and (
        lower(coalesce(mm.role_title,'')) ~ '(leader|head|coordinator|director)'
        or exists (
          select 1 from public.worship_schedule_assignments wa
          where wa.schedule_id=wl.schedule_id and wa.member_id=p.member_id and lower(trim(wa.ministry_role))='worship leader'
        )
      )
  )
)
with check (
  exists (select 1 from public.profiles p where p.user_id=(select auth.uid()) and lower(p.role::text) in ('admin','pastor'))
  or exists (
    select 1 from public.worship_lineups wl
    join public.profiles p on p.user_id=(select auth.uid())
    join public.member_ministries mm on mm.member_id=p.member_id
    join public.ministries mn on mn.id=mm.ministry_id
    where wl.id=worship_lineup_songs.lineup_id
      and lower(trim(mn.name)) in ('worship','worship ministry','creative ministry','creative arts','creative arts ministry','music','music ministry','band','band ministry')
      and (
        lower(coalesce(mm.role_title,'')) ~ '(leader|head|coordinator|director)'
        or exists (
          select 1 from public.worship_schedule_assignments wa
          where wa.schedule_id=wl.schedule_id and wa.member_id=p.member_id and lower(trim(wa.ministry_role))='worship leader'
        )
      )
  )
);

alter policy "worship songs leader delete"
on public.worship_lineup_songs
using (
  exists (select 1 from public.profiles p where p.user_id=(select auth.uid()) and lower(p.role::text) in ('admin','pastor'))
  or exists (
    select 1 from public.worship_lineups wl
    join public.profiles p on p.user_id=(select auth.uid())
    join public.member_ministries mm on mm.member_id=p.member_id
    join public.ministries mn on mn.id=mm.ministry_id
    where wl.id=worship_lineup_songs.lineup_id
      and lower(trim(mn.name)) in ('worship','worship ministry','creative ministry','creative arts','creative arts ministry','music','music ministry','band','band ministry')
      and (
        lower(coalesce(mm.role_title,'')) ~ '(leader|head|coordinator|director)'
        or exists (
          select 1 from public.worship_schedule_assignments wa
          where wa.schedule_id=wl.schedule_id and wa.member_id=p.member_id and lower(trim(wa.ministry_role))='worship leader'
        )
      )
  )
);
