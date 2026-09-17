-- Delete a Bible Study summary without leaving draft finance rows behind.
-- Submitted or approved giving remains protected and blocks the deletion.

create or replace function public.delete_bible_study_summary(p_summary_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_role text;
  v_summary_type text;
  v_batch_id uuid;
  v_batch_status text;
  v_storage_paths text[] := array[]::text[];
  v_deleted_giving_records bigint := 0;
begin
  if p_summary_id is null then
    raise exception 'A Bible Study summary is required' using errcode = '22004';
  end if;

  select p.role::text
  into v_role
  from public.profiles p
  where p.user_id = (select auth.uid());

  if coalesce(v_role, '') <> 'admin' then
    raise exception 'Only administrators can delete Bible Study summaries'
      using errcode = '42501';
  end if;

  select s.summary_type
  into v_summary_type
  from public.cms_service_summaries s
  where s.id = p_summary_id
  for update;

  if not found or v_summary_type <> 'Bible Study' then
    raise exception 'Bible Study summary not found' using errcode = 'P0002';
  end if;

  select b.id, b.workflow_status
  into v_batch_id, v_batch_status
  from public.bible_study_giving_batches b
  where b.service_summary_id = p_summary_id
  for update;

  if v_batch_id is not null and v_batch_status <> 'draft' then
    raise exception 'This summary has submitted or approved giving records and cannot be deleted'
      using errcode = '55000';
  end if;

  select coalesce(
    array_agg(p.storage_path order by p.created_at)
      filter (where nullif(btrim(p.storage_path), '') is not null),
    array[]::text[]
  )
  into v_storage_paths
  from public.cms_service_summary_photos p
  where p.summary_id = p_summary_id;

  if v_batch_id is not null then
    delete from public.giving_records
    where bible_study_batch_id = v_batch_id;
    get diagnostics v_deleted_giving_records = row_count;

    delete from public.bible_study_giving_batches
    where id = v_batch_id;
  end if;

  delete from public.cms_service_summary_photos
  where summary_id = p_summary_id;

  delete from public.cms_service_summaries
  where id = p_summary_id
    and summary_type = 'Bible Study';

  if not found then
    raise exception 'Bible Study summary could not be deleted' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'summary_id', p_summary_id,
    'storage_paths', v_storage_paths,
    'deleted_giving_records', v_deleted_giving_records
  );
end;
$function$;

revoke all on function public.delete_bible_study_summary(uuid) from public, anon, authenticated;
grant execute on function public.delete_bible_study_summary(uuid) to authenticated;

-- The summary row is gone before the client removes its Storage objects.
-- Keep the existing Pastor/Area Leader rule and let Admins clean up those
-- now-orphaned service-summary paths through the Storage API.
drop policy if exists "service_summary_gallery_delete" on storage.objects;
create policy "service_summary_gallery_delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'vccf-gallery'
  and (storage.foldername(objects.name))[1] = 'service-summary'
  and (
    exists (
      select 1
      from public.profiles p
      where p.user_id = (select auth.uid())
        and p.role::text = 'admin'
    )
    or exists (
      select 1
      from public.cms_service_summaries s
      join public.profiles p on p.user_id = (select auth.uid())
      where s.id::text = (storage.foldername(objects.name))[2]
        and s.summary_type = 'Bible Study'
        and (
          p.role::text = 'pastor'
          or (p.role::text = 'area_leader' and s.area_id = p.area_id)
        )
    )
  )
);
