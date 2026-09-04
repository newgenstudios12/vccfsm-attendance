drop policy if exists daily_bible_verse_push_log_no_client_access on public.daily_bible_verse_push_log;
create policy daily_bible_verse_push_log_no_client_access
on public.daily_bible_verse_push_log
for all
to anon, authenticated
using (false)
with check (false);
