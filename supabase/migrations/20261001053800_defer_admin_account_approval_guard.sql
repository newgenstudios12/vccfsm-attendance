-- Auth saves admin app metadata after the initial user INSERT.
-- Inspect the final row at transaction completion while preserving signup approval.
create or replace function private.require_admin_created_account()
returns trigger language plpgsql set search_path='' as $$
declare account_row auth.users%rowtype;
begin
 select * into account_row from auth.users where id=new.id;
 if not found then return new; end if;
 if account_row.invited_at is null and coalesce(account_row.raw_app_meta_data->>'vccf_admin_created','false')<>'true' then
  raise exception 'Account registration requires administrator approval. Submit a registration request through VCCF Connect.';
 end if;
 return new;
end $$;
revoke all on function private.require_admin_created_account() from public,anon,authenticated;
drop trigger vccf_require_admin_created_account on auth.users;
create constraint trigger vccf_require_admin_created_account
after insert on auth.users deferrable initially deferred
for each row execute function private.require_admin_created_account();