create table public.account_registration_requests (
 id uuid primary key default gen_random_uuid(), display_name text not null, email text not null,
 contact text not null default '', notes text not null default '',
 status text not null default 'pending' check(status in ('pending','approved','rejected')),
 created_at timestamptz not null default now(), reviewed_at timestamptz,
 reviewed_by uuid references auth.users(id), user_id uuid references auth.users(id),
 check(length(display_name) between 2 and 120), check(length(email)<=254),
 check(length(contact)<=40), check(length(notes)<=500));
create unique index account_registration_pending_email on public.account_registration_requests(email) where status='pending';
create index account_registration_reviewed_by on public.account_registration_requests(reviewed_by);
create index account_registration_user_id on public.account_registration_requests(user_id);
alter table public.account_registration_requests enable row level security;
grant select,update on public.account_registration_requests to authenticated;
create policy registration_admin_select on public.account_registration_requests for select to authenticated using(public.current_role()='admin');
create policy registration_admin_update on public.account_registration_requests for update to authenticated using(public.current_role()='admin') with check(public.current_role()='admin');
create or replace function public.submit_account_registration(p_name text,p_email text,p_contact text default '',p_notes text default '')
returns void language plpgsql security definer set search_path='' as $$
declare v_email text:=lower(trim(p_email));
begin
 if p_name is null or length(trim(p_name)) not between 2 and 120 or v_email is null or length(v_email)>254 or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or v_email like '%@vccf.local' or length(coalesce(p_contact,''))>40 or length(coalesce(p_notes,''))>500 then raise exception 'Please enter a valid name and email address.'; end if;
 perform pg_advisory_xact_lock(hashtextextended('vccf-registration',0));
 if exists(select 1 from public.account_registration_requests where email=v_email and (status in ('pending','approved') or created_at>now()-interval '1 day')) or exists(select 1 from auth.users where lower(email)=v_email) then return; end if;
 if (select count(*) from public.account_registration_requests where created_at>now()-interval '1 day')>=100 then raise exception 'Registration is temporarily busy. Please contact an administrator.'; end if;
 insert into public.account_registration_requests(display_name,email,contact,notes) values(trim(p_name),v_email,trim(coalesce(p_contact,'')),trim(coalesce(p_notes,'')));
end $$;
revoke all on function public.submit_account_registration(text,text,text,text) from public;
grant execute on function public.submit_account_registration(text,text,text,text) to anon,authenticated;
create schema if not exists private;
create or replace function private.require_admin_created_account() returns trigger language plpgsql set search_path='' as $$
begin
 if new.invited_at is null and coalesce(new.raw_app_meta_data->>'vccf_admin_created','false')<>'true' then
 raise exception 'Account registration requires administrator approval. Submit a registration request through VCCF Connect.';
 end if;
 return new;
end $$;
revoke all on function private.require_admin_created_account() from public,anon,authenticated;
create trigger vccf_require_admin_created_account before insert on auth.users for each row execute function private.require_admin_created_account();
