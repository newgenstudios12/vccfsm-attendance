alter table public.vccf_notifications
  add column if not exists action_url text,
  add column if not exists source_type text,
  add column if not exists source_id uuid,
  add column if not exists source_key text;

create index if not exists vccf_notifications_user_created_idx
  on public.vccf_notifications (user_id, created_at desc);

create index if not exists vccf_notifications_source_idx
  on public.vccf_notifications (source_type, source_id)
  where source_type is not null and source_id is not null;

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
    where source_type = 'sermon'
      and source_id = old.id
      and last_push_at is null;
    return old;
  end if;

  if new.sermon_category is distinct from 'sunday_sermon' then
    delete from public.push_notifications
    where source_type = 'sermon'
      and source_id = new.id
      and last_push_at is null;
    return new;
  end if;

  v_body := coalesce(nullif(pg_catalog.btrim(new.preacher), ''), 'VCCF Santa Maria') ||
    case
      when new.sermon_date is not null then ' · ' || pg_catalog.to_char(new.sermon_date, 'FMMon FMDD, YYYY')
      else ''
    end || '. Tap to open Sermons.';

  insert into public.push_notifications (
    title, body, audience, is_published, push_enabled, recurrence,
    publish_at, expires_at, push_url, created_by,
    source_type, source_id, source_key
  ) values (
    'New preaching: ' || new.title,
    v_body,
    'All', true, true, 'once',
    now(), now() + interval '30 days',
    '/login?vccf-route=sermons&sermon=' || new.id::text,
    new.uploaded_by,
    'sermon', new.id, 'new_sermon'
  )
  on conflict (source_type, source_id, source_key) do update set
    title = excluded.title,
    body = excluded.body,
    audience = excluded.audience,
    is_published = true,
    push_enabled = true,
    publish_at = case
      when public.push_notifications.last_push_at is null then excluded.publish_at
      else public.push_notifications.publish_at
    end,
    expires_at = excluded.expires_at,
    push_url = excluded.push_url,
    created_by = excluded.created_by,
    updated_at = now()
  where public.push_notifications.last_push_at is null;

  return new;
end;
$$;

revoke all on function private.vccf_sync_sermon_push_notification() from public, anon, authenticated;

drop trigger if exists vccf_sermon_push_notification on public.vccf_sermons;
create trigger vccf_sermon_push_notification
after insert or update or delete on public.vccf_sermons
for each row execute function private.vccf_sync_sermon_push_notification();
