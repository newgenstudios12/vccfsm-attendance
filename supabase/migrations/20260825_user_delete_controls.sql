alter table public.conversation_members add column if not exists hidden_at timestamptz;
create index if not exists conversation_members_user_hidden_idx on public.conversation_members(user_id, hidden_at, conversation_id);

alter table public.messages enable row level security;
alter table public.vccf_notifications enable row level security;
alter table public.conversation_members enable row level security;

drop policy if exists vccf_chat_messages_delete_own on public.messages;
create policy vccf_chat_messages_delete_own on public.messages
for delete to authenticated
using (sender_id = auth.uid() and private.is_vccf_chat_member(conversation_id, auth.uid()));

drop policy if exists vccf_notifications_delete_own on public.vccf_notifications;
create policy vccf_notifications_delete_own on public.vccf_notifications
for delete to authenticated
using (user_id = auth.uid());

drop policy if exists vccf_chat_members_update_own on public.conversation_members;
create policy vccf_chat_members_update_own on public.conversation_members
for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create or replace function private.vccf_unhide_conversation_on_message()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  update public.conversation_members set hidden_at = null where conversation_id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists vccf_unhide_conversation_on_message on public.messages;
create trigger vccf_unhide_conversation_on_message
after insert on public.messages
for each row execute function private.vccf_unhide_conversation_on_message();

create or replace function private.get_vccf_chat_list()
returns table(conversation_id uuid, other_user_id uuid, other_name text, other_photo_url text, area_name text, last_message text, last_message_at timestamptz, unread_count integer)
language sql
security definer
set search_path to ''
as $$
  with mine as (
    select cm.conversation_id, cm.last_read_at
    from public.conversation_members cm
    where cm.user_id = (select auth.uid()) and cm.hidden_at is null
  ),
  others as (
    select cm.conversation_id, cm.user_id
    from public.conversation_members cm
    join mine on mine.conversation_id = cm.conversation_id
    where cm.user_id <> (select auth.uid())
  )
  select c.id, o.user_id,
    coalesce(nullif(trim(p.display_name),''), nullif(trim(m.display_name),''), 'VCCF Account'),
    coalesce(nullif(trim(p.profile_photo_url),''), nullif(trim(m.photo_url),'')),
    a.name, lm.body, lm.created_at,
    greatest(0, (select count(*) from public.messages msg where msg.conversation_id=c.id and msg.sender_id <> (select auth.uid()) and msg.created_at > coalesce(mine.last_read_at,'epoch'::timestamptz)))::integer
  from mine join public.conversations c on c.id=mine.conversation_id
  join others o on o.conversation_id=c.id
  left join public.profiles p on p.user_id=o.user_id
  left join public.members m on m.id=p.member_id
  left join public.areas a on a.id=p.area_id
  left join lateral (select body, created_at from public.messages msg where msg.conversation_id=c.id order by created_at desc limit 1) lm on true
  order by coalesce(lm.created_at,c.created_at) desc;
$$;