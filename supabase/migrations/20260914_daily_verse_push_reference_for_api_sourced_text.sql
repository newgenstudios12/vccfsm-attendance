create or replace function public.vccf_prepare_daily_bible_verse()
returns uuid
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_date date := (now() at time zone 'Asia/Manila')::date;
  v record;
  v_push_id uuid;
  v_push_enabled boolean := true;
  v_body text;
begin
  select * into v from public.vccf_daily_bible_verse(v_date) limit 1;
  if v.reference is null then return null; end if;

  select coalesce(s.push_enabled,true) into v_push_enabled
  from public.daily_bible_verse_selections s
  where s.verse_date=v_date;
  v_push_enabled := coalesce(v_push_enabled,true);

  insert into public.daily_bible_verse_push_log(verse_date,verse_reference)
  values(v_date,v.reference)
  on conflict(verse_date) do nothing;

  if not found then
    select push_notification_id into v_push_id
    from public.daily_bible_verse_push_log where verse_date=v_date;
    if v_push_id is not null then return v_push_id; end if;
  end if;

  if not v_push_enabled then return null; end if;

  -- MBB is delivered live through the authorized API. Do not duplicate API-sourced
  -- copyrighted text into the push payload. The reference opens the in-app verse.
  if coalesce(v.translation,'KJV') in ('KJV','MBBTAG') then
    v_body := v.reference || ' · Open VCCF Connect to read Today''s Word.';
  else
    v_body := v.verse_text || ' — ' || v.reference || ' (' || v.translation || ')';
  end if;

  insert into public.push_notifications(
    title,body,audience,is_published,push_enabled,recurrence,daily_time,publish_at,expires_at,push_url
  ) values (
    'Today''s Word · '||v.reference,
    v_body,
    'All',true,true,'once',null,now(),((v_date + 1)::timestamp at time zone 'Asia/Manila'),
    '/?daily-verse='||v_date::text
  ) returning id into v_push_id;

  update public.daily_bible_verse_push_log
  set push_notification_id=v_push_id, verse_reference=v.reference
  where verse_date=v_date;

  return v_push_id;
end;
$function$;
