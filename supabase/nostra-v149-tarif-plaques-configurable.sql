-- Nostra Group V149 - Tarif des plaques configurable
-- 1) Passe le tarif historique de 100 000 EUR a 80 000 EUR.
-- 2) Conserve le RPC existant nostra_update_plate_settings utilise par le Dashboard.
-- 3) Ne modifie pas les commandes deja creees.

do $$
declare
  v_function_def text;
  v_row record;
  v_rows integer;
  v_total integer := 0;
begin
  select pg_get_functiondef(p.oid)
    into v_function_def
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'nostra_update_plate_settings'
  order by p.oid desc
  limit 1;

  for v_row in
    select c.table_name
    from information_schema.columns c
    where c.table_schema = 'public'
    group by c.table_name
    having bool_or(c.column_name = 'base_price')
       and bool_or(c.column_name = 'active')
  loop
    if lower(v_row.table_name) like '%plate%'
       or (v_function_def is not null
           and position(lower(v_row.table_name) in lower(v_function_def)) > 0) then
      execute format(
        'update public.%I set base_price = 80000 where base_price = 100000',
        v_row.table_name
      );
      get diagnostics v_rows = row_count;
      v_total := v_total + v_rows;

      begin
        execute format(
          'alter table public.%I alter column base_price set default 80000',
          v_row.table_name
        );
      exception
        when others then
          raise notice 'V149: impossible de changer le default de %.base_price: %',
            v_row.table_name, sqlerrm;
      end;
    end if;
  end loop;

  raise notice 'V149: % ligne(s) de reglage plaque passee(s) de 100000 a 80000.', v_total;
end $$;
