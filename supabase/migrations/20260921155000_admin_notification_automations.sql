create table if not exists public.notification_automation_settings (
  automation_key text primary key,
  enabled boolean not null default true,
  send_time time without time zone,
  lead_minutes integer,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint notification_automation_key_check check (
    automation_key = any (array[
      'master','daily_verse','new_sermon','new_event','event_reminder',
      'worship_assignment','worship_reminder','sunday_attendance_reminder','birthday_greeting'
    ])
  ),
  constraint notification_automation_lead_check check (lead_minutes is null or (lead_minutes between 0 and 10080))
);

alter table public.notification_automation_settings enable row level security;
revoke all on public.notification_automation_settings from anon;
grant select, update on public.notification_automation_settings to authenticated;

drop policy if exists "notification automation managers read" on public.notification_automation_settings;
create policy "notification automation managers read"
on public.notification_automation_settings
for select to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.user_id = (select auth.uid())
      and p.role::text in ('admin','pastor')
  )
);

drop policy if exists "notification automation managers update" on public.notification_automation_settings;
create policy "notification automation managers update"
on public.notification_automation_settings
for update to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.user_id = (select auth.uid())
      and p.role::text in ('admin','pastor')
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.user_id = (select auth.uid())
      and p.role::text in ('admin','pastor')
  )
);

insert into public.notification_automation_settings(automation_key,enabled,send_time,lead_minutes)
values
  ('master',true,null,null),
  ('daily_verse',true,time '07:00',null),
  ('new_sermon',true,null,null),
  ('new_event',true,null,null),
  ('event_reminder',true,null,1440),
  ('worship_assignment',true,null,null),
  ('worship_reminder',true,time '08:00',8640),
  ('sunday_attendance_reminder',false,time '11:00',null),
  ('birthday_greeting',false,time '08:00',null)
on conflict (automation_key) do nothing;

