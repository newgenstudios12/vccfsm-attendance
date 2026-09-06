grant select (file_path) on table public.vccf_sermons to anon;

drop policy if exists "Public can read sermon files" on storage.objects;
create policy "Public can read sermon files"
on storage.objects
for select
to anon
using (bucket_id = 'vccf-sermons');
