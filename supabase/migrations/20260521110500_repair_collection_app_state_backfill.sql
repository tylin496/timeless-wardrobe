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
      and column_name = 'collection_overrides'
  ) and exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'wardrobe_app_state'
      and column_name = old_overrides
  ) then
    execute format(
      'update public.wardrobe_app_state
       set collection_overrides = %I
       where coalesce(collection_overrides, ''{}''::jsonb) = ''{}''::jsonb
         and coalesce(%I, ''{}''::jsonb) <> ''{}''::jsonb',
      old_overrides,
      old_overrides
    );
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'wardrobe_app_state'
      and column_name = 'collection_hidden_ids'
  ) and exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'wardrobe_app_state'
      and column_name = old_hidden
  ) then
    execute format(
      'update public.wardrobe_app_state
       set collection_hidden_ids = %I
       where coalesce(collection_hidden_ids, ''[]''::jsonb) = ''[]''::jsonb
         and coalesce(%I, ''[]''::jsonb) <> ''[]''::jsonb',
      old_hidden,
      old_hidden
    );
  end if;
end $$;
