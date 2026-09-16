create index if not exists prayer_wall_posts_area_id_idx
  on public.prayer_wall_posts(area_id);

create index if not exists prayer_wall_supports_user_id_idx
  on public.prayer_wall_supports(user_id);
