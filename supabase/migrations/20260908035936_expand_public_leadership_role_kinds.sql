alter table public.site_people
  drop constraint if exists site_people_kind_check;

alter table public.site_people
  add constraint site_people_kind_check
  check (
    lower(btrim(kind)) = any (
      array[
        'pastor'::text,
        'elder'::text,
        'deacon'::text,
        'area leader'::text,
        'ministry leader'::text,
        'other'::text,
        'leader'::text
      ]
    )
  );
