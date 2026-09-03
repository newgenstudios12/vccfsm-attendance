alter table public.members
  add column if not exists province text,
  add column if not exists city_municipality text,
  add column if not exists province_psgc_code text,
  add column if not exists city_municipality_psgc_code text,
  add column if not exists barangay_psgc_code text;
