-- Per-account light/dark theme preference.
alter table public.profiles
  add column if not exists theme_preference text not null default 'light'
  check (theme_preference in ('light','dark'));

create or replace function public.get_my_theme_preference()
returns text
language sql
security definer
set search_path = public
as $$
  select coalesce(theme_preference, 'light')
  from public.profiles
  where user_id = auth.uid();
$$;

create or replace function public.set_my_theme_preference(p_theme text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_theme text := lower(trim(p_theme));
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if v_theme not in ('light','dark') then
    raise exception 'Theme must be light or dark';
  end if;

  update public.profiles
  set theme_preference = v_theme,
      updated_at = now()
  where user_id = auth.uid();

  if not found then
    raise exception 'Profile not found';
  end if;

  return v_theme;
end;
$$;

revoke all on function public.get_my_theme_preference() from public;
revoke all on function public.set_my_theme_preference(text) from public;
grant execute on function public.get_my_theme_preference() to authenticated;
grant execute on function public.set_my_theme_preference(text) to authenticated;
