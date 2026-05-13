-- Align wardrobe_items colour column with PostgREST / app (expects `color`).
-- Safe on projects that used British `colour`, missed the column, or already have `color`.

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'wardrobe_items'
      and column_name = 'colour'
  )
  and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'wardrobe_items'
      and column_name = 'color'
  ) then
    alter table public.wardrobe_items rename column colour to color;
  end if;
end $$;

alter table public.wardrobe_items
  add column if not exists color text not null default '';

notify pgrst, 'reload schema';
