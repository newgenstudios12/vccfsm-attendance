-- Trigger-only helper should not be callable through the API.
revoke execute on function public.enforce_announcement_scope() from public, anon, authenticated;
