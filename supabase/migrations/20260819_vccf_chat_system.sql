create schema if not exists private;

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'direct' check (kind in ('direct','group')),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  last_read_at timestamptz,
  primary key (conversation_id,user_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index if not exists conversation_members_user_idx on public.conversation_members(user_id, joined_at desc);
create index if not exists messages_conversation_created_idx on public.messages(conversation_id, created_at desc);
create index if not exists messages_sender_idx on public.messages(sender_id, created_at desc);

alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;

revoke all on table public.conversations from anon, authenticated;
revoke all on table public.conversation_members from anon, authenticated;
grant select, insert on table public.messages to authenticated;
revoke update, delete on table public.messages from authenticated;

create or replace function private.is_vccf_chat_member(p_conversation_id uuid, p_user_id uuid)
returns boolean language sql security definer set search_path = '' as $$
  select exists (select 1 from public.conversation_members cm where cm.conversation_id=p_conversation_id and cm.user_id=p_user_id);
$$;

create or replace function private.search_vccf_chat_accounts(p_query text default '')
returns table(user_id uuid, display_name text, photo_url text, area_name text)
language sql security definer set search_path = '' as $$
  select p.user_id,
    coalesce(nullif(trim(p.display_name),''), nullif(trim(m.display_name),''), 'VCCF Account'),
    m.photo_url, a.name
  from public.profiles p
  left join public.members m on m.id=p.member_id
  left join public.areas a on a.id=p.area_id
  where p.user_id <> (select auth.uid())
    and (coalesce(trim(p_query),'')='' or lower(coalesce(p.display_name,m.display_name,'')) like '%'||lower(trim(p_query))||'%')
  order by coalesce(nullif(trim(p.display_name),''), nullif(trim(m.display_name),''), 'VCCF Account')
  limit 20;
$$;

create or replace function public.search_chat_accounts(p_query text default '')
returns table(user_id uuid, display_name text, photo_url text, area_name text)
language sql security invoker as $$ select * from private.search_vccf_chat_accounts(p_query); $$;

create or replace function private.start_vccf_direct_chat(p_other_user_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_me uuid := (select auth.uid()); v_conversation uuid;
begin
  if v_me is null then raise exception 'Authentication required'; end if;
  if p_other_user_id is null or p_other_user_id=v_me then raise exception 'Invalid chat recipient'; end if;
  if not exists (select 1 from public.profiles p where p.user_id=p_other_user_id) then raise exception 'That account is not available for chat'; end if;
  select c.id into v_conversation from public.conversations c
  where c.kind='direct'
    and exists (select 1 from public.conversation_members cm where cm.conversation_id=c.id and cm.user_id=v_me)
    and exists (select 1 from public.conversation_members cm where cm.conversation_id=c.id and cm.user_id=p_other_user_id)
    and 2=(select count(*) from public.conversation_members cm where cm.conversation_id=c.id);
  if v_conversation is not null then return v_conversation; end if;
  insert into public.conversations(created_by) values(v_me) returning id into v_conversation;
  insert into public.conversation_members(conversation_id,user_id) values(v_conversation,v_me),(v_conversation,p_other_user_id);
  return v_conversation;
end;
$$;

create or replace function public.start_direct_chat(p_other_user_id uuid)
returns uuid language sql security invoker as $$ select private.start_vccf_direct_chat(p_other_user_id); $$;

create or replace function private.get_vccf_chat_list()
returns table(conversation_id uuid, other_user_id uuid, other_name text, other_photo_url text, area_name text, last_message text, last_message_at timestamptz, unread_count integer)
language sql security definer set search_path = '' as $$
  with mine as (select cm.conversation_id, cm.last_read_at from public.conversation_members cm where cm.user_id=(select auth.uid())),
  others as (select cm.conversation_id, cm.user_id from public.conversation_members cm join mine on mine.conversation_id=cm.conversation_id where cm.user_id<>(select auth.uid()))
  select c.id,o.user_id,coalesce(nullif(trim(p.display_name),''),nullif(trim(m.display_name),''),'VCCF Account'),m.photo_url,a.name,lm.body,lm.created_at,
    greatest(0,(select count(*) from public.messages msg where msg.conversation_id=c.id and msg.sender_id<>(select auth.uid()) and msg.created_at>coalesce(mine.last_read_at,'epoch'::timestamptz)))::integer
  from mine join public.conversations c on c.id=mine.conversation_id join others o on o.conversation_id=c.id
  left join public.profiles p on p.user_id=o.user_id left join public.members m on m.id=p.member_id left join public.areas a on a.id=p.area_id
  left join lateral (select body,created_at from public.messages msg where msg.conversation_id=c.id order by created_at desc limit 1) lm on true
  order by coalesce(lm.created_at,c.created_at) desc;
$$;

create or replace function public.get_chat_list()
returns table(conversation_id uuid, other_user_id uuid, other_name text, other_photo_url text, area_name text, last_message text, last_message_at timestamptz, unread_count integer)
language sql security invoker as $$ select * from private.get_vccf_chat_list(); $$;

create or replace function public.mark_chat_read(p_conversation_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  update public.conversation_members set last_read_at=now() where conversation_id=p_conversation_id and user_id=(select auth.uid());
end;
$$;

revoke execute on function public.search_chat_accounts(text) from public, anon;
revoke execute on function public.start_direct_chat(uuid) from public, anon;
revoke execute on function public.get_chat_list() from public, anon;
revoke execute on function public.mark_chat_read(uuid) from public, anon;
grant execute on function public.search_chat_accounts(text) to authenticated;
grant execute on function public.start_direct_chat(uuid) to authenticated;
grant execute on function public.get_chat_list() to authenticated;
grant execute on function public.mark_chat_read(uuid) to authenticated;

drop policy if exists vccf_chat_messages_select on public.messages;
drop policy if exists vccf_chat_messages_insert on public.messages;
create policy vccf_chat_messages_select on public.messages for select to authenticated using (private.is_vccf_chat_member(conversation_id,(select auth.uid())));
create policy vccf_chat_messages_insert on public.messages for insert to authenticated with check (sender_id=(select auth.uid()) and private.is_vccf_chat_member(conversation_id,(select auth.uid())));

drop policy if exists vccf_chat_members_select on public.conversation_members;
create policy vccf_chat_members_select on public.conversation_members for select to authenticated using (user_id=(select auth.uid()));

create or replace function public.broadcast_vccf_chat_message()
returns trigger security definer set search_path = '' as $$
begin
  perform realtime.broadcast_changes('chat:'||new.conversation_id::text,'INSERT','INSERT','messages','public',new,null);
  return null;
end;
$$ language plpgsql;
revoke execute on function public.broadcast_vccf_chat_message() from public, anon, authenticated;

drop trigger if exists vccf_chat_message_broadcast on public.messages;
create trigger vccf_chat_message_broadcast after insert on public.messages for each row execute function public.broadcast_vccf_chat_message();

drop policy if exists vccf_chat_broadcast_receive on realtime.messages;
drop policy if exists vccf_chat_broadcast_send on realtime.messages;
create policy vccf_chat_broadcast_receive on realtime.messages for select to authenticated using (
  realtime.messages.extension='broadcast' and exists (select 1 from public.conversation_members cm where cm.user_id=(select auth.uid()) and ('chat:'||cm.conversation_id::text)=(select realtime.topic()))
);
create policy vccf_chat_broadcast_send on realtime.messages for insert to authenticated with check (
  realtime.messages.extension='broadcast' and exists (select 1 from public.conversation_members cm where cm.user_id=(select auth.uid()) and ('chat:'||cm.conversation_id::text)=(select realtime.topic()))
);

grant select on table public.messages to authenticated;
revoke execute on function private.is_vccf_chat_member(uuid,uuid) from public, anon, authenticated;
revoke execute on function private.search_vccf_chat_accounts(text) from public, anon, authenticated;
revoke execute on function private.start_vccf_direct_chat(uuid) from public, anon, authenticated;
revoke execute on function private.get_vccf_chat_list() from public, anon, authenticated;
grant usage on schema private to authenticated;
