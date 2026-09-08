alter table public.push_notifications
  add column if not exists target_user_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.push_notifications'::regclass
      and conname = 'push_notifications_target_user_id_fkey'
  ) then
    alter table public.push_notifications
      add constraint push_notifications_target_user_id_fkey
      foreign key (target_user_id) references auth.users(id) on delete cascade;
  end if;
end $$;

alter table public.push_notifications
  drop constraint if exists push_notifications_audience_check;

alter table public.push_notifications
  add constraint push_notifications_audience_check
  check (audience = any (array['All'::text,'Leaders'::text,'Area'::text,'Ministry'::text,'User'::text]));

create unique index if not exists push_notifications_source_target_unique
  on public.push_notifications (source_type, source_id, source_key, target_user_id)
  where source_type is not null
    and source_id is not null
    and source_key is not null
    and target_user_id is not null;

drop policy if exists push_notifications_read on public.push_notifications;
create policy push_notifications_read
on public.push_notifications
for select
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.user_id = (select auth.uid())
      and p.role::text = any (array['admin'::text,'pastor'::text])
  )
  or (
    is_published
    and push_enabled
    and publish_at <= now()
    and (expires_at is null or expires_at > now())
    and (
      audience = 'All'
      or (
        audience = 'Leaders'
        and exists (
          select 1 from public.profiles p
          where p.user_id = (select auth.uid())
            and p.role::text = any (array['admin'::text,'pastor'::text,'area_leader'::text,'ministry_leader'::text])
        )
      )
      or (
        audience = 'Area'
        and area_id = (
          select p.area_id from public.profiles p
          where p.user_id = (select auth.uid())
        )
      )
      or (
        audience = 'Ministry'
        and (
          exists (
            select 1
            from public.profiles p
            join public.member_ministries mm on mm.member_id = p.member_id
            where p.user_id = (select auth.uid())
              and mm.ministry_id = push_notifications.ministry_id
          )
          or exists (
            select 1
            from public.profiles p
            join public.church_leadership l on l.member_id = p.member_id and l.is_active
            where p.user_id = (select auth.uid())
              and l.ministry_id = push_notifications.ministry_id
          )
        )
      )
      or (
        audience = 'User'
        and target_user_id = (select auth.uid())
      )
    )
  )
);