create or replace function private.vccf_automation_enabled(p_key text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select coalesce((
    select m.enabled and s.enabled
    from public.notification_automation_settings m
    join public.notification_automation_settings s on s.automation_key = p_key
    where m.automation_key = 'master'
  ), false);
$$;
revoke all on function private.vccf_automation_enabled(text) from public, anon, authenticated;

create or replace function public.vccf_prepare_daily_bible_verse()
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_date date := (now() at time zone 'Asia/Manila')::date;
  v_local_time time := (now() at time zone 'Asia/Manila')::time;
  v_send_time time := time '07:00';
  v record;
  v_push_id uuid;
  v_push_enabled boolean := true;
  v_body text;
begin
  if not private.vccf_automation_enabled('daily_verse') then return null; end if;

  select coalesce(send_time,time '07:00')
  into v_send_time
  from public.notification_automation_settings
  where automation_key='daily_verse';

  if v_local_time < v_send_time then return null; end if;

  select * into v from public.vccf_daily_bible_verse(v_date) limit 1;
  if v.reference is null then return null; end if;

  select coalesce(s.push_enabled,true) into v_push_enabled
  from public.daily_bible_verse_selections s
  where s.verse_date=v_date;
  v_push_enabled := coalesce(v_push_enabled,true);
  if not v_push_enabled then return null; end if;

  select push_notification_id into v_push_id
  from public.daily_bible_verse_push_log
  where verse_date=v_date;
  if v_push_id is not null then return v_push_id; end if;

  if coalesce(v.translation,'KJV') in ('KJV','MBBTAG') then
    v_body := v.reference || ' · Open VCCF Connect to read Today''s Word.';
  else
    v_body := v.verse_text || ' — ' || v.reference || ' (' || v.translation || ')';
  end if;

  insert into public.push_notifications(
    title,body,audience,is_published,push_enabled,recurrence,daily_time,
    publish_at,expires_at,push_url,source_type,source_key
  ) values (
    'Today''s Word · '||v.reference,
    v_body,
    'All',true,true,'once',null,
    now(),((v_date + 1)::timestamp at time zone 'Asia/Manila'),
    '/?daily-verse='||v_date::text,
    'daily_verse',v_date::text
  ) returning id into v_push_id;

  insert into public.daily_bible_verse_push_log(verse_date,verse_reference,push_notification_id)
  values(v_date,v.reference,v_push_id)
  on conflict(verse_date) do update set
    verse_reference=excluded.verse_reference,
    push_notification_id=excluded.push_notification_id;

  return v_push_id;
end;
$$;
revoke all on function public.vccf_prepare_daily_bible_verse() from public, anon, authenticated;

create or replace function private.vccf_sync_event_push_notifications()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_event public.church_events%rowtype;
  v_audience text;
  v_body text;
  v_reminder_body text;
  v_reminder_at timestamptz;
  v_lead_minutes integer := 1440;
  v_new_enabled boolean := false;
  v_reminder_enabled boolean := false;
begin
  if tg_op = 'DELETE' then
    delete from public.push_notifications
    where source_type='church_event'
      and source_id=old.id
      and last_push_at is null;
    return old;
  end if;

  v_event := new;

  if v_event.status <> 'Scheduled' or v_event.start_at is null then
    delete from public.push_notifications
    where source_type='church_event'
      and source_id=v_event.id
      and last_push_at is null;
    return new;
  end if;

  v_new_enabled := private.vccf_automation_enabled('new_event');
  v_reminder_enabled := private.vccf_automation_enabled('event_reminder');

  select coalesce(lead_minutes,1440)
  into v_lead_minutes
  from public.notification_automation_settings
  where automation_key='event_reminder';
  v_lead_minutes := coalesce(v_lead_minutes,1440);

  v_audience := case
    when v_event.area_id is not null then 'Area'
    when v_event.ministry_id is not null then 'Ministry'
    else 'All'
  end;

  v_body := 'Join us on ' || pg_catalog.to_char(v_event.start_at at time zone 'Asia/Manila','Mon DD, YYYY "at" FMHH12:MI AM') ||
    case when coalesce(pg_catalog.btrim(v_event.location),'')<>'' then ' · '||pg_catalog.btrim(v_event.location) else '' end || '.';

  if v_new_enabled then
    if tg_op='INSERT' or (tg_op='UPDATE' and old.status is distinct from 'Scheduled') then
      insert into public.push_notifications(
        title, body, audience, area_id, ministry_id,
        is_published, push_enabled, recurrence, publish_at, expires_at,
        push_url, created_by, source_type, source_id, source_key
      ) values (
        'New event: '||v_event.title,
        v_body,
        v_audience,
        case when v_audience='Area' then v_event.area_id else null end,
        case when v_audience='Ministry' then v_event.ministry_id else null end,
        true, true, 'once', now(), coalesce(v_event.end_at,v_event.start_at+interval '12 hours'),
        '/app', v_event.created_by, 'church_event', v_event.id, 'new_event'
      )
      on conflict (source_type,source_id,source_key) do update set
        title=excluded.title, body=excluded.body, audience=excluded.audience,
        area_id=excluded.area_id, ministry_id=excluded.ministry_id,
        is_published=true, push_enabled=true, publish_at=excluded.publish_at,
        expires_at=excluded.expires_at, push_url=excluded.push_url, updated_at=now();
    else
      update public.push_notifications
      set title='New event: '||v_event.title,
          body=v_body,
          audience=v_audience,
          area_id=case when v_audience='Area' then v_event.area_id else null end,
          ministry_id=case when v_audience='Ministry' then v_event.ministry_id else null end,
          expires_at=coalesce(v_event.end_at,v_event.start_at+interval '12 hours'),
          push_url='/app',
          updated_at=now()
      where source_type='church_event'
        and source_id=v_event.id
        and source_key='new_event'
        and last_push_at is null;
    end if;
  end if;

  if v_reminder_enabled then
    v_reminder_at := v_event.start_at - pg_catalog.make_interval(mins => v_lead_minutes);
    if v_reminder_at <= now() then v_reminder_at := null; end if;
  else
    v_reminder_at := null;
  end if;

  if v_reminder_at is not null then
    v_reminder_body := v_event.title || ' starts on ' ||
      pg_catalog.to_char(v_event.start_at at time zone 'Asia/Manila','Mon DD "at" FMHH12:MI AM') ||
      case when coalesce(pg_catalog.btrim(v_event.location),'')<>'' then ' · '||pg_catalog.btrim(v_event.location) else '' end || '.';

    insert into public.push_notifications(
      title, body, audience, area_id, ministry_id,
      is_published, push_enabled, recurrence, publish_at, expires_at,
      push_url, created_by, source_type, source_id, source_key
    ) values (
      'Upcoming event: '||v_event.title,
      v_reminder_body,
      v_audience,
      case when v_audience='Area' then v_event.area_id else null end,
      case when v_audience='Ministry' then v_event.ministry_id else null end,
      true, true, 'once', v_reminder_at, coalesce(v_event.end_at,v_event.start_at+interval '12 hours'),
      '/app', v_event.created_by, 'church_event', v_event.id, 'upcoming_reminder'
    )
    on conflict (source_type,source_id,source_key) do update set
      title=excluded.title, body=excluded.body, audience=excluded.audience,
      area_id=excluded.area_id, ministry_id=excluded.ministry_id,
      is_published=true, push_enabled=true,
      publish_at=case when public.push_notifications.last_push_at is null then excluded.publish_at else public.push_notifications.publish_at end,
      expires_at=excluded.expires_at, push_url=excluded.push_url, updated_at=now();
  end if;

  return new;
end;
$$;
revoke all on function private.vccf_sync_event_push_notifications() from public, anon, authenticated;

create or replace function private.vccf_sync_sermon_push_notification()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_body text;
begin
  if tg_op = 'DELETE' then
    delete from public.push_notifications
    where source_type='sermon' and source_id=old.id and last_push_at is null;
    return old;
  end if;

  if new.sermon_category is distinct from 'sunday_sermon' then
    delete from public.push_notifications
    where source_type='sermon' and source_id=new.id and last_push_at is null;
    return new;
  end if;

  if not private.vccf_automation_enabled('new_sermon') then return new; end if;

  v_body := coalesce(nullif(pg_catalog.btrim(new.preacher),''),'VCCF Santa Maria') ||
    case when new.sermon_date is not null then ' · '||pg_catalog.to_char(new.sermon_date,'FMMon FMDD, YYYY') else '' end ||
    '. Tap to open Sermons.';

  insert into public.push_notifications(
    title,body,audience,is_published,push_enabled,recurrence,
    publish_at,expires_at,push_url,created_by,source_type,source_id,source_key
  ) values (
    'New preaching: '||new.title,
    v_body,
    'All',true,true,'once',
    now(),now()+interval '30 days',
    '/login?vccf-route=sermons&sermon='||new.id::text,
    new.uploaded_by,
    'sermon',new.id,'new_sermon'
  )
  on conflict (source_type,source_id,source_key) do update set
    title=excluded.title, body=excluded.body, audience=excluded.audience,
    is_published=true, push_enabled=true,
    publish_at=case when public.push_notifications.last_push_at is null then excluded.publish_at else public.push_notifications.publish_at end,
    expires_at=excluded.expires_at, push_url=excluded.push_url,
    created_by=excluded.created_by, updated_at=now()
  where public.push_notifications.last_push_at is null;

  return new;
end;
$$;
revoke all on function private.vccf_sync_sermon_push_notification() from public, anon, authenticated;

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
  v_assignment_enabled boolean := false;
  v_reminder_enabled boolean := false;
  v_reminder_minutes integer := 8640;
  v_reminder_time time := time '08:00';
begin
  select wa.id,wa.member_id,wa.ministry_role,ws.service_date,
         coalesce(nullif(ws.service_name,''),'Sunday Worship Service') as service_name
  into a
  from public.worship_schedule_assignments wa
  join public.worship_service_schedules ws on ws.id=wa.schedule_id
  where wa.id=p_assignment_id;

  if not found then
    delete from public.push_notifications
    where source_type='worship_assignment' and source_id=p_assignment_id;
    return;
  end if;

  delete from public.push_notifications n
  where n.source_type='worship_assignment'
    and n.source_id=p_assignment_id
    and n.target_user_id is not null
    and not exists (
      select 1 from public.profiles px
      where px.member_id=a.member_id and px.user_id=n.target_user_id
    );

  if a.service_date < current_manila_date then
    delete from public.push_notifications
    where source_type='worship_assignment' and source_id=p_assignment_id;
    return;
  end if;

  v_assignment_enabled := private.vccf_automation_enabled('worship_assignment');
  v_reminder_enabled := private.vccf_automation_enabled('worship_reminder');

  select coalesce(lead_minutes,8640),coalesce(send_time,time '08:00')
  into v_reminder_minutes,v_reminder_time
  from public.notification_automation_settings
  where automation_key='worship_reminder';

  service_label := a.service_name;
  service_date_label := pg_catalog.to_char(a.service_date,'FMMonth FMDD, YYYY');
  assigned_body := 'You are assigned as '||coalesce(nullif(a.ministry_role,''),'Minister')||
    ' for '||service_label||' on '||service_date_label||
    '. Open Schedule of Ministers for details.';
  reminder_body := 'You’re serving this Sunday as '||coalesce(nullif(a.ministry_role,''),'Minister')||
    ' for '||service_label||' on '||service_date_label||
    '. Please check the Schedule of Ministers for details.';

  reminder_at := ((a.service_date::timestamp + v_reminder_time) - pg_catalog.make_interval(mins=>v_reminder_minutes)) at time zone 'Asia/Manila';
  reminder_key := 'service_reminder:'||pg_catalog.to_char(a.service_date,'YYYYMMDD');

  for p in
    select px.user_id from public.profiles px where px.member_id=a.member_id
  loop
    if v_assignment_enabled then
      update public.push_notifications
      set title='You’re scheduled to serve this Sunday 🎵',
          body=assigned_body,audience='User',target_user_id=p.user_id,
          push_url='/login#worship-schedule',is_published=true,push_enabled=true,
          recurrence='once',updated_at=now()
      where source_type='worship_assignment'
        and source_id=p_assignment_id
        and source_key='assignment_notice'
        and target_user_id=p.user_id;

      if not found then
        insert into public.push_notifications(
          title,body,audience,target_user_id,is_published,push_enabled,recurrence,
          publish_at,push_url,source_type,source_id,source_key
        ) values (
          'You’re scheduled to serve this Sunday 🎵',assigned_body,'User',p.user_id,true,true,'once',
          now(),'/login#worship-schedule','worship_assignment',p_assignment_id,'assignment_notice'
        );
      end if;
    end if;

    if v_reminder_enabled and reminder_at > now() then
      delete from public.push_notifications
      where source_type='worship_assignment'
        and source_id=p_assignment_id
        and target_user_id=p.user_id
        and last_push_at is null
        and (source_key like 'monday_reminder:%' or source_key like 'service_reminder:%')
        and source_key<>reminder_key;

      update public.push_notifications
      set title='Ministry Reminder 🙏',body=reminder_body,audience='User',
          target_user_id=p.user_id,is_published=true,push_enabled=true,recurrence='once',
          publish_at=reminder_at,push_url='/login#worship-schedule',updated_at=now()
      where source_type='worship_assignment'
        and source_id=p_assignment_id
        and source_key=reminder_key
        and target_user_id=p.user_id
        and last_push_at is null;

      if not found then
        insert into public.push_notifications(
          title,body,audience,target_user_id,is_published,push_enabled,recurrence,
          publish_at,push_url,source_type,source_id,source_key
        ) values (
          'Ministry Reminder 🙏',reminder_body,'User',p.user_id,true,true,'once',
          reminder_at,'/login#worship-schedule','worship_assignment',p_assignment_id,reminder_key
        );
      end if;
    end if;
  end loop;
end;
$$;
revoke all on function private.sync_worship_assignment_notifications(uuid) from public, anon, authenticated;

create or replace function public.vccf_prepare_recurring_notifications()
returns integer
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_date date := (now() at time zone 'Asia/Manila')::date;
  v_local_time time := (now() at time zone 'Asia/Manila')::time;
  v_time time;
  v_count integer := 0;
  r record;
begin
  perform public.vccf_prepare_daily_bible_verse();

  if private.vccf_automation_enabled('birthday_greeting') then
    select coalesce(send_time,time '08:00') into v_time
    from public.notification_automation_settings where automation_key='birthday_greeting';
    if v_local_time >= v_time then
      for r in
        select m.id as member_id,p.user_id,m.display_name,m.first_name
        from public.members m
        join public.profiles p on p.member_id=m.id
        where m.is_active is not false
          and lower(coalesce(m.status,'active'))<>'inactive'
          and m.birth_date is not null
          and extract(month from m.birth_date)=extract(month from v_date)
          and extract(day from m.birth_date)=extract(day from v_date)
      loop
        insert into public.push_notifications(
          title,body,audience,target_user_id,is_published,push_enabled,recurrence,
          publish_at,expires_at,push_url,source_type,source_id,source_key
        ) values (
          'Happy Birthday! 🎉',
          'Happy birthday, '||coalesce(nullif(r.first_name,''),nullif(r.display_name,''),'Kapatid')||
            '! May God bless you and guide you in the year ahead.',
          'User',r.user_id,true,true,'once',now(),
          ((v_date+1)::timestamp at time zone 'Asia/Manila'),
          '/','birthday',r.member_id,'birthday:'||v_date::text
        )
        on conflict (source_type,source_id,source_key) do nothing;
        if found then v_count:=v_count+1; end if;
      end loop;
    end if;
  end if;

  if extract(isodow from v_date)=7 and private.vccf_automation_enabled('sunday_attendance_reminder') then
    select coalesce(send_time,time '11:00') into v_time
    from public.notification_automation_settings where automation_key='sunday_attendance_reminder';
    if v_local_time >= v_time then
      for r in
        select p.user_id,p.area_id,a.name as area_name
        from public.profiles p
        join public.areas a on a.id=p.area_id
        where p.role::text='area_leader'
          and p.area_id is not null
          and not exists (
            select 1 from public.sunday_attendance_submissions s
            where s.sunday_date=v_date
              and s.area_id=p.area_id
              and s.status='submitted'
          )
      loop
        insert into public.push_notifications(
          title,body,audience,target_user_id,is_published,push_enabled,recurrence,
          publish_at,expires_at,push_url,source_type,source_id,source_key
        ) values (
          'Sunday attendance is still open',
          coalesce(r.area_name,'Your area')||' attendance has not been submitted yet. Please review the checklist and submit when you are done.',
          'User',r.user_id,true,true,'once',now(),
          ((v_date+1)::timestamp at time zone 'Asia/Manila'),
          '/login?vccf-route=attendance','sunday_attendance',r.user_id,'submission_reminder:'||v_date::text
        )
        on conflict (source_type,source_id,source_key) do nothing;
        if found then v_count:=v_count+1; end if;
      end loop;
    end if;
  end if;

  return v_count;
end;
$$;
revoke all on function public.vccf_prepare_recurring_notifications() from public, anon, authenticated;

create or replace function private.vccf_notification_automation_setting_changed()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  aid uuid;
begin
  if new.automation_key='event_reminder'
     and (new.enabled is distinct from old.enabled or new.lead_minutes is distinct from old.lead_minutes) then
    update public.church_events
    set updated_at=now()
    where status='Scheduled' and start_at>now();
  elsif new.automation_key in ('worship_assignment','worship_reminder')
     and (new.enabled is distinct from old.enabled
          or new.lead_minutes is distinct from old.lead_minutes
          or new.send_time is distinct from old.send_time) then
    for aid in
      select wa.id
      from public.worship_schedule_assignments wa
      join public.worship_service_schedules ws on ws.id=wa.schedule_id
      where ws.service_date >= (now() at time zone 'Asia/Manila')::date
    loop
      perform private.sync_worship_assignment_notifications(aid);
    end loop;
  end if;
  return new;
end;
$$;
revoke all on function private.vccf_notification_automation_setting_changed() from public, anon, authenticated;

drop trigger if exists notification_automation_setting_changed on public.notification_automation_settings;
create trigger notification_automation_setting_changed
after update on public.notification_automation_settings
for each row execute function private.vccf_notification_automation_setting_changed();

select cron.unschedule(jobid) from cron.job where jobname='vccf-daily-bible-verse';
select cron.unschedule(jobid) from cron.job where jobname='vccf-notification-automation-prep';
select cron.schedule(
  'vccf-notification-automation-prep',
  '*/5 * * * *',
  'select public.vccf_prepare_recurring_notifications();'
);
