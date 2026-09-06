alter table public.push_notifications
  add column if not exists source_type text,
  add column if not exists source_id uuid,
  add column if not exists source_key text;

create unique index if not exists push_notifications_source_unique_idx
  on public.push_notifications(source_type, source_id, source_key);

create or replace function private.vccf_sync_event_push_notifications()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event public.church_events%rowtype;
  v_audience text;
  v_body text;
  v_reminder_body text;
  v_reminder_at timestamptz;
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

  v_audience := case
    when v_event.area_id is not null then 'Area'
    when v_event.ministry_id is not null then 'Ministry'
    else 'All'
  end;

  v_body := 'Join us on ' || to_char(v_event.start_at at time zone 'Asia/Manila','Mon DD, YYYY "at" FMHH12:MI AM') ||
    case when coalesce(trim(v_event.location),'')<>'' then ' · '||trim(v_event.location) else '' end || '.';

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
      title=excluded.title,
      body=excluded.body,
      audience=excluded.audience,
      area_id=excluded.area_id,
      ministry_id=excluded.ministry_id,
      is_published=true,
      push_enabled=true,
      publish_at=excluded.publish_at,
      expires_at=excluded.expires_at,
      push_url=excluded.push_url,
      updated_at=now();
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

  if v_event.start_at - interval '1 day' > now() then
    v_reminder_at := v_event.start_at - interval '1 day';
  elsif v_event.start_at - interval '2 hours' > now() then
    v_reminder_at := v_event.start_at - interval '2 hours';
  else
    v_reminder_at := null;
  end if;

  if v_reminder_at is null then
    delete from public.push_notifications
    where source_type='church_event'
      and source_id=v_event.id
      and source_key='upcoming_reminder'
      and last_push_at is null;
  else
    v_reminder_body := v_event.title || ' starts ' ||
      case
        when v_reminder_at = v_event.start_at - interval '1 day' then 'tomorrow'
        else 'in about 2 hours'
      end ||
      ' at ' || to_char(v_event.start_at at time zone 'Asia/Manila','FMHH12:MI AM') ||
      case when coalesce(trim(v_event.location),'')<>'' then ' · '||trim(v_event.location) else '' end || '.';

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
      title=excluded.title,
      body=excluded.body,
      audience=excluded.audience,
      area_id=excluded.area_id,
      ministry_id=excluded.ministry_id,
      is_published=true,
      push_enabled=true,
      publish_at=case when public.push_notifications.last_push_at is null then excluded.publish_at else public.push_notifications.publish_at end,
      expires_at=excluded.expires_at,
      push_url=excluded.push_url,
      updated_at=now();
  end if;

  return new;
end;
$$;

revoke all on function private.vccf_sync_event_push_notifications() from public, anon, authenticated;

drop trigger if exists vccf_event_push_notifications on public.church_events;
create trigger vccf_event_push_notifications
after insert or update or delete on public.church_events
for each row execute function private.vccf_sync_event_push_notifications();

insert into public.push_notifications(
  title, body, audience, area_id, ministry_id,
  is_published, push_enabled, recurrence, publish_at, expires_at,
  push_url, created_by, source_type, source_id, source_key
)
select
  'Upcoming event: '||e.title,
  e.title || ' starts ' ||
    case when e.start_at - interval '1 day' > now() then 'tomorrow' else 'in about 2 hours' end ||
    ' at ' || to_char(e.start_at at time zone 'Asia/Manila','FMHH12:MI AM') ||
    case when coalesce(trim(e.location),'')<>'' then ' · '||trim(e.location) else '' end || '.',
  case when e.area_id is not null then 'Area' when e.ministry_id is not null then 'Ministry' else 'All' end,
  case when e.area_id is not null then e.area_id else null end,
  case when e.area_id is null and e.ministry_id is not null then e.ministry_id else null end,
  true, true, 'once',
  case when e.start_at - interval '1 day' > now() then e.start_at - interval '1 day' else e.start_at - interval '2 hours' end,
  coalesce(e.end_at,e.start_at+interval '12 hours'),
  '/app', e.created_by, 'church_event', e.id, 'upcoming_reminder'
from public.church_events e
where e.status='Scheduled'
  and e.start_at - interval '2 hours' > now()
on conflict (source_type,source_id,source_key) do nothing;
