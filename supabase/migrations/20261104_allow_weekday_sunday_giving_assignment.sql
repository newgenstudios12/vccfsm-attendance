-- Allow contributions received on weekdays to be assigned to a draft Sunday giving batch.
-- Keep the actual given_on date, preserve approval locks and Bible Study date matching,
-- and continue to prohibit linking the same record to both Sunday and Bible Study batches.

create or replace function public.guard_giving_record_batch()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_sunday public.sunday_giving_batches%rowtype;
  v_old_sunday public.sunday_giving_batches%rowtype;
  v_bible public.bible_study_giving_batches%rowtype;
  v_old_bible public.bible_study_giving_batches%rowtype;
  v_summary public.cms_service_summaries%rowtype;
begin
  if tg_op='DELETE' then
    if old.sunday_batch_id is not null then
      select * into v_old_sunday from public.sunday_giving_batches where id=old.sunday_batch_id;
      if found and v_old_sunday.workflow_status <> 'draft' then
        raise exception 'Giving records in a submitted or approved Sunday batch are locked';
      end if;
    end if;
    if old.bible_study_batch_id is not null then
      select * into v_old_bible from public.bible_study_giving_batches where id=old.bible_study_batch_id;
      if found and v_old_bible.workflow_status <> 'draft' then
        raise exception 'Giving records in a submitted or approved Bible Study batch are locked';
      end if;
    end if;
    return old;
  end if;

  if tg_op='UPDATE' then
    if old.sunday_batch_id is not null then
      select * into v_old_sunday from public.sunday_giving_batches where id=old.sunday_batch_id;
      if found and v_old_sunday.workflow_status <> 'draft' then
        raise exception 'Giving records in a submitted or approved Sunday batch are locked';
      end if;
    end if;
    if old.bible_study_batch_id is not null then
      select * into v_old_bible from public.bible_study_giving_batches where id=old.bible_study_batch_id;
      if found and v_old_bible.workflow_status <> 'draft' then
        raise exception 'Giving records in a submitted or approved Bible Study batch are locked';
      end if;
    end if;
  end if;

  if num_nonnulls(new.sunday_batch_id,new.bible_study_batch_id) > 1 then
    raise exception 'A giving record can belong to only one giving batch';
  end if;

  if new.sunday_batch_id is not null then
    select * into v_sunday from public.sunday_giving_batches where id=new.sunday_batch_id;
    if not found then raise exception 'Sunday giving batch not found'; end if;
    if v_sunday.workflow_status <> 'draft' then raise exception 'Only draft Sunday giving can be edited'; end if;
    -- given_on records the actual date received; the linked batch determines its reporting Sunday.
  end if;

  if new.bible_study_batch_id is not null then
    select * into v_bible from public.bible_study_giving_batches where id=new.bible_study_batch_id;
    if not found then raise exception 'Bible Study giving batch not found'; end if;
    if v_bible.workflow_status <> 'draft' then raise exception 'Only draft Bible Study giving can be edited'; end if;
    select * into v_summary from public.cms_service_summaries where id=v_bible.service_summary_id;
    if not found or v_summary.summary_type <> 'Bible Study' then raise exception 'Bible Study summary not found'; end if;
    if new.given_on <> v_summary.summary_date then raise exception 'Giving date must match the Bible Study date'; end if;
    if new.giving_type not in ('Tithe','Offering') then raise exception 'Bible Study giving supports Tithe and Offering entries only'; end if;
    if new.giving_type='Tithe' and new.member_id is null then raise exception 'A tithe must be linked to a member'; end if;
  end if;

  return new;
end;
$$;
