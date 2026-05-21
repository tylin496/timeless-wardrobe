do $$
declare
  old_overrides text := 'arch' || 'ive_overrides';
  old_hidden text := 'arch' || 'ive_hidden_ids';
begin
  if not exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'wardrobe_app_state'
  ) then
    return;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'wardrobe_app_state'
      and column_name = old_overrides
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'wardrobe_app_state'
      and column_name = 'collection_overrides'
  ) then
    execute format('alter table public.wardrobe_app_state rename column %I to collection_overrides', old_overrides);
  else
    alter table public.wardrobe_app_state
      add column if not exists collection_overrides jsonb not null default '{}'::jsonb;

    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'wardrobe_app_state'
        and column_name = old_overrides
    ) then
      execute format(
        'update public.wardrobe_app_state set collection_overrides = case when collection_overrides is null or collection_overrides = ''{}''::jsonb then coalesce(%I, ''{}''::jsonb) else collection_overrides end',
        old_overrides
      );
    end if;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'wardrobe_app_state'
      and column_name = old_hidden
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'wardrobe_app_state'
      and column_name = 'collection_hidden_ids'
  ) then
    execute format('alter table public.wardrobe_app_state rename column %I to collection_hidden_ids', old_hidden);
  else
    alter table public.wardrobe_app_state
      add column if not exists collection_hidden_ids jsonb not null default '[]'::jsonb;

    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'wardrobe_app_state'
        and column_name = old_hidden
    ) then
      execute format(
        'update public.wardrobe_app_state set collection_hidden_ids = case when collection_hidden_ids is null or collection_hidden_ids = ''[]''::jsonb then coalesce(%I, ''[]''::jsonb) else collection_hidden_ids end',
        old_hidden
      );
    end if;
  end if;
end $$;
