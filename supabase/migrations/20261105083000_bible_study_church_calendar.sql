-- Unified Church Calendar: scheduled area Bible Studies + session attendance.
create table if not exists public.bible_study_sessions (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Bible Study',
  area_id uuid not null references public.areas(id) on delete restrict,
  start_at timestamptz not null,
  end_at timestamptz,
  location text not null,
  barangay text not null default '',
  status text not null default 'scheduled' check (status in ('scheduled','completed','cancelled')),
  reminder_enabled boolean not null default true,
  recurrence_group_id uuid,
  summary_notes text,
  summary_id uuid references public.cms_service_summaries(id) on delete set null,
  attendance_submitted_at timestamptz,
  attendance_submitted_by uuid references auth.users(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bible_study_sessions_title_not_blank check (length(btrim(title)) between 1 and 160),
  constraint bible_study_sessions_location_not_blank check (length(btrim(location)) between 1 and 320),
  constraint bible_study_sessions_time_order check (end_at is null or end_at > start_at)
);
create index if not exists bible_study_sessions_start_idx on public.bible_study_sessions(start_at);
create index if not exists bible_study_sessions_area_start_idx on public.bible_study_sessions(area_id,start_at);
create table if not exists public.bible_study_session_attendance (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.bible_study_sessions(id) on delete restrict,
  member_id uuid not null references public.members(id) on delete cascade,
  checked_in_at timestamptz not null default now(),
  source text not null default 'manual' check (source in ('manual','qr')),
  recorded_by uuid not null references auth.users(id) on delete restrict,
  unique(session_id,member_id)
);
create index if not exists bible_study_session_attendance_member_idx
  on public.bible_study_session_attendance(member_id,checked_in_at desc);
alter table public.bible_study_sessions enable row level security;
alter table public.bible_study_session_attendance enable row level security;

create policy "bible study sessions authenticated read"
  on public.bible_study_sessions for select to authenticated using (true);
create policy "bible study sessions staff insert"
  on public.bible_study_sessions for insert to authenticated with check (
    created_by=(select auth.uid()) and exists(
      select 1 from public.profiles p where p.user_id=(select auth.uid())
      and (p.role::text in ('admin','pastor') or (p.role::text='area_leader' and p.area_id=bible_study_sessions.area_id))
    )
  );
create policy "bible study sessions staff update"
  on public.bible_study_sessions for update to authenticated using (
    exists(select 1 from public.profiles p where p.user_id=(select auth.uid())
      and (p.role::text in ('admin','pastor') or (p.role::text='area_leader' and p.area_id=bible_study_sessions.area_id)))
  ) with check (
    exists(select 1 from public.profiles p where p.user_id=(select auth.uid())
      and (p.role::text in ('admin','pastor') or (p.role::text='area_leader' and p.area_id=bible_study_sessions.area_id)))
  );
create policy "bible study sessions admin delete"
  on public.bible_study_sessions for delete to authenticated using (
    exists(select 1 from public.profiles p where p.user_id=(select auth.uid()) and p.role::text='admin')
  );

create policy "bible study attendance authorized read"
  on public.bible_study_session_attendance for select to authenticated using (
    exists(select 1 from public.profiles p where p.user_id=(select auth.uid())
      and (p.member_id=bible_study_session_attendance.member_id
        or p.role::text in ('admin','pastor')
        or (p.role::text='area_leader' and exists(
          select 1 from public.bible_study_sessions s
          where s.id=bible_study_session_attendance.session_id and s.area_id=p.area_id))))
  );
create policy "bible study attendance leaders insert"
  on public.bible_study_session_attendance for insert to authenticated with check (
    recorded_by=(select auth.uid()) and exists(
      select 1 from public.bible_study_sessions s
      join public.profiles p on p.user_id=(select auth.uid())
      where s.id=bible_study_session_attendance.session_id
        and s.status='scheduled'
        and (p.role::text in ('admin','pastor') or (p.role::text='area_leader' and p.area_id=s.area_id))
    )
  );
create policy "bible study attendance leaders delete"
  on public.bible_study_session_attendance for delete to authenticated using (
    exists(
      select 1 from public.bible_study_sessions s
      join public.profiles p on p.user_id=(select auth.uid())
      where s.id=bible_study_session_attendance.session_id
        and s.status='scheduled'
        and (p.role::text in ('admin','pastor') or (p.role::text='area_leader' and p.area_id=s.area_id))
    )
  );

create or replace function private.vccf_guard_bible_study_session()
returns trigger language plpgsql security invoker set search_path=pg_catalog as $$
begin
  if tg_op='UPDATE' then
    if new.created_by is distinct from old.created_by or new.created_at is distinct from old.created_at then
      raise exception 'Bible Study creator cannot be changed';
    end if;
    if new.area_id is distinct from old.area_id and old.attendance_submitted_at is not null then
      raise exception 'Reopen attendance before changing the study area';
    end if;
  end if;
  new.updated_at:=now();
  return new;
end $$;
create trigger vccf_guard_bible_study_session
  before update on public.bible_study_sessions
  for each row execute function private.vccf_guard_bible_study_session();

-- Each recipient gets an individual push notification. The existing minute-by-minute
-- vccf-notification-dispatch job sends push + inbox notifications when publish_at is due.
create or replace function private.vccf_sync_bible_study_reminders()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare v_leader record;
begin
  delete from public.push_notifications
  where source_type='bible_study_session' and source_id=new.id
    and source_key like 'attendance:%' and last_push_at is null;

  if new.reminder_enabled and new.status='scheduled'
    and new.start_at>now()-interval '2 minutes' then
    for v_leader in
      select p.user_id from public.profiles p
      where p.role::text='area_leader' and p.area_id=new.area_id
    loop
      insert into public.push_notifications (
        title,body,audience,target_user_id,area_id,
        is_published,push_enabled,recurrence,publish_at,expires_at,
        push_url,created_by,source_type,source_id,source_key
      ) values (
        'Bible Study attendance reminder',
        'Your area Bible Study ('||new.title||') starts now at '
           ||pg_catalog.to_char(new.start_at at time zone 'Asia/Manila','FMHH12:MI AM')
           ||'. Please open Church Calendar and record attendance. '
           ||new.location,
        'User',v_leader.user_id,new.area_id,
        true,true,'once',new.start_at,new.start_at+interval '6 hours',
        '/app?view=churchcalendar&study='||new.id::text,
        new.created_by,'bible_study_session',new.id,'attendance:'||v_leader.user_id::text
      )
      on conflict (source_type,source_id,source_key) do update
      set title=excluded.title,body=excluded.body,area_id=excluded.area_id,
          publish_at=excluded.publish_at,expires_at=excluded.expires_at,
          push_url=excluded.push_url,push_enabled=true,is_published=true,
          updated_at=now()
      where public.push_notifications.last_push_at is null;
    end loop;
  end if;
  return new;
end $$;
revoke all on function private.vccf_sync_bible_study_reminders() from public,anon,authenticated;
create trigger vccf_bible_study_reminders
  after insert or update of title,location,area_id,start_at,status,reminder_enabled
  on public.bible_study_sessions
  for each row execute function private.vccf_sync_bible_study_reminders();

-- One controlled action finalizes the checklist and links a draft to the existing
-- Bible Study Summary / Giving workflow where that date + area + barangay is available.
create or replace function public.vccf_submit_bible_study_session(p_session_id uuid,p_notes text default '')
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare
  v public.bible_study_sessions%rowtype;
  v_uid uuid := (select auth.uid());
  v_count integer;
  v_summary_id uuid;
  v_summary_status text;
  v_linked boolean := false;
begin
  select * into v from public.bible_study_sessions
  where id=p_session_id for update;
  if not found then raise exception 'Bible Study not found or not accessible'; end if;
  if not exists (select 1 from public.profiles p where p.user_id=v_uid
       and (p.role::text in ('admin','pastor') or (p.role::text='area_leader' and p.area_id=v.area_id))) then
    raise exception 'Not permitted to submit attendance' using errcode='42501';
  end if;
  if v.status='cancelled' then raise exception 'Cannot submit a cancelled Bible Study'; end if;
  select count(*)::integer into v_count from public.bible_study_session_attendance
  where session_id=p_session_id;
  update public.bible_study_sessions
    set status='completed',summary_notes=nullif(btrim(coalesce(p_notes,'')),''),
        attendance_submitted_at=now(),attendance_submitted_by=v_uid
    where id=p_session_id;
  if btrim(v.barangay)<>'' then
    select s.id,s.workflow_status into v_summary_id,v_summary_status
    from public.cms_service_summaries s
    where s.summary_type='Bible Study'
       and s.summary_date=(v.start_at at time zone 'Asia/Manila')::date
       and s.area_id=v.area_id
       and lower(coalesce(s.barangay,''))=lower(v.barangay)
    limit 1;
    if v_summary_id is null then
      insert into public.cms_service_summaries
        (summary_type,title,summary_date,area_id,barangay,
         attendance_count,member_count,notes,workflow_status,created_by)
      values ('Bible Study',v.title,(v.start_at at time zone 'Asia/Manila')::date,
              v.area_id,v.barangay,v_count,0,nullif(btrim(coalesce(p_notes,'')),''),'draft',v_uid)
      returning id into v_summary_id;
      v_linked:=true;
    elsif not exists (
       select 1 from public.bible_study_sessions other
       where other.id<>p_session_id and other.summary_id=v_summary_id
    ) then
       if v_summary_status='draft' then
         update public.cms_service_summaries
           set attendance_count=v_count,
               notes=coalesce(nullif(btrim(coalesce(p_notes,'')),''),notes),
               updated_at=now()
           where id=v_summary_id;
       end if;
       v_linked:=true;
    end if;
    if v_linked then
      update public.bible_study_sessions set summary_id=v_summary_id where id=p_session_id;
    end if;
  end if;
  return jsonb_build_object('session_id',p_session_id,'present_count',v_count,
     'summary_id',case when v_linked then v_summary_id else null end,
     'summary_linked',v_linked);
end $$;
revoke all on function public.vccf_submit_bible_study_session(uuid,text) from public,anon;
grant execute on function public.vccf_submit_bible_study_session(uuid,text) to authenticated;

grant select,insert,update,delete on public.bible_study_sessions to authenticated;
grant select,insert,delete on public.bible_study_session_attendance to authenticated;
