-- The finance RPC is authenticated-only; trigger helpers are not callable directly.
revoke execute on function public.get_bible_study_finance_sessions(integer) from public, anon;
grant execute on function public.get_bible_study_finance_sessions(integer) to authenticated;

revoke execute on function public.guard_bible_study_giving_batch() from public, anon, authenticated;
revoke execute on function public.sync_bible_study_giving_status() from public, anon, authenticated;
