-- Optional styling notes per saved outfit (Outfits drawer).
alter table public.outfits
  add column if not exists notes text not null default '';
