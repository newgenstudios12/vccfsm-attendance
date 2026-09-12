create or replace function private.get_music_ministry_readonly()
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_result jsonb;
begin
  if not exists (
    select 1
    from public.profiles p
    where p.user_id = (select auth.uid())
      and lower(p.role::text) <> 'guest'
      and (p.member_id is not null or lower(p.role::text) in ('admin','pastor'))
  ) then
    raise exception 'Member access required' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(x.schedule_data order by x.service_date desc), '[]'::jsonb)
  into v_result
  from (
    select
      s.service_date,
      jsonb_build_object(
        'id', s.id,
        'service_date', s.service_date,
        'service_name', s.service_name,
        'notes', s.notes,
        'assignments', coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'id', a.id,
              'ministry_role', a.ministry_role,
              'notes', a.notes,
              'member_name', coalesce(m.display_name, concat_ws(' ', m.first_name, m.last_name), 'Member')
            )
            order by a.ministry_role, coalesce(m.display_name, m.first_name, m.member_code)
          )
          from public.worship_schedule_assignments a
          left join public.members m on m.id = a.member_id
          where a.schedule_id = s.id
        ), '[]'::jsonb),
        'lineup', (
          select jsonb_build_object(
            'id', l.id,
            'status', l.status,
            'revision_note', l.revision_note,
            'offertory_title', l.offertory_title,
            'offertory_artist', l.offertory_artist,
            'offertory_key', l.offertory_key,
            'offertory_reference_url', l.offertory_reference_url,
            'offertory_notes', l.offertory_notes,
            'songs', coalesce((
              select jsonb_agg(
                jsonb_build_object(
                  'position', song.position,
                  'title', song.title,
                  'artist', song.artist,
                  'song_key', song.song_key,
                  'reference_url', song.reference_url,
                  'notes', song.notes
                )
                order by song.position
              )
              from public.worship_lineup_songs song
              where song.lineup_id = l.id
            ), '[]'::jsonb)
          )
          from public.worship_lineups l
          where l.schedule_id = s.id
        )
      ) as schedule_data
    from public.worship_service_schedules s
    order by s.service_date desc
    limit 80
  ) x;

  return coalesce(v_result, '[]'::jsonb);
end;
$function$;

revoke all on function private.get_music_ministry_readonly() from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.get_music_ministry_readonly() to authenticated;

create or replace function public.get_music_ministry_readonly()
returns jsonb
language sql
stable
security invoker
set search_path to ''
as $function$
  select private.get_music_ministry_readonly();
$function$;

revoke all on function public.get_music_ministry_readonly() from public, anon;
grant execute on function public.get_music_ministry_readonly() to authenticated;