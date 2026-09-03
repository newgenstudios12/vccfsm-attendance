alter table public.giving_records alter column member_id drop not null;
alter table public.giving_records drop constraint if exists giving_records_member_id_fkey;
alter table public.giving_records add constraint giving_records_member_id_fkey foreign key (member_id) references public.members(id) on delete set null;
