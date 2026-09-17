-- Keep the transactional delete inside the caller's existing RLS permissions.
alter function public.delete_bible_study_summary(uuid) security invoker;