create or replace function private.sync_worship_assignment_notifications(p_assignment_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  a record;
  p record;
  service_label text;
  service_date_label text;
  assigned_body text;
  reminder_body text;
  reminder_at timestamptz;
  reminder_key text;
  current_manila_date date := (now() at time zone 'Asia/Manila')::date;
begin
  select
    wa.id,
    wa.member_id,
    wa.ministry_role,
    ws.service_date,
    coalesce(nullif(ws.service_name,''),'Sunday Worship Service') as service_name
  into a
  from public.worship_schedule_assignments wa
  join public.worship_service_schedules ws on ws.id = wa.schedule_id
  where wa.id = p_assignment_id;

  if not found then
    delete from public.push_notifications
    where source_type = 'worship_assignment'
      and source_id = p_assignment_id;
    return;
  end if;

  delete from public.push_notifications n
  where n.source_type = 'worship_assignment'
    and n.source_id = p_assignment_id
    and n.target_user_id is not null
    and not exists (
      select 1 from public.profiles px
      where px.member_id = a.member_id
        and px.user_id = n.target_user_id
    );

  if a.service_date < current_manila_date then
    delete from public.push_notifications
    where source_type = 'worship_assignment'
      and source_id = p_assignment_id;
    return;
  end if;

  service_label := a.service_name;
  service_date_label := to_char(a.service_date, 'FMMonth FMDD, YYYY');
  assigned_body := 'You are assigned as ' || coalesce(nullif(a.ministry_role,''),'Minister') ||
    ' for ' || service_label || ' on ' || service_date_label ||
    '. Open Schedule of Ministers for details.';
  reminder_body := 'You’re serving this Sunday as ' || coalesce(nullif(a.ministry_role,''),'Minister') ||
    ' for ' || service_label || ' on ' || service_date_label ||
    '. Please check the Schedule of Ministers for details.';
  reminder_at := ((a.service_date - 6)::timestamp + time '08:00') at time zone 'Asia/Manila';
  reminder_key := 'monday_reminder:' || to_char(a.service_date,'YYYYMMDD');

  for p in
    select px.user_id
    from public.profiles px
    where px.member_id = a.member_id
  loop
    update public.push_notifications
    set title = 'You’re scheduled to serve this Sunday 🎵',
        body = assigned_body,
        audience = 'User',
        target_user_id = p.user_id,
        push_url = '/login#worship-schedule',
        is_published = true,
        push_enabled = true,
        recurrence = 'once',
        updated_at = now()
    where source_type = 'worship_assignment'
      and source_id = p_assignment_id
      and source_key = 'assignment_notice'
      and target_user_id = p.user_id;

    if not found then
      insert into public.push_notifications (
        title,body,audience,target_user_id,is_published,push_enabled,recurrence,
        publish_at,push_url,source_type,source_id,source_key
      ) values (
        'You’re scheduled to serve this Sunday 🎵',assigned_body,'User',p.user_id,true,true,'once',
        now(),'/login#worship-schedule','worship_assignment',p_assignment_id,'assignment_notice'
      );
    end if;

    delete from public.push_notifications
    where source_type = 'worship_assignment'
      and source_id = p_assignment_id
      and target_user_id = p.user_id
      and source_key like 'monday_reminder:%'
      and source_key <> reminder_key;

    if reminder_at > now() then
      update public.push_notifications
      set title = 'Ministry Reminder 🙏',
          body = reminder_body,
          audience = 'User',
          target_user_id = p.user_id,
          is_published = true,
          push_enabled = true,
          recurrence = 'once',
          publish_at = reminder_at,
          push_url = '/login#worship-schedule',
          updated_at = now()
      where source_type = 'worship_assignment'
        and source_id = p_assignment_id
        and source_key = reminder_key
        and target_user_id = p.user_id;

      if not found then
        insert into public.push_notifications (
          title,body,audience,target_user_id,is_published,push_enabled,recurrence,
          publish_at,push_url,source_type,source_id,source_key
        ) values (
          'Ministry Reminder 🙏',reminder_body,'User',p.user_id,true,true,'once',
          reminder_at,'/login#worship-schedule','worship_assignment',p_assignment_id,reminder_key
        );
      end if;
    else
      delete from public.push_notifications
      where source_type = 'worship_assignment'
        and source_id = p_assignment_id
        and target_user_id = p.user_id
        and source_key like 'monday_reminder:%';
    end if;
  end loop;
end;
$$;

revoke all on function private.sync_worship_assignment_notifications(uuid) from public, anon, authenticated;

create or replace function private.worship_assignment_notifications_trigger()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.push_notifications
    where source_type = 'worship_assignment'
      and source_id = old.id;
    return old;
  end if;

  if tg_op = 'UPDATE' and old.member_id is distinct from new.member_id then
    delete from public.push_notifications
    where source_type = 'worship_assignment'
      and source_id = old.id;
  end if;

  perform private.sync_worship_assignment_notifications(new.id);
  return new;
end;
$$;

revoke all on function private.worship_assignment_notifications_trigger() from public, anon, authenticated;

drop trigger if exists worship_assignment_notifications on public.worship_schedule_assignments;
create trigger worship_assignment_notifications
after insert or update or delete on public.worship_schedule_assignments
for each row execute function private.worship_assignment_notifications_trigger();

create or replace function private.worship_schedule_notifications_trigger()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  aid uuid;
begin
  if new.service_date is distinct from old.service_date
     or new.service_name is distinct from old.service_name then
    for aid in
      select id from public.worship_schedule_assignments where schedule_id = new.id
    loop
      perform private.sync_worship_assignment_notifications(aid);
    end loop;
  end if;
  return new;
end;
$$;

revoke all on function private.worship_schedule_notifications_trigger() from public, anon, authenticated;

drop trigger if exists worship_schedule_notifications on public.worship_service_schedules;
create trigger worship_schedule_notifications
after update of service_date, service_name on public.worship_service_schedules
for each row execute function private.worship_schedule_notifications_trigger();
