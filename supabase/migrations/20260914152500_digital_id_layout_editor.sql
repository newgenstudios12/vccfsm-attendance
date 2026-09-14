alter table public.digital_id_template_settings
  add column if not exists layout_json jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'digital_id_template_settings_layout_json_object'
      and conrelid = 'public.digital_id_template_settings'::regclass
  ) then
    alter table public.digital_id_template_settings
      add constraint digital_id_template_settings_layout_json_object
      check (jsonb_typeof(layout_json) = 'object');
  end if;
end
$$;
