-- Automatically dispatch a private push notification after each chat message.
-- Push delivery failures are intentionally non-blocking so message inserts still succeed.

create or replace function private.vccf_dispatch_chat_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cron_secret text;
begin
  select cron_secret into v_cron_secret
  from public.vccf_push_private_config()
  limit 1;

  if coalesce(v_cron_secret, '') = '' then
    raise warning 'VCCF chat push skipped: push cron secret is unavailable';
    return null;
  end if;

  perform net.http_post(
    url := 'https://hvnlstaecjqhjtiojutd.supabase.co/functions/v1/vccf-notification-dispatch',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-vccf-cron-secret', v_cron_secret
    ),
    body := jsonb_build_object(
      'mode', 'chat',
      'message_id', new.id::text
    )
  );

  return null;
exception when others then
  raise warning 'VCCF chat push dispatch failed for message %: %', new.id, sqlerrm;
  return null;
end;
$$;

drop trigger if exists vccf_chat_message_push on public.messages;
create trigger vccf_chat_message_push
after insert on public.messages
for each row execute function private.vccf_dispatch_chat_push();
